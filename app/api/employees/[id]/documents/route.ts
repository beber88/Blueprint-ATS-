import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HR_BUCKET = "hr-documents";
const ALLOWED_TYPES = new Set([
  "contract",
  "id",
  "certificate",
  "payslip",
  "government",
  "warning",
  "achievement",
  "report",
  "attendance",
  "medical",
  "tax",
  "other",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Document GET error:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
    return NextResponse.json({ documents: data || [] });
  } catch (error) {
    console.error("Document GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const supabase = createAdminClient();

    const { data: employee } = await supabase
      .from("employees")
      .select("id, full_name")
      .eq("id", employeeId)
      .single();

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("document_type") as string) || "other";
    const title = (formData.get("title") as string) || null;
    const originalLanguage = (formData.get("original_language") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(documentType)) {
      return NextResponse.json({ error: "invalid document_type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const { data: existing } = await supabase
      .from("employee_documents")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "duplicate", message: "This file already exists for this employee", document_id: existing.id },
        { status: 409 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${employeeId}/${documentType}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(HR_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(HR_BUCKET).getPublicUrl(storagePath);
    const fileUrl = urlData?.publicUrl || storagePath;

    const { data: doc, error: insertError } = await supabase
      .from("employee_documents")
      .insert({
        employee_id: employeeId,
        document_type: documentType,
        title: title || file.name,
        file_url: fileUrl,
        file_hash: fileHash,
        original_filename: file.name,
        mime_type: file.type || null,
        size_bytes: buffer.length,
        original_language: originalLanguage || "unknown",
        provenance: { source: "manual", imported_at: new Date().toISOString() },
        metadata: { storage_path: storagePath },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Document insert error:", insertError);
      await supabase.storage.from(HR_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Failed to record document" }, { status: 500 });
    }

    await supabase.from("employee_timeline").insert({
      employee_id: employeeId,
      event_type: "document_uploaded",
      title: `Document uploaded: ${title || file.name}`,
      description: `Type: ${documentType}`,
      related_table: "employee_documents",
      related_id: doc.id,
      metadata: { document_type: documentType },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Document POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "documentId required" }, { status: 400 });
    }

    const { data: doc } = await supabase
      .from("employee_documents")
      .select("metadata, employee_id, title")
      .eq("id", documentId)
      .single();

    if (doc?.metadata && typeof doc.metadata === "object") {
      const path = (doc.metadata as Record<string, string>).storage_path;
      if (path) {
        await supabase.storage.from(HR_BUCKET).remove([path]);
      }
    }

    const { error } = await supabase.from("employee_documents").delete().eq("id", documentId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (doc) {
      await supabase.from("employee_timeline").insert({
        employee_id: doc.employee_id,
        event_type: "document_deleted",
        title: `Document deleted: ${doc.title || "(untitled)"}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
