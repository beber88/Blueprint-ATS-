import { canAccessEmployeeProfile, isAdmin } from "@/lib/hr/access";

// In-memory fake Supabase client just rich enough for the access
// helpers. Keeps the test sub-millisecond and away from the real
// DB harness so the gate stays lightweight.

interface FakeProfile { id: string; role: string }
interface FakeGrant {
  user_id: string;
  employee_id: string;
  revoked_at: string | null;
  expires_at: string | null;
}

function makeClient(profiles: FakeProfile[], grants: FakeGrant[]) {
  type RowFilter = { col: string; val: unknown; op: "eq" | "is" };
  const makeBuilder = (rows: Record<string, unknown>[]) => {
    let filters: RowFilter[] = [];
    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => { filters.push({ col, val, op: "eq" }); return builder; },
      is: (col: string, val: unknown) => { filters.push({ col, val, op: "is" }); return builder; },
      maybeSingle: () => {
        const matched = rows.find((r) =>
          filters.every((f) => f.op === "is" ? r[f.col] === f.val : r[f.col] === f.val)
        );
        filters = [];
        return Promise.resolve({ data: matched ?? null });
      },
    };
    return builder;
  };

  return {
    from(table: string) {
      if (table === "user_profiles") return makeBuilder(profiles as unknown as Record<string, unknown>[]);
      if (table === "hr_profile_grants") return makeBuilder(grants as unknown as Record<string, unknown>[]);
      throw new Error("unknown table: " + table);
    },
  };
}

const EMP = "00000000-0000-0000-0000-000000000aaa";
const USER_ADMIN = "user-admin";
const USER_HR = "user-hr";
const USER_USER = "user-user";

describe("canAccessEmployeeProfile", () => {
  it("returns false for empty userId or employeeId", async () => {
    const c = makeClient([], []) as never;
    expect(await canAccessEmployeeProfile(c, "", EMP)).toBe(false);
    expect(await canAccessEmployeeProfile(c, USER_USER, "")).toBe(false);
  });

  it("admin always passes", async () => {
    const c = makeClient(
      [{ id: USER_ADMIN, role: "admin" }],
      []
    ) as never;
    expect(await canAccessEmployeeProfile(c, USER_ADMIN, EMP)).toBe(true);
  });

  it("hr role always passes", async () => {
    const c = makeClient(
      [{ id: USER_HR, role: "hr" }],
      []
    ) as never;
    expect(await canAccessEmployeeProfile(c, USER_HR, EMP)).toBe(true);
  });

  it("plain user with no grant is denied", async () => {
    const c = makeClient(
      [{ id: USER_USER, role: "user" }],
      []
    ) as never;
    expect(await canAccessEmployeeProfile(c, USER_USER, EMP)).toBe(false);
  });

  it("plain user with an active grant passes", async () => {
    const c = makeClient(
      [{ id: USER_USER, role: "user" }],
      [{ user_id: USER_USER, employee_id: EMP, revoked_at: null, expires_at: null }]
    ) as never;
    expect(await canAccessEmployeeProfile(c, USER_USER, EMP)).toBe(true);
  });

  it("plain user with a revoked grant is denied", async () => {
    const c = makeClient(
      [{ id: USER_USER, role: "user" }],
      [
        // revoked: filtered out at query-time (is('revoked_at', null) skips it)
        { user_id: USER_USER, employee_id: EMP, revoked_at: "2026-01-01", expires_at: null },
      ]
    ) as never;
    expect(await canAccessEmployeeProfile(c, USER_USER, EMP)).toBe(false);
  });

  it("plain user with an expired grant is denied", async () => {
    const c = makeClient(
      [{ id: USER_USER, role: "user" }],
      [{ user_id: USER_USER, employee_id: EMP, revoked_at: null, expires_at: "2020-01-01T00:00:00Z" }]
    ) as never;
    expect(await canAccessEmployeeProfile(c, USER_USER, EMP)).toBe(false);
  });

  it("unknown user (no profile row) is denied", async () => {
    const c = makeClient([], []) as never;
    expect(await canAccessEmployeeProfile(c, USER_USER, EMP)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true only for role=admin", async () => {
    const cAdmin = makeClient([{ id: USER_ADMIN, role: "admin" }], []) as never;
    expect(await isAdmin(cAdmin, USER_ADMIN)).toBe(true);

    const cHr = makeClient([{ id: USER_HR, role: "hr" }], []) as never;
    expect(await isAdmin(cHr, USER_HR)).toBe(false);

    const cMissing = makeClient([], []) as never;
    expect(await isAdmin(cMissing, "ghost")).toBe(false);

    expect(await isAdmin(cAdmin, "")).toBe(false);
  });
});
