// Anthropic published pricing per 1M tokens (input / output), USD.
// Source: anthropic.com/pricing as of 2026-05.
// Update this file when prices change; downstream estimators read from here.
//
// Keep the math conservative — the bulk-import preview shows the user an
// UPPER bound so they can decide whether to proceed before paying.

export const CLAUDE_PRICING = {
  "claude-sonnet-4-20250514": {
    input_per_1m_usd: 3.0,
    output_per_1m_usd: 15.0,
  },
  "claude-sonnet-4-5-20250929": {
    input_per_1m_usd: 3.0,
    output_per_1m_usd: 15.0,
  },
  "claude-opus-4-7": {
    input_per_1m_usd: 15.0,
    output_per_1m_usd: 75.0,
  },
} as const;

export type ClaudeModelId = keyof typeof CLAUDE_PRICING;

// The model the extraction pipeline actually uses. Single source of truth.
export const EXTRACTION_MODEL: ClaudeModelId = "claude-sonnet-4-20250514";

// Empirical average tokens emitted per consolidated daily-report extraction.
// Calibrated on Blueprint's report format (~10-15 structured items per report).
// Used to estimate the OUTPUT side of a bulk run — input is computed from
// the raw paste length.
export const TYPICAL_OUTPUT_TOKENS_PER_REPORT = 800;
