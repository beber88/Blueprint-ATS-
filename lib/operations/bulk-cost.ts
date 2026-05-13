import {
  CLAUDE_PRICING,
  EXTRACTION_MODEL,
  TYPICAL_OUTPUT_TOKENS_PER_REPORT,
  type ClaudeModelId,
} from "@/config/pricing";

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: ClaudeModelId;
}

// Char-to-token heuristic used everywhere the SDK isn't available. Roughly
// matches the Anthropic tokenizer for English/Hebrew prose; small errors
// don't matter because the preview shows an UPPER bound for user consent.
export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Estimate the cost of processing a bulk paste with N reports.
// Deterministic — same inputs produce the same output. Tested.
export function estimateBulkCost(
  text: string,
  reportsCount: number,
  model: ClaudeModelId = EXTRACTION_MODEL
): CostEstimate {
  const pricing = CLAUDE_PRICING[model];
  const inputTokens = estimateInputTokens(text);
  const outputTokens = reportsCount * TYPICAL_OUTPUT_TOKENS_PER_REPORT;
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input_per_1m_usd +
    (outputTokens / 1_000_000) * pricing.output_per_1m_usd;
  return {
    inputTokens,
    outputTokens,
    // Round to 4 decimals (matches NUMERIC(10,4) in op_bulk_import_jobs).
    costUsd: Math.round(costUsd * 10_000) / 10_000,
    model,
  };
}
