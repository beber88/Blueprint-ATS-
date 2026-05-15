/**
 * Philippine statutory payroll computation (employee share).
 *
 * Rates reflect the contribution tables in force for 2024+:
 *  - SSS: 4.5% employee share of the Monthly Salary Credit (MSC),
 *    MSC clamped to the ₱4,000–₱30,000 range.
 *  - PhilHealth: 5% premium shared equally (2.5% employee), salary
 *    floor ₱10,000, ceiling ₱100,000.
 *  - Pag-IBIG (HDMF): 2% employee share, contribution capped at ₱100.
 *  - Withholding tax: TRAIN-law monthly graduated table.
 *
 * These are statutory constants for a PH-based employer; they are
 * intentionally not configurable per-employee. Employee-specific
 * additions/deductions come from hr_salary.allowances / .deductions.
 */

export interface StatutoryBreakdown {
  sss: number;
  philhealth: number;
  pagibig: number;
  withholding_tax: number;
  total: number;
}

export interface PayslipBreakdown {
  base_salary: number;
  allowances: { label: string; amount: number }[];
  allowances_total: number;
  gross_pay: number;
  statutory: StatutoryBreakdown;
  other_deductions: { label: string; amount: number }[];
  other_deductions_total: number;
  total_deductions: number;
  net_pay: number;
  currency: string;
  computed_at: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function computeSSS(monthlyBasic: number): number {
  const msc = clamp(monthlyBasic, 4000, 30000);
  return round2(msc * 0.045);
}

export function computePhilHealth(monthlyBasic: number): number {
  const base = clamp(monthlyBasic, 10000, 100000);
  return round2(base * 0.05 * 0.5);
}

export function computePagIbig(monthlyBasic: number): number {
  return round2(Math.min(monthlyBasic * 0.02, 100));
}

/** TRAIN-law monthly graduated withholding tax. */
export function computeWithholdingTax(monthlyTaxable: number): number {
  if (monthlyTaxable <= 20833) return 0;
  if (monthlyTaxable <= 33332) return round2((monthlyTaxable - 20833) * 0.15);
  if (monthlyTaxable <= 66666) return round2(2500 + (monthlyTaxable - 33333) * 0.2);
  if (monthlyTaxable <= 166666) return round2(10833.33 + (monthlyTaxable - 66667) * 0.25);
  if (monthlyTaxable <= 666666) return round2(35916.67 + (monthlyTaxable - 166667) * 0.3);
  return round2(200833.33 + (monthlyTaxable - 666667) * 0.35);
}

function sumJsonbAmounts(
  obj: Record<string, unknown> | null | undefined
): { label: string; amount: number }[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .map(([label, raw]) => {
      const amount = typeof raw === "number" ? raw : Number(raw);
      return { label, amount: Number.isFinite(amount) ? amount : 0 };
    })
    .filter((e) => e.amount !== 0);
}

export function buildPayslipBreakdown(salary: {
  base_salary: number;
  currency: string;
  allowances: Record<string, unknown> | null;
  deductions: Record<string, unknown> | null;
}): PayslipBreakdown {
  const baseSalary = Number(salary.base_salary) || 0;

  const allowances = sumJsonbAmounts(salary.allowances);
  const allowancesTotal = round2(allowances.reduce((s, a) => s + a.amount, 0));

  const grossPay = round2(baseSalary + allowancesTotal);

  const sss = computeSSS(baseSalary);
  const philhealth = computePhilHealth(baseSalary);
  const pagibig = computePagIbig(baseSalary);

  // Statutory contributions are deductible before withholding tax.
  const taxableIncome = Math.max(grossPay - sss - philhealth - pagibig, 0);
  const withholdingTax = computeWithholdingTax(taxableIncome);

  const statutory: StatutoryBreakdown = {
    sss,
    philhealth,
    pagibig,
    withholding_tax: withholdingTax,
    total: round2(sss + philhealth + pagibig + withholdingTax),
  };

  const otherDeductions = sumJsonbAmounts(salary.deductions);
  const otherDeductionsTotal = round2(
    otherDeductions.reduce((s, d) => s + d.amount, 0)
  );

  const totalDeductions = round2(statutory.total + otherDeductionsTotal);
  const netPay = round2(grossPay - totalDeductions);

  return {
    base_salary: baseSalary,
    allowances,
    allowances_total: allowancesTotal,
    gross_pay: grossPay,
    statutory,
    other_deductions: otherDeductions,
    other_deductions_total: otherDeductionsTotal,
    total_deductions: totalDeductions,
    net_pay: netPay,
    currency: salary.currency || "PHP",
    computed_at: new Date().toISOString(),
  };
}
