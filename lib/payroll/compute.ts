/**
 * Philippine Payroll Computation Engine
 *
 * Computes statutory deductions per Philippine labor law:
 * - SSS (Social Security System) — RA 11199
 * - PhilHealth — Universal Health Care Act (RA 11223)
 * - Pag-IBIG (HDMF) — RA 9679
 * - Withholding Tax — TRAIN Law (RA 10963), 2023+ brackets
 * - 13th Month Pay
 * - Night Differential (10% premium, 10PM-6AM)
 * - Overtime (125% regular, 130% holiday, 200% special)
 */

// ─── SSS Contribution Table (2025 schedule) ─────────────────────────────────
// Employee share = 4.5% of Monthly Salary Credit (MSC)
// MSC range: ₱4,000 (floor) to ₱30,000 (ceiling)

export function computeSSS(monthlySalary: number): { employee: number; employer: number; total: number } {
  const msc = Math.max(4000, Math.min(30000, Math.round(monthlySalary / 500) * 500));
  const employee = Math.round(msc * 0.045 * 100) / 100;
  const employer = Math.round(msc * 0.095 * 100) / 100;
  return { employee, employer, total: employee + employer };
}

// ─── PhilHealth (2025 schedule) ──────────────────────────────────────────────
// Premium rate: 5% of basic monthly salary, split 50/50
// Floor: ₱10,000 | Ceiling: ₱100,000

export function computePhilHealth(monthlySalary: number): { employee: number; employer: number; total: number } {
  const base = Math.max(10000, Math.min(100000, monthlySalary));
  const total = Math.round(base * 0.05 * 100) / 100;
  const employee = Math.round(total / 2 * 100) / 100;
  const employer = total - employee;
  return { employee, employer, total };
}

// ─── Pag-IBIG / HDMF ────────────────────────────────────────────────────────
// Employee: 2% of basic salary (capped at ₱100 for salary ≤ ₱1,500, else 2%)
// Maximum contribution base: ₱5,000 → max employee share = ₱100

export function computePagIBIG(monthlySalary: number): { employee: number; employer: number; total: number } {
  let employeeRate = 0.02;
  if (monthlySalary <= 1500) employeeRate = 0.01;

  const base = Math.min(5000, monthlySalary);
  const employee = Math.round(base * employeeRate * 100) / 100;
  const employer = Math.round(base * 0.02 * 100) / 100;
  return { employee, employer, total: employee + employer };
}

// ─── Withholding Tax — TRAIN Law (2023+ monthly brackets) ───────────────────

interface TaxBracket {
  min: number;
  max: number;
  base: number;
  rate: number;
}

const TAX_BRACKETS: TaxBracket[] = [
  { min: 0,       max: 20833,   base: 0,       rate: 0 },
  { min: 20833,   max: 33333,   base: 0,       rate: 0.15 },
  { min: 33333,   max: 66667,   base: 1875,    rate: 0.20 },
  { min: 66667,   max: 166667,  base: 8541.67, rate: 0.25 },
  { min: 166667,  max: 666667,  base: 33541.67, rate: 0.30 },
  { min: 666667,  max: Infinity, base: 183541.67, rate: 0.35 },
];

export function computeWithholdingTax(taxableIncome: number): number {
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.max) {
      const excess = Math.max(0, taxableIncome - bracket.min);
      return Math.round((bracket.base + excess * bracket.rate) * 100) / 100;
    }
  }
  // Should never reach here, but safety
  const last = TAX_BRACKETS[TAX_BRACKETS.length - 1];
  return Math.round((last.base + (taxableIncome - last.min) * last.rate) * 100) / 100;
}

// ─── Full Payslip Computation ────────────────────────────────────────────────

export interface PayrollInput {
  baseSalary: number;          // Monthly base salary in PHP
  allowances?: {               // Optional allowances
    transportation?: number;
    meal?: number;
    rice?: number;
    clothing?: number;
    other?: number;
  };
  otherDeductions?: {          // Optional other deductions
    lateMinutes?: number;      // Minutes late this period
    absences?: number;         // Days absent (unpaid)
    cashAdvance?: number;
    loans?: number;
    other?: number;
  };
  overtimeHours?: number;      // Regular OT hours
  holidayOTHours?: number;     // Holiday OT hours
  nightDiffHours?: number;     // Night differential hours (10PM-6AM)
  daysInPeriod?: number;       // Working days in period (default 15 for semi-monthly)
  isSemiMonthly?: boolean;     // true = half of monthly (default true)
}

export interface PayslipBreakdown {
  // Earnings
  basic_pay: number;
  allowances: Record<string, number>;
  overtime_pay: number;
  holiday_ot_pay: number;
  night_diff_pay: number;
  gross_pay: number;

  // Statutory deductions
  sss_employee: number;
  sss_employer: number;
  philhealth_employee: number;
  philhealth_employer: number;
  pagibig_employee: number;
  pagibig_employer: number;
  withholding_tax: number;
  total_statutory: number;

  // Other deductions
  late_deduction: number;
  absence_deduction: number;
  cash_advance: number;
  loans: number;
  other_deductions: number;
  total_other_deductions: number;

  // Totals
  total_deductions: number;
  net_pay: number;

  // Meta
  taxable_income: number;
  daily_rate: number;
  hourly_rate: number;
}

export function computePayslip(input: PayrollInput): PayslipBreakdown {
  const monthly = input.baseSalary;
  const daysInMonth = 22; // Standard working days
  const hoursPerDay = 8;

  const dailyRate = monthly / daysInMonth;
  const hourlyRate = dailyRate / hoursPerDay;

  // Period pay (semi-monthly = half)
  const periodFactor = input.isSemiMonthly !== false ? 0.5 : 1;
  const basicPay = Math.round(monthly * periodFactor * 100) / 100;

  // Allowances
  const allowances = input.allowances || {};
  const totalAllowances = Object.values(allowances).reduce((s, v) => s + (v || 0), 0) * periodFactor;

  // Overtime
  const otPay = Math.round((input.overtimeHours || 0) * hourlyRate * 1.25 * 100) / 100;
  const holidayOTPay = Math.round((input.holidayOTHours || 0) * hourlyRate * 2.0 * 100) / 100;

  // Night differential (10% premium)
  const nightDiffPay = Math.round((input.nightDiffHours || 0) * hourlyRate * 0.10 * 100) / 100;

  const grossPay = basicPay + totalAllowances + otPay + holidayOTPay + nightDiffPay;

  // Statutory deductions (computed on MONTHLY salary, then halved for semi-monthly)
  const sss = computeSSS(monthly);
  const ph = computePhilHealth(monthly);
  const pi = computePagIBIG(monthly);

  const sssEmployee = Math.round(sss.employee * periodFactor * 100) / 100;
  const phEmployee = Math.round(ph.employee * periodFactor * 100) / 100;
  const piEmployee = Math.round(pi.employee * periodFactor * 100) / 100;

  // Taxable income = gross - statutory contributions
  const totalStatutoryMonthly = sss.employee + ph.employee + pi.employee;
  const taxableMonthly = monthly - totalStatutoryMonthly;
  const taxMonthly = computeWithholdingTax(taxableMonthly);
  const taxPeriod = Math.round(taxMonthly * periodFactor * 100) / 100;

  const totalStatutory = sssEmployee + phEmployee + piEmployee + taxPeriod;

  // Other deductions
  const other = input.otherDeductions || {};
  const lateDed = Math.round((other.lateMinutes || 0) * (hourlyRate / 60) * 100) / 100;
  const absenceDed = Math.round((other.absences || 0) * dailyRate * 100) / 100;
  const cashAdv = other.cashAdvance || 0;
  const loans = other.loans || 0;
  const otherDed = other.other || 0;
  const totalOtherDed = lateDed + absenceDed + cashAdv + loans + otherDed;

  const totalDeductions = totalStatutory + totalOtherDed;
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

  return {
    basic_pay: basicPay,
    allowances: Object.fromEntries(
      Object.entries(allowances).map(([k, v]) => [k, Math.round((v || 0) * periodFactor * 100) / 100])
    ),
    overtime_pay: otPay,
    holiday_ot_pay: holidayOTPay,
    night_diff_pay: nightDiffPay,
    gross_pay: Math.round(grossPay * 100) / 100,

    sss_employee: sssEmployee,
    sss_employer: Math.round(sss.employer * periodFactor * 100) / 100,
    philhealth_employee: phEmployee,
    philhealth_employer: Math.round(ph.employer * periodFactor * 100) / 100,
    pagibig_employee: piEmployee,
    pagibig_employer: Math.round(pi.employer * periodFactor * 100) / 100,
    withholding_tax: taxPeriod,
    total_statutory: Math.round(totalStatutory * 100) / 100,

    late_deduction: lateDed,
    absence_deduction: absenceDed,
    cash_advance: cashAdv,
    loans,
    other_deductions: otherDed,
    total_other_deductions: Math.round(totalOtherDed * 100) / 100,

    total_deductions: Math.round(totalDeductions * 100) / 100,
    net_pay: netPay,

    taxable_income: Math.round(taxableMonthly * 100) / 100,
    daily_rate: Math.round(dailyRate * 100) / 100,
    hourly_rate: Math.round(hourlyRate * 100) / 100,
  };
}

// ─── 13th Month Pay ──────────────────────────────────────────────────────────

export function compute13thMonthPay(
  monthlyBasicSalary: number,
  monthsWorked: number
): number {
  return Math.round((monthlyBasicSalary * monthsWorked / 12) * 100) / 100;
}