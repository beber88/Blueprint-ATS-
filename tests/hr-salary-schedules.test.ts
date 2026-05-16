import { applySalarySchedule, cancelSalarySchedule } from "@/lib/hr/salary";

// In-memory fake Supabase tailored to the salary helpers. The chain
// itself is a thenable so `await supabase.from(t).update(p).eq(...)`
// resolves to { data, error } the way supabase-js does.

type Row = Record<string, unknown>;
type Filter = { col: string; val: unknown; op: "eq" | "is" };

interface State {
  hr_salary_schedules: Row[];
  hr_salary: Row[];
}

function makeClient() {
  const state: State = { hr_salary_schedules: [], hr_salary: [] };
  let nextId = 1;

  function tableBuilder(name: keyof State) {
    const filters: Filter[] = [];
    let mode: "select" | "insert" | "update" = "select";
    let patch: Row | undefined;
    let pendingInsert: Row[] = [];
    let selected = false;

    const matchRow = (r: Row) =>
      filters.every((f) => (f.op === "is" ? r[f.col] === f.val : r[f.col] === f.val));

    const exec = (): { data: Row[]; error: null } => {
      if (mode === "insert") return { data: pendingInsert, error: null };
      if (mode === "update") {
        const matched = state[name].filter(matchRow);
        for (const r of matched) Object.assign(r, patch);
        return { data: matched, error: null };
      }
      return { data: state[name].filter(matchRow), error: null };
    };

    const builder: Record<string, unknown> = {
      select() { selected = true; return builder; },
      eq(col: string, val: unknown) { filters.push({ col, val, op: "eq" }); return builder; },
      is(col: string, val: unknown) { filters.push({ col, val, op: "is" }); return builder; },
      insert(row: Row | Row[]) {
        mode = "insert";
        const list = Array.isArray(row) ? row : [row];
        pendingInsert = list.map((r) => ({ id: `id-${nextId++}`, ...r }));
        state[name].push(...pendingInsert);
        return builder;
      },
      update(p: Row) { mode = "update"; patch = p; return builder; },
      async single() {
        const { data } = exec();
        return { data: data[0] ?? null, error: null };
      },
      async maybeSingle() {
        const { data } = exec();
        return { data: data[0] ?? null, error: null };
      },
      // thenable so `await supabase.from(t).update(p).eq(...)` works
      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
        void selected;
        return Promise.resolve(exec()).then(resolve);
      },
    };
    return builder;
  }

  return {
    state,
    from(name: string) {
      return tableBuilder(name as keyof State) as never;
    },
  };
}

const EMP = "emp-1";

describe("applySalarySchedule", () => {
  it("inserts an hr_salary row AND flips the schedule to applied", async () => {
    const c = makeClient();
    c.state.hr_salary_schedules.push({
      id: "sched-1",
      employee_id: EMP,
      scheduled_date: "2026-06-01",
      expected_amount: 50000,
      currency: "PHP",
      reason: "annual",
      status: "pending",
      applied_at: null,
      applied_salary_id: null,
      created_by: null,
    });

    const result = await applySalarySchedule(c as never, "sched-1");
    expect(result.scheduleId).toBe("sched-1");
    expect(c.state.hr_salary).toHaveLength(1);
    const salaryRow = c.state.hr_salary[0];
    expect(salaryRow.employee_id).toBe(EMP);
    expect(salaryRow.base_salary).toBe(50000);
    expect(salaryRow.effective_date).toBe("2026-06-01");

    const sched = c.state.hr_salary_schedules[0];
    expect(sched.status).toBe("applied");
    expect(sched.applied_at).toBeTruthy();
    expect(sched.applied_salary_id).toBe(salaryRow.id);
  });

  it("throws when schedule is not found", async () => {
    const c = makeClient();
    await expect(applySalarySchedule(c as never, "ghost")).rejects.toThrow(/not found/);
  });

  it("throws when schedule is not pending", async () => {
    const c = makeClient();
    c.state.hr_salary_schedules.push({
      id: "sched-2",
      employee_id: EMP,
      scheduled_date: "2026-06-01",
      expected_amount: 50000,
      currency: null,
      reason: null,
      status: "applied",
      applied_at: "2026-05-01T00:00:00Z",
      applied_salary_id: "x",
      created_by: null,
    });
    await expect(applySalarySchedule(c as never, "sched-2")).rejects.toThrow(/not pending/);
    expect(c.state.hr_salary).toHaveLength(0);
  });
});

describe("cancelSalarySchedule", () => {
  it("flips a pending schedule to cancelled", async () => {
    const c = makeClient();
    c.state.hr_salary_schedules.push({
      id: "sched-3",
      employee_id: EMP,
      scheduled_date: "2026-06-01",
      expected_amount: 50000,
      currency: null,
      reason: null,
      status: "pending",
      applied_at: null,
      applied_salary_id: null,
      created_by: null,
    });
    await cancelSalarySchedule(c as never, "sched-3");
    expect(c.state.hr_salary_schedules[0].status).toBe("cancelled");
  });

  it("propagates underlying errors as Error('Failed to cancel ...')", async () => {
    // Fake client that always returns an update error.
    const c = {
      from() {
        return {
          update() {
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ error: { message: "constraint x" } });
                  },
                };
              },
            };
          },
        };
      },
    };
    await expect(cancelSalarySchedule(c as never, "x")).rejects.toThrow(/Failed to cancel/);
  });
});

describe("applySalarySchedule error paths", () => {
  it("propagates fetchErr from hr_salary_schedules select", async () => {
    const c = {
      from(table: string) {
        if (table === "hr_salary_schedules") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: { message: "pg ouch" } }),
                  };
                },
              };
            },
          };
        }
        throw new Error("unexpected table " + table);
      },
    };
    await expect(applySalarySchedule(c as never, "sched-err")).rejects.toThrow(
      /Failed to load salary schedule.*pg ouch/
    );
  });

  it("propagates insertErr from hr_salary insert", async () => {
    let calls = 0;
    const c = {
      from(table: string) {
        calls += 1;
        if (table === "hr_salary_schedules" && calls === 1) {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "s",
                          employee_id: EMP,
                          scheduled_date: "2026-06-01",
                          expected_amount: 1,
                          currency: null,
                          reason: null,
                          status: "pending",
                          applied_at: null,
                          applied_salary_id: null,
                          created_by: null,
                        },
                        error: null,
                      }),
                  };
                },
              };
            },
          };
        }
        if (table === "hr_salary") {
          return {
            insert() {
              return {
                select() {
                  return {
                    single: () =>
                      Promise.resolve({ data: null, error: { message: "insert blew up" } }),
                  };
                },
              };
            },
          };
        }
        throw new Error("unexpected table " + table);
      },
    };
    await expect(applySalarySchedule(c as never, "s")).rejects.toThrow(/Failed to insert hr_salary/);
  });

  it("propagates updateErr when schedule flip fails after salary insert", async () => {
    let salaryCall = false;
    const c = {
      from(table: string) {
        if (table === "hr_salary_schedules" && !salaryCall) {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "s",
                          employee_id: EMP,
                          scheduled_date: "2026-06-01",
                          expected_amount: 1,
                          currency: "USD",
                          reason: "test",
                          status: "pending",
                          applied_at: null,
                          applied_salary_id: null,
                          created_by: "creator",
                        },
                        error: null,
                      }),
                  };
                },
              };
            },
          };
        }
        if (table === "hr_salary") {
          salaryCall = true;
          return {
            insert() {
              return {
                select() {
                  return { single: () => Promise.resolve({ data: { id: "new-sal" }, error: null }) };
                },
              };
            },
          };
        }
        if (table === "hr_salary_schedules" && salaryCall) {
          return {
            update() {
              return {
                eq() {
                  return {
                    eq: () => Promise.resolve({ error: { message: "update kaput" } }),
                  };
                },
              };
            },
          };
        }
        throw new Error("unexpected " + table);
      },
    };
    await expect(applySalarySchedule(c as never, "s", "applier")).rejects.toThrow(
      /Salary inserted but schedule status update failed/
    );
  });
});
