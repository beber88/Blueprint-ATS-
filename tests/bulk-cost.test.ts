import { estimateBulkCost, estimateInputTokens } from "@/lib/operations/bulk-cost";
import { CLAUDE_PRICING, EXTRACTION_MODEL, TYPICAL_OUTPUT_TOKENS_PER_REPORT } from "@/config/pricing";
import { hashSourceText } from "@/lib/operations/bulk-import";

describe("estimateInputTokens", () => {
  it("returns ceil(chars/4)", () => {
    expect(estimateInputTokens("")).toBe(0);
    expect(estimateInputTokens("abcd")).toBe(1);
    expect(estimateInputTokens("a".repeat(40))).toBe(10);
    expect(estimateInputTokens("a".repeat(41))).toBe(11);
  });
});

describe("estimateBulkCost", () => {
  it("is deterministic — same input gives same output", () => {
    const text = "x".repeat(4000); // 1000 input tokens
    const a = estimateBulkCost(text, 5);
    const b = estimateBulkCost(text, 5);
    expect(a).toEqual(b);
  });

  it("computes a known input → known output", () => {
    // 4000 chars = 1000 input tokens. 5 reports * 800 output tokens = 4000 output.
    const text = "x".repeat(4000);
    const out = estimateBulkCost(text, 5);
    expect(out.inputTokens).toBe(1000);
    expect(out.outputTokens).toBe(5 * TYPICAL_OUTPUT_TOKENS_PER_REPORT);
    expect(out.model).toBe(EXTRACTION_MODEL);

    const pricing = CLAUDE_PRICING[EXTRACTION_MODEL];
    const expected =
      (1000 / 1_000_000) * pricing.input_per_1m_usd +
      (4000 / 1_000_000) * pricing.output_per_1m_usd;
    // Helper rounds to 4 decimals.
    expect(out.costUsd).toBe(Math.round(expected * 10_000) / 10_000);
  });

  it("scales linearly with the number of reports (output side)", () => {
    const text = "x".repeat(4000);
    const a = estimateBulkCost(text, 1);
    const b = estimateBulkCost(text, 10);
    // Input stays constant; output scales linearly.
    expect(b.inputTokens).toBe(a.inputTokens);
    expect(b.outputTokens).toBe(a.outputTokens * 10);
    expect(b.costUsd).toBeGreaterThan(a.costUsd);
  });
});

describe("hashSourceText", () => {
  it("returns a stable hex string of 64 chars (sha256)", () => {
    const h = hashSourceText("hello world");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes line endings — CRLF and LF hash identically", () => {
    expect(hashSourceText("line one\r\nline two")).toBe(
      hashSourceText("line one\nline two")
    );
  });

  it("normalizes trailing whitespace", () => {
    expect(hashSourceText("payload")).toBe(hashSourceText("payload\n\n"));
  });

  it("different text → different hash", () => {
    expect(hashSourceText("a")).not.toBe(hashSourceText("b"));
  });
});
