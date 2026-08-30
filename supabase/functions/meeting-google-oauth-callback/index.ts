import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyOAuthState, exchangeCodeForTokens, fetchGoogleEmail, encryptApiKey } from "../_shared/googleOAuth.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://agentes-ai.posologia.app";

function redirectTo(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}${path}` } });
}

// Public endpoint — Google redirects the user's browser here after consent, so there's no
// Supabase JWT to check (same exposure profile the old meeting-webhook had). CSRF/identity is
// instead handled by the signed `state` param minted in meeting-google-oauth-start.
serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      console.warn("[meeting-google-oauth-callback] Google returned error:", oauthError);
      return redirectTo(`/reunioes?google_error=${encodeURIComponent(oauthError)}`);
    }

    const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
    if (!code || !state || !stateSecret) {
      return redirectTo("/reunioes?google_error=invalid_request");
    }

    const userId = await verifyOAuthState(state, stateSecret);
    if (!userId) {
      return redirectTo("/reunioes?google_error=invalid_state");
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code);
    } catch (e) {
      console.error("[meeting-google-oauth-callback] token exchange failed:", e instanceof Error ? e.message : e);
      return redirectTo("/reunioes?google_error=token_exchange_failed");
    }

    const email = await fetchGoogleEmail(tokens.access_token);

    // Google only sends refresh_token on the very first consent (or when prompt=consent forces
    // re-issue, which meeting-google-oauth-start always sets) — but guard anyway: never overwrite
    // an existing refresh_token with null on a reconnect where Google omits it.
    const { data: existing } = await supabaseAdmin
      .from("google_connections")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokens.refresh_token && !existing?.refresh_token_encrypted) {
      console.error("[meeting-google-oauth-callback] no refresh_token available for user", userId);
      return redirectTo("/reunioes?google_error=no_refresh_token");
    }

    const refreshTokenEncrypted = tokens.refresh_token
      ? await encryptApiKey(supabaseAdmin, tokens.refresh_token)
      : existing!.refresh_token_encrypted;
    const accessTokenEncrypted = await encryptApiKey(supabaseAdmin, tokens.access_token);

    const { error: upsertError } = await supabaseAdmin.from("google_connections").upsert(
      {
        user_id: userId,
        google_email: email,
        refresh_token_encrypted: refreshTokenEncrypted,
        access_token_encrypted: accessTokenEncrypted,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "connected",
        last_error: null,
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      console.error("[meeting-google-oauth-callback] upsert failed:", upsertError.message);
      return redirectTo("/reunioes?google_error=save_failed");
    }

    return redirectTo("/reunioes?google_connected=1");
  } catch (e) {
    console.error("[meeting-google-oauth-callback] error:", e);
    return redirectTo("/reunioes?google_error=unknown");
  }
});
