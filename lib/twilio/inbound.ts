import twilio from "twilio";

// Verifies that an incoming Twilio webhook actually came from Twilio by checking
// the X-Twilio-Signature header. Returns true if valid OR if signature checking
// is disabled via TWILIO_SKIP_SIGNATURE_VERIFICATION (for local development).
export function verifyTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION === "true") return true;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.error("verifyTwilioSignature: missing TWILIO_AUTH_TOKEN");
    return false;
  }
  if (!signature) return false;
  return twilio.validateRequest(token, signature, url, params);
}

// Build a TwiML reply (XML) for inbound WhatsApp.
export function twimlMessage(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export function emptyTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
}
