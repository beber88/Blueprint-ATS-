import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/government/deadlines
 *
 * Returns the upcoming PH statutory remittance deadlines for the next
 * three applicable months. Deadlines reference the month the
 * contribution was withheld ("applicable month") and the day it must
 * be remitted in the following month.
 *
 * Day-of-month rules used (standard manual-filing deadlines; agencies
 * stagger exact dates by employer number — treat these as the latest
 * safe date):
 *   - BIR 1601-C (withholding tax): 10th of following month
 *   - Pag-IBIG (HDMF) contributions: 10th of following month
 *   - PhilHealth contributions: last day of following month
 *   - SSS contributions: last day of following month
 */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export async function GET() {
  const today = new Date();
  const agencies = [
    { agency: "BIR", form: "1601-C", label: "Withholding tax remittance", day: 10 },
    { agency: "Pag-IBIG", form: "MCRF", label: "HDMF contributions", day: 10 },
    { agency: "PhilHealth", form: "RF-1", label: "PhilHealth contributions", day: "last" as const },
    { agency: "SSS", form: "R-5", label: "SSS contributions", day: "last" as const },
  ];

  const deadlines: Array<{
    agency: string;
    form: string;
    label: string;
    applicable_month: string;
    due_date: string;
    days_until: number;
    overdue: boolean;
  }> = [];

  // Applicable months: previous month + current month + next month.
  for (let offset = -1; offset <= 1; offset++) {
    const applicable = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const dueMonthIndex = applicable.getMonth() + 1;
    const dueYear = applicable.getFullYear();

    for (const a of agencies) {
      const dueDay =
        a.day === "last"
          ? lastDayOfMonth(dueYear, dueMonthIndex)
          : a.day;
      const dueDate = new Date(dueYear, dueMonthIndex, dueDay);
      const daysUntil = Math.round(
        (dueDate.getTime() - new Date(today.toDateString()).getTime()) / 86400000
      );
      // Skip deadlines that passed more than 31 days ago.
      if (daysUntil < -31) continue;

      deadlines.push({
        agency: a.agency,
        form: a.form,
        label: a.label,
        applicable_month: applicable.toISOString().slice(0, 7),
        due_date: dueDate.toISOString().slice(0, 10),
        days_until: daysUntil,
        overdue: daysUntil < 0,
      });
    }
  }

  deadlines.sort((a, b) => a.due_date.localeCompare(b.due_date));

  return NextResponse.json({ deadlines });
}
