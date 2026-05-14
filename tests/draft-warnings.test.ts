import { computeWarnings, type MasterDataSnapshot, type AiOutput, type AiItem, type Warning } from "@/lib/operations/draft-warnings";

const TODAY = new Date().toISOString().slice(0, 10);

const SNAPSHOT: MasterDataSnapshot = {
  activeProjects: [
    { id: "p1", name: "Pearl de Flore" },
    { id: "p2", name: "Fixifoot" },
  ],
  activeEmployees: [
    { id: "e1", full_name: "Eric (Enrique Masangkay)" },
    { id: "e2", full_name: "Daff" },
  ],
};

function happy(over: Partial<AiOutput> = {}): AiOutput {
  return {
    report_date: TODAY,
    project_id: "p1",
    summary: "Today everything moved on schedule",
    items: [
      {
        issue: "Smoke detector commissioning completed",
        project: "Pearl de Flore",
        person_responsible: "Daff",
        category: "project",
        ceo_decision_needed: false,
      },
    ],
    ceo_action_items: [],
    ...over,
  };
}

describe("computeWarnings — 8 rule codes", () => {
  it("happy path: no warnings", () => {
    expect(computeWarnings(happy(), SNAPSHOT)).toEqual([]);
  });

  it("MISSING_DATE: report_date missing → high", () => {
    const w = computeWarnings(happy({ report_date: null as unknown as undefined }), SNAPSHOT);
    expect(w.find((x) => x.code === "MISSING_DATE")?.severity).toBe("high");
  });

  it("MISSING_DATE: report_date malformed → high", () => {
    const w = computeWarnings(happy({ report_date: "yesterday" }), SNAPSHOT);
    expect(w.find((x) => x.code === "MISSING_DATE")?.severity).toBe("high");
  });

  it("DATE_OUT_OF_RANGE: 2020-01-01 is too early → high", () => {
    const w = computeWarnings(happy({ report_date: "2020-01-01" }), SNAPSHOT);
    expect(w.find((x) => x.code === "DATE_OUT_OF_RANGE")?.severity).toBe("high");
  });

  it("DATE_OUT_OF_RANGE: 2099-12-31 is too late → high", () => {
    const w = computeWarnings(happy({ report_date: "2099-12-31" }), SNAPSHOT);
    expect(w.find((x) => x.code === "DATE_OUT_OF_RANGE")?.severity).toBe("high");
  });

  it("MISSING_PROJECT: no project_id and no project_name → high", () => {
    const w = computeWarnings(happy({ project_id: null, project_name: null }), SNAPSHOT);
    expect(w.find((x) => x.code === "MISSING_PROJECT")?.severity).toBe("high");
  });

  it("MISSING_PROJECT: project_name set without project_id is OK", () => {
    const w = computeWarnings(
      happy({ project_id: null, project_name: "Pearl de Flore" }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "MISSING_PROJECT")).toBeUndefined();
  });

  it("MISSING_SUMMARY: no summary AND no items → medium", () => {
    const w = computeWarnings(
      happy({ summary: null, items: [] }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "MISSING_SUMMARY")?.severity).toBe("medium");
  });

  it("MISSING_SUMMARY: not raised when items exist", () => {
    const w = computeWarnings(happy({ summary: null }), SNAPSHOT);
    expect(w.find((x) => x.code === "MISSING_SUMMARY")).toBeUndefined();
  });

  it("UNKNOWN_PROJECT: an item references a non-active project → high", () => {
    const w = computeWarnings(
      happy({
        items: [
          {
            issue: "x",
            project: "Made Up Project",
            person_responsible: "Daff",
            category: "project",
          },
        ],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "UNKNOWN_PROJECT")?.severity).toBe("high");
  });

  it("UNKNOWN_PROJECT: fuzzy substring match counts as known", () => {
    const w = computeWarnings(
      happy({
        items: [{ issue: "x", project: "Pearl", person_responsible: "Daff" }],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "UNKNOWN_PROJECT")).toBeUndefined();
  });

  it("UNKNOWN_EMPLOYEE: an item references a non-active employee → medium", () => {
    const w = computeWarnings(
      happy({
        items: [
          { issue: "x", project: "Pearl de Flore", person_responsible: "Nobody Real" },
        ],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")?.severity).toBe("medium");
  });

  it("UNKNOWN_EMPLOYEE: 'Eric' matches 'Eric (Enrique Masangkay)'", () => {
    const w = computeWarnings(
      happy({
        items: [{ issue: "x", project: "Pearl de Flore", person_responsible: "Eric" }],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });

  it("CEO_ACTIONS_MISMATCH: section present but no per-item flag → medium", () => {
    const w = computeWarnings(
      happy({
        ceo_action_items: [{ issue: "approve genset", ceo_decision_needed: true }],
        items: [{ issue: "x", project: "Pearl de Flore", ceo_decision_needed: false }],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "CEO_ACTIONS_MISMATCH")?.severity).toBe("medium");
  });

  it("CEO_ACTIONS_MISMATCH: per-item flag set but no section → medium", () => {
    const w = computeWarnings(
      happy({
        ceo_action_items: [],
        items: [{ issue: "x", project: "Pearl de Flore", ceo_decision_needed: true }],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "CEO_ACTIONS_MISMATCH")?.severity).toBe("medium");
  });

  it("INVALID_ATTENDANCE_STATUS: attendance item with bogus status → low", () => {
    const w = computeWarnings(
      happy({
        items: [
          {
            issue: "Adrian came in late",
            project: "Pearl de Flore",
            person_responsible: "Daff",
            category: "attendance",
            attendance_status: "ghosted",
          },
        ],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "INVALID_ATTENDANCE_STATUS")?.severity).toBe("low");
  });

  it("INVALID_ATTENDANCE_STATUS: not raised for non-attendance items", () => {
    const w = computeWarnings(
      happy({
        items: [
          {
            issue: "x",
            project: "Pearl de Flore",
            category: "project",
            attendance_status: "ghosted", // ignored: category isn't attendance
          },
        ],
      }),
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "INVALID_ATTENDANCE_STATUS")).toBeUndefined();
  });
});

describe("computeWarnings — combined / order-independence", () => {
  it("multiple warnings raised independently", () => {
    const w = computeWarnings(
      {
        report_date: "2020-01-01", // out of range + valid format
        project_id: null,
        project_name: null,
        items: [
          {
            issue: "x",
            project: "Fake project",
            person_responsible: "Nobody",
            category: "attendance",
            attendance_status: "ghosted",
            ceo_decision_needed: false,
          },
        ],
        ceo_action_items: [{ issue: "approve" }],
      },
      SNAPSHOT
    );
    const codes = w.map((x) => x.code).sort();
    expect(codes).toEqual([
      "CEO_ACTIONS_MISMATCH",
      "DATE_OUT_OF_RANGE",
      "INVALID_ATTENDANCE_STATUS",
      "MISSING_PROJECT",
      "UNKNOWN_EMPLOYEE",
      "UNKNOWN_PROJECT",
    ]);
  });

  it("warnings include the field path for UI scroll-to", () => {
    const w = computeWarnings(
      happy({
        items: [
          { issue: "x", project: "Pearl de Flore", person_responsible: "Daff" },
          { issue: "y", project: "Fake", person_responsible: "Daff" },
        ],
      }),
      SNAPSHOT
    );
    expect(w[0].field).toBe("items[1].project");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Matcher canonicalization — PMs write the same name a dozen different
// ways. Cmd 7 verification surfaced "4 Storey" vs "4-Storey Pampanga"
// silently mismatching because the matcher didn't normalize punctuation.
// These cases nail down the canonicalization contract.
// ─────────────────────────────────────────────────────────────────────────────
describe("computeWarnings — matcher punctuation canonicalization", () => {
  const PUNCT_SNAPSHOT: MasterDataSnapshot = {
    activeProjects: [
      { id: "p-storey", name: "4-Storey Pampanga" },
      { id: "p-pearl", name: "Pearl de Flore" },
    ],
    activeEmployees: [
      { id: "e-mc",       full_name: "Marie Cris Millete (MC)" },
      { id: "e-mendevil", full_name: "Christian S. Mendevil" },
      { id: "e-jon",      full_name: "Jon Carlo Orencia" },
      { id: "e-dsouza",   full_name: "Aaron D'Souza" },
    ],
  };

  function probe(itemOverrides: Partial<AiItem>): Warning[] {
    return computeWarnings(
      {
        report_date: TODAY,
        project_id: "p-pearl",
        summary: "x",
        items: [
          {
            issue: "x",
            ...itemOverrides,
          },
        ],
        ceo_action_items: [],
      },
      PUNCT_SNAPSHOT
    );
  }

  it("'4 Storey' matches '4-Storey Pampanga' (the cmd-7 finding)", () => {
    const w = probe({ project: "4 Storey", person_responsible: "Marie Cris Millete (MC)" });
    expect(w.find((x) => x.code === "UNKNOWN_PROJECT")).toBeUndefined();
  });

  it("'4-storey project' matches '4-Storey Pampanga'", () => {
    const w = probe({ project: "4-storey project", person_responsible: "Marie Cris Millete (MC)" });
    expect(w.find((x) => x.code === "UNKNOWN_PROJECT")).toBeUndefined();
  });

  it("'MC Millete' matches 'Marie Cris Millete (MC)' (parens preserved by upstream substring)", () => {
    const w = probe({ project: "Pearl de Flore", person_responsible: "MC Millete" });
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });

  it("apostrophe in 'D'Souza' is preserved (not stripped to 'd souza')", () => {
    const w = probe({ project: "Pearl de Flore", person_responsible: "D'Souza" });
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });

  it("slash separator 'Mendevil/Christian' matches 'Christian S. Mendevil'", () => {
    const w = probe({ project: "Pearl de Flore", person_responsible: "Mendevil/Christian" });
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });

  it("collapses runs of whitespace: 'Jon  Carlo   Orencia' matches 'Jon Carlo Orencia'", () => {
    const w = probe({ project: "Pearl de Flore", person_responsible: "Jon  Carlo   Orencia" });
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });

  it("still raises UNKNOWN_PROJECT for a truly unknown project (canonicalize doesn't make false positives)", () => {
    const w = probe({ project: "Made-Up Project", person_responsible: "Marie Cris Millete (MC)" });
    expect(w.find((x) => x.code === "UNKNOWN_PROJECT")?.severity).toBe("high");
  });

  // ── Stopword false-positive guard ────────────────────────────────────
  // Without stopword filtering "Storey Spa Project" would (via the
  // shared token "project") collide with "4-Storey Pampanga". With
  // "project" filtered: {storey, spa} vs {storey, pampanga} — no
  // subset match, substring fallback also fails → UNKNOWN_PROJECT
  // correctly fires.
  it("'Storey Spa Project' does NOT match '4-Storey Pampanga' (stopword guard)", () => {
    const w = probe({ project: "Storey Spa Project", person_responsible: "Marie Cris Millete (MC)" });
    expect(w.find((x) => x.code === "UNKNOWN_PROJECT")?.severity).toBe("high");
  });

  // Single-token edge case: matcher must still handle a one-word name
  // that exactly matches a one-word master entry. Uses the original
  // SNAPSHOT so "Daff" matches "Daff".
  it("single-token 'Daff' still matches 'Daff' in the master roster", () => {
    const w = computeWarnings(
      {
        report_date: TODAY,
        project_id: "p1",
        items: [{ issue: "x", project: "Pearl de Flore", person_responsible: "Daff" }],
        ceo_action_items: [],
      },
      SNAPSHOT
    );
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });

  // Middle-initial: "S" is filtered by the length≥2 token rule, so
  // {john, smith} matches {john, smith}. This is the same logic that
  // makes "Christian S. Mendevil" matchable.
  it("middle initial: 'John S Smith' matches 'John Smith' (length<2 filter)", () => {
    const w = computeWarnings(
      {
        report_date: TODAY,
        project_id: "p-pearl",
        items: [{ issue: "x", project: "Pearl de Flore", person_responsible: "John S Smith" }],
        ceo_action_items: [],
      },
      {
        activeProjects: [{ id: "p-pearl", name: "Pearl de Flore" }],
        activeEmployees: [{ id: "e-john", full_name: "John Smith" }],
      }
    );
    expect(w.find((x) => x.code === "UNKNOWN_EMPLOYEE")).toBeUndefined();
  });
});
