/**
 * Derives worked hours from clock in/out timestamps.
 *
 * total_hours = (clock_out - clock_in) - break, floored at 0.
 * overtime_hours = hours worked beyond a standard 8-hour day.
 */
const STANDARD_DAY_HOURS = 8;

export interface ComputedHours {
  total_hours: number | null;
  overtime_hours: number;
}

export function computeWorkedHours(
  clockIn: string | null,
  clockOut: string | null,
  breakMinutes: number
): ComputedHours {
  if (!clockIn || !clockOut) {
    return { total_hours: null, overtime_hours: 0 };
  }

  const inMs = new Date(clockIn).getTime();
  const outMs = new Date(clockOut).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) {
    return { total_hours: null, overtime_hours: 0 };
  }

  const grossHours = (outMs - inMs) / 3_600_000;
  const net = Math.max(grossHours - (breakMinutes || 0) / 60, 0);
  const total = Math.round(net * 100) / 100;
  const overtime = Math.round(Math.max(total - STANDARD_DAY_HOURS, 0) * 100) / 100;

  return { total_hours: total, overtime_hours: overtime };
}
