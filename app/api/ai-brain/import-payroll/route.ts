import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Excel serial date → JS Date
function excelDateToISO(serial: number): string {
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "hr-management" });
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    const supabase = createAdminClient();
    const results = { employees_updated: 0, salary_records: 0, attendance_records: 0, errors: [] as string[] };

    // ── 1. Import employee list + salary ─────────────────────────────────
    const empSheet = wb.Sheets["List of Employees"];
    if (empSheet) {
      const rows = XLSX.utils.sheet_to_json(empSheet, { header: 1 }) as unknown[][];
      // Row 0 = headers, rows 1+ = data
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as (string | number | null)[];
        if (!row || row.length < 12) continue;

        const idNum = row[1] as number | null;
        const firstName = (row[2] as string || "").trim();
        const middleName = (row[3] as string || "").trim();
        const lastName = (row[4] as string || "").trim();
        const position = (row[5] as string || "").trim();
        const dateHiredRaw = row[7] as number | null;
        const baseSalary = row[9] as number || 0;
        const allowance = row[10] as number || 0;

        if (!firstName && !lastName) continue;
        const fullName = `${firstName} ${middleName ? middleName + " " : ""}${lastName}`.trim();

        // Find or match employee by name
        const { data: existingEmps } = await supabase
          .from("op_employees")
          .select("id, full_name")
          .eq("is_active", true);

        const matched = (existingEmps || []).find(e => {
          const en = e.full_name.toLowerCase();
          const fn = fullName.toLowerCase();
          return en === fn || en.includes(lastName.toLowerCase()) && en.includes(firstName.toLowerCase().slice(0, 4));
        });

        if (matched) {
          // Update employee with ID number
          if (idNum) {
            await supabase.from("op_employees").update({
              employee_id_number: String(idNum),
              updated_at: new Date().toISOString(),
            }).eq("id", matched.id);
          }

          // Upsert salary record
          const hireDate = dateHiredRaw && typeof dateHiredRaw === "number"
            ? excelDateToISO(dateHiredRaw)
            : new Date().toISOString().slice(0, 10);

          const { error: salErr } = await supabase.from("hr_salary").upsert({
            employee_id: matched.id,
            effective_date: hireDate,
            base_salary: baseSalary,
            currency: "PHP",
            pay_frequency: "semi-monthly",
            allowances: { monthly: allowance },
            notes: `Imported from payroll Excel. Position: ${position}`,
          }, { onConflict: "employee_id,effective_date" });

          if (salErr) results.errors.push(`Salary ${fullName}: ${salErr.message}`);
          else results.salary_records++;
          results.employees_updated++;
        } else {
          results.errors.push(`No match for: ${fullName}`);
        }
      }
    }

    // ── 2. Import contribution / government IDs ──────────────────────────
    const contribSheet = wb.Sheets["CONTRIBUTION"];
    if (contribSheet) {
      const rows = XLSX.utils.sheet_to_json(contribSheet, { header: 1 }) as unknown[][];
      // Headers at row 1, data from row 2+
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as (string | number | null)[];
        if (!row || row.length < 31) continue;

        const idNum = row[1] as number | null;
        const empName = (row[2] as string || "").trim();
        if (!empName || !idNum) continue;

        // Extract government numbers (columns at end of contribution sheet)
        const sss = row[27] as string || null;
        const philhealth = row[28] as string || null;
        const pagibig = row[29] as string || null;
        const tin = row[30] as string || null;
        const dateHired = row[25] as number | null;
        const dob = row[26] as number | null;

        // Match by employee ID number or name
        const lastName = empName.split(",")[0]?.trim() || "";
        const { data: existingEmps } = await supabase
          .from("op_employees")
          .select("id, full_name, employee_id_number")
          .eq("is_active", true);

        const matched = (existingEmps || []).find(e =>
          e.employee_id_number === String(idNum) ||
          e.full_name.toLowerCase().includes(lastName.toLowerCase())
        );

        if (matched) {
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (sss) updates.sss_number = String(sss);
          if (philhealth) updates.philhealth_number = String(philhealth);
          if (pagibig) updates.pagibig_number = String(pagibig);
          if (tin) updates.tin_number = String(tin);
          if (dateHired && typeof dateHired === "number") updates.hire_date = excelDateToISO(dateHired);
          if (dob && typeof dob === "number") updates.date_of_birth_raw = excelDateToISO(dob);

          await supabase.from("op_employees").update(updates).eq("id", matched.id);
        }
      }
    }

    // ── 3. Import timekeeping summary → hr_attendance ────────────────────
    const tkSheet = wb.Sheets["TIMEKEEPING SUMMARY"];
    if (tkSheet) {
      const rows = XLSX.utils.sheet_to_json(tkSheet, { header: 1 }) as unknown[][];
      // Row 0-1 = headers, data from row 2+
      // Extract period from HOME sheet
      const homeSheet = wb.Sheets["HOME"];
      let periodStart = "";
      let periodEnd = "";
      if (homeSheet) {
        const homeRows = XLSX.utils.sheet_to_json(homeSheet, { header: 1 }) as unknown[][];
        if (homeRows[0]) {
          const month1 = (homeRows[0] as (string | number | null)[])[1] as string || "";
          const day1 = (homeRows[0] as (string | number | null)[])[2] as number || 1;
          const year1 = (homeRows[0] as (string | number | null)[])[3] as number || 2026;
          const month2 = homeRows[2] ? (homeRows[2] as (string | number | null)[])[1] as string || "" : "";
          const day2 = homeRows[2] ? (homeRows[2] as (string | number | null)[])[2] as number || 28 : 28;
          const year2 = homeRows[2] ? (homeRows[2] as (string | number | null)[])[3] as number || year1 : year1;
          const months: Record<string, string> = {
            JANUARY: "01", FEBRUARY: "02", MARCH: "03", APRIL: "04", MAY: "05", JUNE: "06",
            JULY: "07", AUGUST: "08", SEPTEMBER: "09", OCTOBER: "10", NOVEMBER: "11", DECEMBER: "12",
          };
          periodStart = `${year1}-${months[month1.toUpperCase()] || "01"}-${String(day1).padStart(2, "0")}`;
          periodEnd = `${year2}-${months[month2.toUpperCase()] || "01"}-${String(day2).padStart(2, "0")}`;
        }
      }

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as (string | number | null)[];
        if (!row || !row[0]) continue;

        const idNum = row[0] as number;
        const regDays = (row[2] as number) || 0;
        const regOT = (row[10] as number) || 0;
        const regMnOT = (row[11] as number) || 0;
        const tardiness = (row[26] as number) || 0;
        const approvedAbsent = (row[28] as number) || 0;
        const sil = (row[29] as number) || 0;
        const unauthAbsent = (row[30] as number) || 0;
        const suspension = (row[32] as number) || 0;
        const lates = (row[33] as number) || 0;

        // Match employee
        const { data: existingEmps } = await supabase
          .from("op_employees")
          .select("id, employee_id_number")
          .eq("is_active", true);

        const matched = (existingEmps || []).find(e => e.employee_id_number === String(idNum));
        if (!matched) continue;

        // Create a summary attendance record for this period
        const totalOT = Math.round((regOT + regMnOT) * 8 * 100) / 100; // Convert day fractions to hours
        const status = unauthAbsent > 0 ? "absent" : suspension > 0 ? "absent" : regDays > 0 ? "present" : "absent";

        const { error: attErr } = await supabase.from("hr_attendance").upsert({
          employee_id: matched.id,
          date: periodEnd || new Date().toISOString().slice(0, 10),
          status,
          total_hours: Math.round(regDays * 8 * 100) / 100,
          overtime_hours: totalOT,
          notes: JSON.stringify({
            period: `${periodStart} to ${periodEnd}`,
            reg_days: regDays,
            approved_absent: approvedAbsent,
            sil,
            unauthorized_absent: unauthAbsent,
            suspension,
            tardiness_days: tardiness,
            lates_count: lates,
            source: "payroll_excel_import",
          }),
        }, { onConflict: "employee_id,date" });

        if (attErr) results.errors.push(`Attendance ${idNum}: ${attErr.message}`);
        else results.attendance_records++;
      }
    }

    return NextResponse.json({
      ok: true,
      period: { sheets: wb.SheetNames },
      ...results,
    });
  } catch (error) {
    console.error("Payroll import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
