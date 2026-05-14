import { BULK_IMPORT_MAX_REPORTS } from "@/lib/operations/bulk-import";
import { splitReports } from "@/lib/operations/bulk-split";

describe("BULK_IMPORT_MAX_REPORTS hard cap", () => {
  it("default cap is 200", () => {
    // Test runs without BULK_IMPORT_MAX_REPORTS set in env.
    expect(BULK_IMPORT_MAX_REPORTS).toBe(200);
  });

  it("a paste of 201 reports is detected as cap-exceeded", () => {
    // Build 201 self-contained, dated, length-passing reports.
    const lines: string[] = [];
    for (let i = 0; i < 201; i++) {
      const day = (i % 28) + 1;
      const month = (Math.floor(i / 28) % 12) + 1;
      const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      lines.push(`Date: ${date}`);
      lines.push(`Report body number ${i}. ` + "x".repeat(120));
      lines.push("");
    }
    const text = lines.join("\n");
    const chunks = splitReports(text);
    expect(chunks.length).toBeGreaterThan(BULK_IMPORT_MAX_REPORTS);
    expect(chunks.length).toBe(201);

    // This is the gate the preview + run endpoints enforce:
    const capExceeded = chunks.length > BULK_IMPORT_MAX_REPORTS;
    expect(capExceeded).toBe(true);
  });

  it("a paste of 200 reports is exactly at the cap (not exceeded)", () => {
    const lines: string[] = [];
    for (let i = 0; i < 200; i++) {
      const day = (i % 28) + 1;
      const month = (Math.floor(i / 28) % 12) + 1;
      const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      lines.push(`Date: ${date}`);
      lines.push(`Report body number ${i}. ` + "x".repeat(120));
      lines.push("");
    }
    const chunks = splitReports(lines.join("\n"));
    expect(chunks.length).toBe(200);
    expect(chunks.length > BULK_IMPORT_MAX_REPORTS).toBe(false);
  });
});
