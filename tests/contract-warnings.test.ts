import { computeContractWarnings } from "@/lib/contracts/draft-warnings";
import type { ContractSnapshot, ExtractedContract } from "@/lib/contracts/types";

// Reusable snapshot. Fuzzy matcher reuse from lib/shared/text-match is
// exercised here too — "Pearl de Flore" matches "pearl" (substring) and
// "Renz Group" matches "Renz Group Ltd" (token-set).
const SNAPSHOT: ContractSnapshot = {
  activeProjects: [
    { id: "p1", name: "Pearl de Flore" },
    { id: "p2", name: "Manila Bay" },
  ],
  knownCounterparties: [
    { name: "Renz Group Ltd" },
    { name: "ABC Suppliers" },
  ],
};

function happy(over: Partial<ExtractedContract> = {}): ExtractedContract {
  return {
    category: "subcontractor",
    title: "Site Concrete Works",
    counterparty_name: "Renz Group Ltd",
    counterparty_contact: { name: null, email: null, phone: null },
    project_hint: "Pearl de Flore",
    signing_date: "2026-04-02",
    effective_date: "2026-04-05",
    expiration_date: "2026-12-31",
    renewal_date: null,
    is_renewable: false,
    monetary_value: 480000,
    currency: "PHP",
    summary: "Concrete works",
    confidence: 0.9,
    notes: null,
    ...over,
  };
}

describe("computeContractWarnings — happy path", () => {
  it("returns no warnings on a complete, valid contract", () => {
    const warns = computeContractWarnings(happy(), SNAPSHOT);
    expect(warns).toEqual([]);
  });
});

describe("computeContractWarnings — MISSING_COUNTERPARTY", () => {
  it("fires when counterparty_name is null", () => {
    const warns = computeContractWarnings(
      happy({ counterparty_name: null }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "MISSING_COUNTERPARTY")?.severity).toBe(
      "high"
    );
  });
  it("fires when counterparty_name is empty string", () => {
    const warns = computeContractWarnings(
      happy({ counterparty_name: "   " }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "MISSING_COUNTERPARTY")).toBeDefined();
  });
  it("does NOT fire on a real counterparty", () => {
    const warns = computeContractWarnings(happy(), SNAPSHOT);
    expect(warns.find((w) => w.code === "MISSING_COUNTERPARTY")).toBeUndefined();
  });
});

describe("computeContractWarnings — MISSING_EXPIRATION", () => {
  it("fires when expiration_date null AND not renewable", () => {
    const warns = computeContractWarnings(
      happy({ expiration_date: null, is_renewable: false }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "MISSING_EXPIRATION")?.severity).toBe(
      "high"
    );
  });
  it("does NOT fire if renewable", () => {
    const warns = computeContractWarnings(
      happy({ expiration_date: null, is_renewable: true, renewal_date: "2027-01-01" }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "MISSING_EXPIRATION")).toBeUndefined();
  });
});

describe("computeContractWarnings — EFFECTIVE_AFTER_EXPIRATION", () => {
  it("fires when effective_date > expiration_date", () => {
    const warns = computeContractWarnings(
      happy({ effective_date: "2026-12-31", expiration_date: "2026-04-05" }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "EFFECTIVE_AFTER_EXPIRATION")?.severity
    ).toBe("high");
  });
  it("does NOT fire when one side is null", () => {
    const warns = computeContractWarnings(
      happy({ effective_date: null }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "EFFECTIVE_AFTER_EXPIRATION")
    ).toBeUndefined();
  });
});

describe("computeContractWarnings — MISSING_MONETARY_VALUE", () => {
  it("fires for customer category with null monetary_value", () => {
    const warns = computeContractWarnings(
      happy({ category: "customer", monetary_value: null }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "MISSING_MONETARY_VALUE")?.severity
    ).toBe("medium");
  });
  it("fires for subcontractor category with null monetary_value", () => {
    const warns = computeContractWarnings(
      happy({ category: "subcontractor", monetary_value: null }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "MISSING_MONETARY_VALUE")).toBeDefined();
  });
  it("does NOT fire for vendor category (free-form)", () => {
    const warns = computeContractWarnings(
      happy({ category: "vendor", monetary_value: null }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "MISSING_MONETARY_VALUE")
    ).toBeUndefined();
  });
});

describe("computeContractWarnings — MONETARY_VALUE_UNUSUAL", () => {
  it("fires when value exceeds threshold (10M)", () => {
    const warns = computeContractWarnings(
      happy({ monetary_value: 99_999_999 }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "MONETARY_VALUE_UNUSUAL")?.severity
    ).toBe("low");
  });
  it("fires when value is negative", () => {
    const warns = computeContractWarnings(
      happy({ monetary_value: -100 }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "MONETARY_VALUE_UNUSUAL")).toBeDefined();
  });
  it("does NOT fire on a normal value", () => {
    const warns = computeContractWarnings(
      happy({ monetary_value: 480000 }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "MONETARY_VALUE_UNUSUAL")
    ).toBeUndefined();
  });
});

describe("computeContractWarnings — COUNTERPARTY_NOT_IN_ROSTER", () => {
  it("fires on an unknown counterparty", () => {
    const warns = computeContractWarnings(
      happy({ counterparty_name: "Totally Unknown LLC" }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "COUNTERPARTY_NOT_IN_ROSTER")?.severity
    ).toBe("medium");
  });
  it("matches via token-set (handles word reorder)", () => {
    const warns = computeContractWarnings(
      happy({ counterparty_name: "Renz Group" }),
      SNAPSHOT
    );
    expect(
      warns.find((w) => w.code === "COUNTERPARTY_NOT_IN_ROSTER")
    ).toBeUndefined();
  });
  it("does NOT fire when knownCounterparties is empty (no signal)", () => {
    const warns = computeContractWarnings(happy(), {
      ...SNAPSHOT,
      knownCounterparties: [],
    });
    expect(
      warns.find((w) => w.code === "COUNTERPARTY_NOT_IN_ROSTER")
    ).toBeUndefined();
  });
});

describe("computeContractWarnings — PROJECT_NOT_FOUND", () => {
  it("fires when project_hint doesn't match any active project", () => {
    const warns = computeContractWarnings(
      happy({ project_hint: "Made Up Tower" }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "PROJECT_NOT_FOUND")?.severity).toBe(
      "medium"
    );
  });
  it("matches via fuzzy isKnownName", () => {
    const warns = computeContractWarnings(
      happy({ project_hint: "Pearl" }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "PROJECT_NOT_FOUND")).toBeUndefined();
  });
  it("does NOT fire when project_hint is null", () => {
    const warns = computeContractWarnings(
      happy({ project_hint: null }),
      SNAPSHOT
    );
    expect(warns.find((w) => w.code === "PROJECT_NOT_FOUND")).toBeUndefined();
  });
});

describe("computeContractWarnings — combined", () => {
  it("returns multiple warnings independently", () => {
    const warns = computeContractWarnings(
      happy({
        counterparty_name: null,           // MISSING_COUNTERPARTY
        expiration_date: null,             // MISSING_EXPIRATION
        is_renewable: false,
        monetary_value: 99_999_999,        // MONETARY_VALUE_UNUSUAL
        project_hint: "no such project",   // PROJECT_NOT_FOUND
      }),
      SNAPSHOT
    );
    const codes = warns.map((w) => w.code).sort();
    expect(codes).toEqual([
      "MISSING_COUNTERPARTY",
      "MISSING_EXPIRATION",
      "MONETARY_VALUE_UNUSUAL",
      "PROJECT_NOT_FOUND",
    ]);
  });
});
