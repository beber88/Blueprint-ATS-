import crypto from "crypto";
import { verifyTwilioSignature, twimlMessage, emptyTwiml } from "@/lib/twilio/inbound";

// Reproduces Twilio's signing algorithm: HMAC-SHA1(authToken, url + sorted(key+value).join(""))
// base64-encoded. See https://www.twilio.com/docs/usage/security#validating-requests.
function sign(token: string, url: string, params: Record<string, string>): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return crypto.createHmac("sha1", token).update(data).digest("base64");
}

describe("verifyTwilioSignature", () => {
  const TOKEN = "test-auth-token-1234567890";
  const URL_ = "https://blueprint.example.com/api/webhooks/twilio/whatsapp";
  const PARAMS = {
    From: "whatsapp:+639171234567",
    To: "whatsapp:+15555555555",
    Body: "Daily report 2026-05-12: all good",
    MessageSid: "SM1234567890abcdef",
    NumMedia: "0",
  };

  let originalToken: string | undefined;
  let originalSkip: string | undefined;

  beforeEach(() => {
    originalToken = process.env.TWILIO_AUTH_TOKEN;
    originalSkip = process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION;
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    delete process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION;
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalToken;
    if (originalSkip === undefined) delete process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION;
    else process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION = originalSkip;
  });

  it("accepts a correctly signed request", () => {
    const sig = sign(TOKEN, URL_, PARAMS);
    expect(verifyTwilioSignature(sig, URL_, PARAMS)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(verifyTwilioSignature("not-a-real-signature", URL_, PARAMS)).toBe(false);
  });

  it("rejects when the body has been modified after signing", () => {
    const sig = sign(TOKEN, URL_, PARAMS);
    const tampered = { ...PARAMS, Body: "Daily report 2026-05-12: actually nothing" };
    expect(verifyTwilioSignature(sig, URL_, tampered)).toBe(false);
  });

  it("rejects when the URL doesn't match the signed URL", () => {
    const sig = sign(TOKEN, URL_, PARAMS);
    expect(
      verifyTwilioSignature(sig, "https://blueprint.example.com/api/webhooks/twilio/sms", PARAMS)
    ).toBe(false);
  });

  it("rejects an empty/null signature header", () => {
    expect(verifyTwilioSignature(null, URL_, PARAMS)).toBe(false);
    expect(verifyTwilioSignature("", URL_, PARAMS)).toBe(false);
  });

  it("rejects when TWILIO_AUTH_TOKEN is missing", () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const sig = "anything";
    expect(verifyTwilioSignature(sig, URL_, PARAMS)).toBe(false);
  });

  it("bypasses verification in dev when TWILIO_SKIP_SIGNATURE_VERIFICATION=true", () => {
    process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION = "true";
    expect(verifyTwilioSignature(null, URL_, PARAMS)).toBe(true);
    expect(verifyTwilioSignature("garbage", URL_, PARAMS)).toBe(true);
  });
});

describe("twimlMessage", () => {
  it("wraps the body in a TwiML Response/Message", () => {
    const xml = twimlMessage("ok");
    expect(xml).toContain("<Response>");
    expect(xml).toContain("<Message>ok</Message>");
    expect(xml).toContain("</Response>");
  });

  it("escapes XML-special characters to prevent injection", () => {
    const xml = twimlMessage('<script>alert("x") & "stuff"</script>');
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
  });

  it("emptyTwiml returns a valid empty Response", () => {
    expect(emptyTwiml()).toBe(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
  });
});
