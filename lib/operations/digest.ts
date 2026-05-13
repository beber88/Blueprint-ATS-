// Tokenized digest links. The daily-digest cron mints a JWT-like signed token
// containing the digest payload id; the recipient (CEO) opens the link, the
// /api/operations/digest/[token] route verifies + returns a read-only view.
//
// Uses HMAC-SHA256 over a base64-url payload — keeps the lib free of jsonwebtoken
// dependency. Sufficient for short-lived (24h) view links.

import crypto from "node:crypto";

const SECRET_ENV = "OPERATIONS_DIGEST_SECRET";

interface DigestPayload {
  // The cron writes the digest payload directly inside the token to avoid
  // requiring a separate persisted digest table for v1.
  generated_at: string; // ISO
  data: unknown;
  exp: number; // unix seconds
}

function getSecret(): string {
  const s = process.env[SECRET_ENV];
  if (!s) throw new Error(`Missing env var ${SECRET_ENV}`);
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signDigestToken(data: unknown, ttlSeconds = 24 * 60 * 60): string {
  const payload: DigestPayload = {
    generated_at: new Date().toISOString(),
    data,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const json = JSON.stringify(payload);
  const body = b64url(Buffer.from(json, "utf8"));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyDigestToken(token: string): DigestPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as DigestPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
