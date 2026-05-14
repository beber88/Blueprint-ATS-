import fs from "fs";
import path from "path";
import { splitReports } from "@/lib/operations/bulk-split";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

interface ExpectedSingle {
  split: { chunks: number; dates: (string | null)[] };
  must_contain?: string[];
  must_contain_per_chunk?: string[][];
}

const fixtures: { name: string }[] = [
  { name: "daily_report_typical" },
  { name: "weekly_with_ceo_actions" },
  { name: "daily_with_attendance_issues" },
];

describe("bulk-split fixtures", () => {
  for (const { name } of fixtures) {
    it(`${name}: splitReports output matches expected.json`, () => {
      const text = fs.readFileSync(path.join(FIXTURE_DIR, `${name}.txt`), "utf8");
      const expected: ExpectedSingle = JSON.parse(
        fs.readFileSync(path.join(FIXTURE_DIR, `${name}.expected.json`), "utf8")
      );

      const out = splitReports(text);
      expect(out).toHaveLength(expected.split.chunks);
      expect(out.map((c) => c.date)).toEqual(expected.split.dates);

      if (expected.must_contain) {
        for (const phrase of expected.must_contain) {
          const combined = out.map((c) => c.chunk).join("\n");
          expect(combined).toContain(phrase);
        }
      }
      if (expected.must_contain_per_chunk) {
        expected.must_contain_per_chunk.forEach((phrases, i) => {
          for (const p of phrases) {
            expect(out[i].chunk).toContain(p);
          }
        });
      }
    });
  }
});
