import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EVENT_TYPES = ["disciplinary_action", "recognition"] as const;
type ConductType = (typeof EVENT_TYPES)[number];

const DISCIPLINE_SEVERITIES = ["verbal", "written", "final_warning", "suspension"];

const SELECT =
  "id, employee_id, event_type, event_date, title, description, metadata, created_at, employee:op_employees!employee_id(id, full_name)";

/**
 * GET /api/conduct?type=disciplinary_action|recognition&employeeId=...
 *
 * Conduct records (disciplinary actions + recognition) are stored as
 * hr_employee_timeline events so they share the employee timeline with
 * everything else. metadata holds the structured fields.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const employeeId = searchParams.get("employeeId");

    const admin = createAdminClient();
    let query = admin
      .from("hr_employee_timeline")
      .select(SELECT)
      .order("event_date", { ascending: false })
      .limit(300);

    if (type && EVENT_TYPES.includes(type as ConductType)) {
      query = query.eq("event_type", type);
    } else {
      query = query.in("event_type", EVENT_TYPES as unknown as string[]);
    }
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query;
    if (error) {
      console.error("Conduct query error:", error);
      return NextResponse.json({ error: "Failed to fetch conduct records" }, { status: 500 });
    }

    const records = data || [];
    const disciplineCount = records.filter((r) => r.event_type === "disciplinary_action").length;
    const recognitionCount = records.filter((r) => r.event_type === "recognition").length;

    return NextResponse.json({
      records,
      summary: { discipline: disciplineCount, recognition: recognitionCount },
    });
  } catch (err) {
    console.error("Conduct GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/conduct
 * Body for discipline: { employee_id, type: "disciplinary_action",
 *   title, description?, severity, category?, event_date? }
 * Body for recognition: { employee_id, type: "recognition",
 *   title, description?, award?, points?, event_date? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await request.json();
    const type: string = body.type;

    if (!body.employee_id || !body.title || !EVENT_TYPES.includes(type as ConductType)) {
      return NextResponse.json(
        { error: "employee_id, title, and a valid type are required" },
        { status: 400 }
      );
    }

    let metadata: Record<string, unknown>;
    if (type === "disciplinary_action") {
      const severity = body.severity || "verbal";
      if (!DISCIPLINE_SEVERITIES.includes(severity)) {
        return NextResponse.json({ error: "invalid severity" }, { status: 400 });
      }
      metadata = {
        kind: "discipline",
        severity,
        category: body.category || null,
        acknowledged: false,
      };
    } else {
      metadata = {
        kind: "recognition",
        award: body.award || null,
        points: Number(body.points) || 0,
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hr_employee_timeline")
      .insert({
        employee_id: body.employee_id,
        event_type: type,
        event_date: body.event_date ? new Date(body.event_date).toISOString() : new Date().toISOString(),
        title: body.title,
        description: body.description || null,
        actor_user_id: user.id,
        metadata,
      })
      .select(SELECT)
      .single();

    if (error) {
      console.error("Conduct insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Conduct POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
