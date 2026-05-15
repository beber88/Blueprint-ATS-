import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const docType = formData.get("type") as string || "other";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const fileName = `${params.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, buffer, { contentType: file.type });
    if (uploadError) {
      console.error("Document upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);

    // Get existing documents
    const { data: candidate } = await supabase.from("candidates").select("documents").eq("id", params.id).single();
    const existingDocs = (candidate?.documents as { name: string; url: string; type: string; uploaded_at: string }[]) || [];

    const newDoc = { name: file.name, url: publicUrl, type: docType, uploaded_at: new Date().toISOString() };
    const updatedDocs = [...existingDocs, newDoc];

    await supabase.from("candidates").update({ documents: updatedDocs }).eq("id", params.id);

    // Log activity
    await supabase.from("activity_log").insert({
      candidate_id: params.id,
      action: "document_uploaded",
      details: { file_name: file.name, doc_type: docType },
    });

    return NextResponse.json({ document: newDoc, documents: updatedDocs });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
