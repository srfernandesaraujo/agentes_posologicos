import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

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

    // Normalize format for OpenAI-compatible input_audio
    const fmt = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a"
              : mimeType.includes("wav") ? "wav"
              : mimeType.includes("mp3") ? "mp3"
              : mimeType.includes("ogg") ? "ogg"
              : "webm";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcreva o áudio em português do Brasil. Retorne APENAS o texto transcrito, sem comentários, sem marcações." },
            { type: "input_audio", input_audio: { data: audioBase64, format: fmt } },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gateway error:", resp.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao transcrever áudio" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content?.trim() || "";

    // Best-effort 1 credit debit (skip for admins/unlimited)
    try {
      const adminClient = createClient(supabaseUrl, serviceKey);
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