import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback } from "../_shared/llmProvider.ts";
import { transcribeWithFallback } from "../_shared/llmTranscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { audioBase64, mimeType = "audio/webm" } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return new Response(JSON.stringify({ error: "audioBase64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (audioBase64.length > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Audio too large (max ~6MB)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const orderedKeys = await getOrderedKeysWithAdminFallback(adminClient, user.id);
    const transcription = await transcribeWithFallback(adminClient, orderedKeys, { audioBase64, mimeType });

    if (!transcription.ok) {
      console.error("Transcription error:", transcription.errorText);
      return new Response(JSON.stringify({ error: "Falha ao transcrever áudio" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const text = (transcription.text || "").trim();

    // Best-effort 1 credit debit (skip for admins/unlimited)
    try {
      const [{ data: roleRow }, { data: unlimited }] = await Promise.all([
        adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
        adminClient.from("unlimited_users").select("id").eq("email", user.email).maybeSingle(),
      ]);
      if (!roleRow && !unlimited && text.length > 0) {
        await adminClient.from("credits_ledger").insert({
          user_id: user.id,
          amount: -1,
          type: "usage",
          description: "Transcrição de voz",
        });
      }
    } catch (e) {
      console.warn("credit debit skipped:", (e as Error).message);
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-transcribe error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});