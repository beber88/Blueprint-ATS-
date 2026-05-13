// A4 smoke test for the Twilio webhook route handler.
//
// Verifies two contracts:
//   1) An invalid X-Twilio-Signature returns HTTP 403 and the warning
//      log does NOT contain the request body or sender phone.
//   2) A valid signature (computed with twilio.validateRequest's inverse
//      HMAC algorithm) is accepted by the verifier portion of the route.
//
// We do NOT spin up the full Next runtime — the route's POST handler is
// invoked directly with a synthesized NextRequest. The Supabase admin
// client is mocked at module level so we never touch a real database.

import twilio from "twilio";

// Mock Supabase admin BEFORE importing the route. The route only uses
// it after signature validation, so for the 403 path it's never called.
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "stub" }, error: null }) }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  }),
}));

jest.mock("@/lib/operations/match-employee", () => ({
  matchEmployeeByPhone: async () => ({ employee_id: null, confidence: 0 }),
}));

const TOKEN = "test_auth_token_a4";
const URL_ = "https://blueprint.example.com/api/webhooks/twilio/whatsapp";

let originalToken: string | undefined;

beforeAll(() => {
  originalToken = process.env.TWILIO_AUTH_TOKEN;
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  delete process.env.TWILIO_SKIP_SIGNATURE_VERIFICATION;
});

afterAll(() => {
  if (originalToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
  else process.env.TWILIO_AUTH_TOKEN = originalToken;
});

function makeRequest(params: Record<string, string>, signature: string | null) {
  const body = new URLSearchParams(params).toString();
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
  });
  if (signature !== null) headers.set("x-twilio-signature", signature);
  // NextRequest extends Request — for the POST handler we only need
  // headers, nextUrl.toString(), and text(). Construct via Request and
  // wrap.
  const req = new Request(URL_, { method: "POST", body, headers });
  return Object.assign(req, {
    nextUrl: new URL(URL_),
  }) as unknown as import("next/server").NextRequest;
}

describe("Twilio webhook POST — A4 smoke", () => {
  // Capture all console.warn calls; we assert on their content.
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("invalid signature → 403, log carries no payload data", async () => {
    const { POST } = await import("@/app/api/webhooks/twilio/whatsapp/route");
    const req = makeRequest(
      {
        From: "whatsapp:+1234567890",
        Body: "secret report contents about Pearl de Flore",
        MessageSid: "SMtampered",
      },
      "this-is-not-a-valid-signature"
    );
    const res = await POST(req);
    expect(res.status).toBe(403);

    // The warn log should exist
    expect(warnSpy).toHaveBeenCalled();
    const logged = warnSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    // …and must not contain any payload fragment.
    expect(logged).not.toMatch(/Pearl de Flore/);
    expect(logged).not.toMatch(/\+1234567890/);
    expect(logged).not.toMatch(/SMtampered/);
    expect(logged).not.toMatch(/secret report/);
    // It should report only route + hasSignatureHeader.
    expect(logged).toMatch(/\/api\/webhooks\/twilio\/whatsapp/);
    expect(logged).toMatch(/hasSignatureHeader/);
  });

  it("missing signature header → 403, log notes hasSignatureHeader=false", async () => {
    const { POST } = await import("@/app/api/webhooks/twilio/whatsapp/route");
    const req = makeRequest(
      { From: "whatsapp:+1234567890", Body: "x", MessageSid: "SM" },
      null
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
    const logged = warnSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(logged).toMatch(/"hasSignatureHeader":false/);
  });

  it("valid signature gets past the verifier", async () => {
    const params = {
      From: "whatsapp:+1234567890",
      Body: "valid signed payload",
      MessageSid: "SMvalid",
      NumMedia: "0",
    };
    // Compute the same signature Twilio would. validateRequest is the
    // checker; getExpectedTwilioSignature is the producer.
    const signed = twilio.getExpectedTwilioSignature(TOKEN, URL_, params);
    const req = makeRequest(params, signed);
    const { POST } = await import("@/app/api/webhooks/twilio/whatsapp/route");
    const res = await POST(req);
    // 200 (success TwiML) or 200-with-body. NOT 403.
    expect(res.status).not.toBe(403);
    // No "signature verification failed" log for the success path.
    const sigFailLog = warnSpy.mock.calls.filter((c) =>
      JSON.stringify(c).includes("signature verification failed")
    );
    expect(sigFailLog).toHaveLength(0);
  });
});
