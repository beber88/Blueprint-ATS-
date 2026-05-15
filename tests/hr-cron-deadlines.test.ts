import {
  planEmployeeDeadlineAlerts,
  runEmployeeDeadlineScan,
  type ComplianceRow,
  type SalaryScheduleRow,
  type EmploymentContractRow,
  type DocumentRow,
} from "@/lib/hr/cron-deadlines";

// Pure unit tests — no DB needed. Validates the planner branches
// fire on the right dates. The runner's side-effect-on-insert
// idempotency is covered by the partial-unique index in migration
// 012 and exercised end-to-end in the lifecycle test.

const TODAY = new Date("2026-05-15T00:00:00Z");
const EMP = "00000000-0000-0000-0000-000000000001";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): string {
  return iso(new Date(date.getTime() + days * 86_400_000));
}

describe("planEmployeeDeadlineAlerts", () => {
  it("flags compliance_expired for records past expiry with status=valid", () => {
    const compliance: Array<ComplianceRow & { id?: string }> = [
      { id: "c1", employee_id: EMP, expiry_date: addDays(TODAY, -10), status: "valid" },
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance, schedules: [], contracts: [], documents: [],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe("compliance_expired");
    expect(planned[0].severity).toBe("high");
    expect(planned[0].flipComplianceToExpired?.compliance_id).toBe("c1");
  });

  it("does NOT flag compliance_expired when status is already expired", () => {
    const compliance: ComplianceRow[] = [
      { employee_id: EMP, expiry_date: addDays(TODAY, -10), status: "expired" },
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance, schedules: [], contracts: [], documents: [],
    });
    expect(planned).toHaveLength(0);
  });

  it("flags compliance_expiring for records expiring in [today, today+30]", () => {
    const compliance: ComplianceRow[] = [
      { employee_id: EMP, expiry_date: addDays(TODAY, 10), status: "valid" },
      { employee_id: EMP, expiry_date: addDays(TODAY, 60), status: "valid" }, // outside
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance, schedules: [], contracts: [], documents: [],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe("compliance_expiring");
    expect(planned[0].severity).toBe("medium");
  });

  it("flags salary_increase_due for pending schedules at or before today", () => {
    const schedules: SalaryScheduleRow[] = [
      { employee_id: EMP, scheduled_date: addDays(TODAY, -1), status: "pending" },
      { employee_id: EMP, scheduled_date: addDays(TODAY, 5), status: "pending" }, // future, no alert
      { employee_id: EMP, scheduled_date: addDays(TODAY, -5), status: "applied" }, // not pending, skip
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance: [], schedules, contracts: [], documents: [],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe("salary_increase_due");
  });

  it("flags contract_expiring for active contracts ending in [today, today+30]", () => {
    const contracts: EmploymentContractRow[] = [
      {
        employee_id: EMP, end_date: addDays(TODAY, 20), status: "active",
        start_date: addDays(TODAY, -365), probation_period_days: null,
      },
      {
        employee_id: EMP, end_date: addDays(TODAY, 20), status: "expired",
        start_date: addDays(TODAY, -365), probation_period_days: null,
      },
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance: [], schedules: [], contracts, documents: [],
    });
    const expiring = planned.filter((p) => p.type === "contract_expiring");
    expect(expiring).toHaveLength(1);
  });

  it("flags probation_ending for active contracts whose probation ends in [today, today+14]", () => {
    // Start 80 days ago + 90-day probation → probation ends in 10 days. Hit.
    const contracts: EmploymentContractRow[] = [
      {
        employee_id: EMP,
        start_date: addDays(TODAY, -80),
        end_date: null,
        status: "active",
        probation_period_days: 90,
      },
      // Start 100 days ago + 90-day probation → probation ended 10 days ago. Miss.
      {
        employee_id: EMP,
        start_date: addDays(TODAY, -100),
        end_date: null,
        status: "active",
        probation_period_days: 90,
      },
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance: [], schedules: [], contracts, documents: [],
    });
    const probation = planned.filter((p) => p.type === "probation_ending");
    expect(probation).toHaveLength(1);
  });

  it("flags document_expiring for documents in [today, today+30] only", () => {
    const documents: DocumentRow[] = [
      { employee_id: EMP, expiry_date: addDays(TODAY, 5) },
      { employee_id: EMP, expiry_date: addDays(TODAY, 31) }, // just outside
      { employee_id: EMP, expiry_date: null }, // null skip
    ];
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance: [], schedules: [], contracts: [], documents,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe("document_expiring");
    expect(planned[0].severity).toBe("low");
  });

  it("emits nothing on an empty snapshot", () => {
    const planned = planEmployeeDeadlineAlerts({
      today: TODAY, compliance: [], schedules: [], contracts: [], documents: [],
    });
    expect(planned).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// runEmployeeDeadlineScan — side-effecting wrapper, exercised with a
// minimal fake Supabase that records inserts and updates.
// ──────────────────────────────────────────────────────────────────

type FakeRow = Record<string, unknown>;
interface FakeState {
  hr_compliance_records: FakeRow[];
  hr_salary_schedules: FakeRow[];
  hr_employment_contracts: FakeRow[];
  hr_employee_documents: FakeRow[];
  hr_alerts: FakeRow[];
}

function makeScanClient(state: FakeState) {
  return {
    from(table: keyof FakeState | string) {
      const rows = (state as Record<string, FakeRow[]>)[table] ?? [];
      const filters: { col: string; val: unknown; op: "eq" | "is" | "in" }[] = [];
      let mode: "select" | "insert" | "update" = "select";
      let patch: FakeRow | undefined;
      let inserted: FakeRow[] = [];

      const matchRow = (r: FakeRow) =>
        filters.every((f) => {
          if (f.op === "in") return Array.isArray(f.val) && f.val.includes(r[f.col]);
          // .is('col', null) should match when the field is null OR undefined
          if (f.op === "is" && f.val === null) return r[f.col] === null || r[f.col] === undefined;
          return r[f.col] === f.val;
        });

      const exec = () => {
        if (mode === "insert") return { data: inserted, error: null };
        if (mode === "update") {
          const matched = rows.filter(matchRow);
          for (const r of matched) Object.assign(r, patch);
          return { data: matched, error: null };
        }
        return { data: rows.filter(matchRow), error: null };
      };

      const b: Record<string, unknown> = {
        select() { return b; },
        eq(col: string, val: unknown) { filters.push({ col, val, op: "eq" }); return b; },
        is(col: string, val: unknown) { filters.push({ col, val, op: "is" }); return b; },
        in(col: string, val: unknown) { filters.push({ col, val, op: "in" }); return b; },
        insert(row: FakeRow) {
          mode = "insert";
          const r = { id: `id-${Math.random().toString(36).slice(2)}`, ...row };
          rows.push(r);
          inserted = [r];
          return b;
        },
        update(p: FakeRow) { mode = "update"; patch = p; return b; },
        async single() {
          const { data } = exec();
          return { data: data[0] ?? null, error: null };
        },
        async maybeSingle() {
          const { data } = exec();
          return { data: data[0] ?? null, error: null };
        },
        then(resolve: (v: { data: FakeRow[]; error: null }) => unknown) {
          return Promise.resolve(exec()).then(resolve);
        },
      };
      return b;
    },
  };
}

describe("runEmployeeDeadlineScan", () => {
  it("creates alerts on first run, zero on second (idempotent via dedup)", async () => {
    const state: FakeState = {
      hr_compliance_records: [
        { id: "c-exp", employee_id: EMP, expiry_date: addDays(TODAY, -1), status: "valid" },
        { id: "c-soon", employee_id: EMP, expiry_date: addDays(TODAY, 5), status: "valid" },
      ],
      hr_salary_schedules: [
        { employee_id: EMP, scheduled_date: addDays(TODAY, -1), status: "pending" },
      ],
      hr_employment_contracts: [
        {
          employee_id: EMP,
          end_date: addDays(TODAY, 10),
          status: "active",
          start_date: addDays(TODAY, -200),
          probation_period_days: null,
        },
      ],
      hr_employee_documents: [
        { employee_id: EMP, expiry_date: addDays(TODAY, 15) },
      ],
      hr_alerts: [],
    };

    const c = makeScanClient(state);
    const first = await runEmployeeDeadlineScan(c as never, TODAY);
    expect(first.alertsCreated).toBeGreaterThanOrEqual(4);
    expect(first.alertsPlanned).toBeGreaterThanOrEqual(4);
    expect(first.complianceFlipped).toBe(1); // the expired record

    // Second invocation should not create more alerts.
    const second = await runEmployeeDeadlineScan(c as never, TODAY);
    expect(second.alertsCreated).toBe(0);
    expect(state.hr_alerts.length).toBe(first.alertsCreated);
  });

  it("handles an empty database gracefully", async () => {
    const state: FakeState = {
      hr_compliance_records: [],
      hr_salary_schedules: [],
      hr_employment_contracts: [],
      hr_employee_documents: [],
      hr_alerts: [],
    };
    const c = makeScanClient(state);
    const result = await runEmployeeDeadlineScan(c as never, TODAY);
    expect(result.alertsPlanned).toBe(0);
    expect(result.alertsCreated).toBe(0);
    expect(result.complianceFlipped).toBe(0);
  });
});
