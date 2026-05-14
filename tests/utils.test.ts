import { similarityScore, normalizePhone } from "@/lib/utils";

describe("similarityScore", () => {
  it("returns 1 for identical strings (case + whitespace insensitive)", () => {
    expect(similarityScore("Hello", "hello")).toBe(1);
    expect(similarityScore("  foo  ", "foo")).toBe(1);
  });

  it("returns 0 when one string is empty and the other is not", () => {
    expect(similarityScore("", "abc")).toBe(0);
  });

  it("returns 1 when both strings are empty", () => {
    expect(similarityScore("", "")).toBe(1);
  });

  it("returns a value in [0,1] for partial matches", () => {
    // similarityScore is positional, not edit-distance. A trailing-char diff
    // keeps it high (only the last char differs), while a mid-string deletion
    // shifts every subsequent char and drives the score down — which is fine
    // for the matcher's actual job (name normalization, not full fuzzy search).
    const s1 = similarityScore("Lawrence Locsin", "Lawrence Locsim");
    expect(s1).toBeGreaterThan(0.9);
    expect(s1).toBeLessThan(1);
    const s2 = similarityScore("abcdef", "abcxyz");
    expect(s2).toBeGreaterThanOrEqual(0);
    expect(s2).toBeLessThan(1);
  });

  it("is symmetric within rounding", () => {
    const a = similarityScore("abcdef", "abcxyz");
    const b = similarityScore("abcxyz", "abcdef");
    expect(a).toBeCloseTo(b);
  });
});

describe("normalizePhone", () => {
  it("returns null for empty / undefined", () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("preserves an E.164 number", () => {
    expect(normalizePhone("+972501234567")).toBe("+972501234567");
    expect(normalizePhone("+63 917 123 4567")).toBe("+639171234567");
  });

  it("converts a 00-prefixed number to +", () => {
    expect(normalizePhone("00972501234567")).toBe("+972501234567");
  });

  it("expands a leading 0 to Israeli country code by default", () => {
    expect(normalizePhone("0501234567")).toBe("+972501234567");
  });

  it("strips a whatsapp: prefix from Twilio's From field", () => {
    expect(normalizePhone("whatsapp:+639171234567")).toBe("+639171234567");
  });

  it("strips spaces, dashes, and parentheses", () => {
    expect(normalizePhone("+63 (917) 123-4567")).toBe("+639171234567");
  });
});
