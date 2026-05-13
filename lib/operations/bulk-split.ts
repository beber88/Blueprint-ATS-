// Splits a long pasted block containing multiple daily reports into per-report
// chunks. Each report begins with a "Date: YYYY-MM-DD", "Date: Month DD, YYYY",
// or Hebrew "תאריך:" header. Chunks shorter than 100 chars are discarded.
//
// Extracted from app/api/operations/reports/bulk-ingest/route.ts so the parsing
// logic can be unit-tested without spinning up a Next.js route handler.

export interface ReportChunk {
  chunk: string;
  date: string | null;
}

export function parseDateFromHeader(header: string): string | null {
  const m = header.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const m2 = header.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i
  );
  if (m2) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
    };
    return `${m2[3]}-${months[m2[1].toLowerCase()]}-${m2[2].padStart(2, "0")}`;
  }
  return null;
}

export function splitReports(text: string): ReportChunk[] {
  const lines = text.split("\n");
  const reports: ReportChunk[] = [];
  let current: string[] = [];
  let currentDate: string | null = null;

  const isReportHeader = (i: number): { match: boolean; date: string | null } => {
    const line = lines[i] || "";
    const m = line.match(/^\s*(?:date|תאריך)\s*[:\-]\s*(.+)$/i);
    if (m) return { match: true, date: parseDateFromHeader(m[1]) };
    return { match: false, date: null };
  };

  for (let i = 0; i < lines.length; i++) {
    const header = isReportHeader(i);
    if (header.match && current.length > 0) {
      reports.push({ chunk: current.join("\n").trim(), date: currentDate });
      current = [];
    }
    if (header.match) currentDate = header.date;
    current.push(lines[i]);
  }
  if (current.length > 0) {
    reports.push({ chunk: current.join("\n").trim(), date: currentDate });
  }
  return reports.filter((r) => r.chunk.length > 100);
}
