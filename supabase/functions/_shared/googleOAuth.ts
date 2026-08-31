import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptApiKey } from "./llmProvider.ts";

// ---------- errors ----------

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("google_not_connected");
  }
}

export class GoogleReauthRequiredError extends Error {
  constructor(message = "google_reauth_required") {
    super(message);
  }
}

// ---------- state signing (stateless CSRF protection for the OAuth redirect) ----------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function signOAuthState(userId: string, secret: string): Promise<string> {
  const payload = { uid: userId, nonce: crypto.randomUUID(), iat: Date.now() };
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

export async function verifyOAuthState(state: string, secret: string, maxAgeMs = 10 * 60 * 1000): Promise<string | null> {
  const [payloadB64, sigB64] = (state || "").split(".");
  if (!payloadB64 || !sigB64) return null;
  const expectedSig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payloadB64));
  if (bytesToBase64Url(new Uint8Array(expectedSig)) !== sigB64) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
    if (!payload?.uid || typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > maxAgeMs) return null;
    return payload.uid as string;
  } catch {
    return null;
  }
}

// ---------- encrypted token storage (reuses the same pgcrypto RPC as user_api_keys) ----------

export async function encryptApiKey(supabaseAdmin: SupabaseClient, value: string): Promise<string> {
  const encKey = Deno.env.get("API_ENCRYPTION_KEY");
  if (!encKey) return value;
  const { data, error } = await supabaseAdmin.rpc("encrypt_api_key", { p_key: value, p_encryption_key: encKey });
  if (error) throw new Error(`encrypt_api_key failed: ${error.message}`);
  return data as string;
}

// ---------- Google token endpoint ----------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI")!,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.email || null;
  } catch {
    return null;
  }
}

// Returns a valid (non-expired) access token for the user, refreshing it via the stored
// refresh_token when needed. Throws GoogleNotConnectedError / GoogleReauthRequiredError.
export async function getValidAccessToken(supabaseAdmin: SupabaseClient, userId: string): Promise<string> {
  const { data: conn, error } = await supabaseAdmin
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn) throw new GoogleNotConnectedError();
  if (conn.status !== "connected") throw new GoogleReauthRequiredError(conn.last_error || undefined);

  const stillValid =
    conn.access_token_expires_at && new Date(conn.access_token_expires_at).getTime() - Date.now() > 60_000;
  if (stillValid && conn.access_token_encrypted) {
    return decryptApiKey(supabaseAdmin, conn.access_token_encrypted);
  }

  const refreshToken = await decryptApiKey(supabaseAdmin, conn.refresh_token_encrypted);
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const encrypted = await encryptApiKey(supabaseAdmin, refreshed.access_token);
    await supabaseAdmin
      .from("google_connections")
      .update({
        access_token_encrypted: encrypted,
        access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        status: "connected",
        last_error: null,
      })
      .eq("user_id", userId);
    return refreshed.access_token;
  } catch (e) {
    console.error("[googleOAuth] refresh failed for user", userId, e instanceof Error ? e.message : e);
    await supabaseAdmin
      .from("google_connections")
      .update({ status: "error", last_error: "Não foi possível renovar o acesso ao Google. Reconecte sua conta." })
      .eq("user_id", userId);
    throw new GoogleReauthRequiredError();
  }
}

// ---------- Google Drive helpers ----------

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export async function exportDocAsText(fileId: string, accessToken: string): Promise<string | null> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error("[googleOAuth] exportDocAsText failed:", res.status, await res.text());
    return null;
  }
  return res.text();
}
