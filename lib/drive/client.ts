import { google, drive_v3 } from "googleapis";
import { OAuth2Client, Credentials } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./tokens";

export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

export interface DriveTokens {
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: string | null;
  google_email: string | null;
}

export class DriveNotConfiguredError extends Error {}
export class DriveNotConnectedError extends Error {
  constructor(public userId: string) {
    super(`User ${userId} has not connected Google Drive`);
  }
}

function requireEnv(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new DriveNotConfiguredError(
      "Google Drive integration is not configured. Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REDIRECT_URI."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = requireEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildAuthUrl(state: string): string {
  const oauth = buildOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  tokens: Credentials;
  email: string | null;
}> {
  const oauth = buildOAuthClient();
  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);

  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const ticket = await oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_DRIVE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email || null;
    } catch (err) {
      console.warn("Could not verify id_token to get email:", err);
    }
  }

  return { tokens, email };
}

export async function persistTokens(
  userId: string,
  tokens: Credentials,
  email: string | null
): Promise<void> {
  const supabase = createAdminClient();
  const access = tokens.access_token ? encryptToken(tokens.access_token) : "";
  const refresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

  const payload: Record<string, unknown> = {
    user_id: userId,
    google_email: email,
    access_token_enc: access,
    scope: tokens.scope || DRIVE_SCOPES.join(" "),
    token_type: tokens.token_type || "Bearer",
    expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (refresh) payload.refresh_token_enc = refresh;

  const { error } = await supabase
    .from("drive_oauth_tokens")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    throw new Error(`Failed to persist Drive tokens: ${error.message}`);
  }
}

export async function loadTokens(userId: string): Promise<DriveTokens | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("drive_oauth_tokens")
    .select(
      "access_token_enc, refresh_token_enc, scope, token_type, expiry_date, google_email"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    access_token: decryptToken(data.access_token_enc),
    refresh_token: decryptToken(data.refresh_token_enc),
    scope: data.scope,
    token_type: data.token_type,
    expiry_date: data.expiry_date,
    google_email: data.google_email,
  };
}

export async function getDriveClient(userId: string): Promise<drive_v3.Drive> {
  const tokens = await loadTokens(userId);
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    throw new DriveNotConnectedError(userId);
  }

  const oauth = buildOAuthClient();
  oauth.setCredentials({
    access_token: tokens.access_token || undefined,
    refresh_token: tokens.refresh_token || undefined,
    scope: tokens.scope || undefined,
    token_type: tokens.token_type || undefined,
    expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).getTime() : undefined,
  });

  // Persist refreshed tokens automatically.
  oauth.on("tokens", async (newTokens) => {
    try {
      await persistTokens(userId, { ...oauth.credentials, ...newTokens }, tokens.google_email);
    } catch (err) {
      console.error("Failed to persist refreshed Drive tokens:", err);
    }
  });

  return google.drive({ version: "v3", auth: oauth });
}

export async function disconnectDrive(userId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("drive_oauth_tokens").delete().eq("user_id", userId);
}
