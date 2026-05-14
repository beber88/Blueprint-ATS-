import { parseDateFromHeader, splitReports } from "@/lib/operations/bulk-split";

describe("parseDateFromHeader", () => {
  it("parses YYYY-MM-DD", () => {
    expect(parseDateFromHeader("2026-05-12")).toBe("2026-05-12");
  });

  it("parses YYYY/M/D and zero-pads", () => {
    expect(parseDateFromHeader("2026/5/3")).toBe("2026-05-03");
  });

  it("parses English long-form dates", () => {
    expect(parseDateFromHeader("May 12, 2026")).toBe("2026-05-12");
    expect(parseDateFromHeader("January 1 2026")).toBe("2026-01-01");
  });

  it("returns null for unparseable headers", () => {
    expect(parseDateFromHeader("yesterday")).toBeNull();
    expect(parseDateFromHeader("")).toBeNull();
  });
});

describe("splitReports", () => {
  it("returns no chunks when no headers are found", () => {
    expect(splitReports("nothing here, definitely not a report header")).toEqual([]);
  });

  it("splits two reports separated by a Date header", () => {
    const text = [
      "Consolidated Daily Report",
      "Date: 2026-05-10",
      "Body line 1 of report 1",
      "Body line 2 of report 1 with enough text to clear the 100-character minimum threshold",
      "",
      "Consolidated Daily Report",
      "Date: 2026-05-11",
      "Body line 1 of report 2",
      "Body line 2 of report 2 with enough text to clear the 100-character minimum threshold",
    ].join("\n");
    const out = splitReports(text);
    expect(out).toHaveLength(2);
    expect(out[0].date).toBe("2026-05-10");
    expect(out[1].date).toBe("2026-05-11");
    expect(out[0].chunk).toContain("report 1");
    expect(out[1].chunk).toContain("report 2");
  });

  it("supports the Hebrew תאריך: header", () => {
    const text = [
      "דוח יומי מאוחד",
      "תאריך: 2026-05-12",
      "תוכן הדוח בשפה העברית - שורה ראשונה",
      "תוכן הדוח בשפה העברית - שורה שנייה עם מספיק טקסט כדי לעבור את סף ה-100 תווים",
    ].join("\n");
    const out = splitReports(text);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-12");
  });

  it("discards chunks shorter than 100 characters", () => {
    const text = "Date: 2026-05-12\nshort";
    expect(splitReports(text)).toEqual([]);
  });
});
