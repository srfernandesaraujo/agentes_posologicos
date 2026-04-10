import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "nvidia-gptos": "https://integrate.api.nvidia.com/v1/chat/completions",
  "nvidia-deepseek": "https://integrate.api.nvidia.com/v1/chat/completions",
  github: "https://models.inference.ai.azure.com/chat/completions",
};

const DEFAULT_MODELS: Record<string, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  groq: "llama-3.3-70b-versatile",
  "nvidia-gptos": "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "nvidia-deepseek": "deepseek-ai/deepseek-v3.2",
  github: "gpt-4o",
  openrouter: "google/gemini-2.5-flash",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("API_ENCRYPTION_KEY");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tempClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await tempClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider } = await req.json();
    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get encrypted key
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: keyRow, error: keyError } = await serviceClient
      .from("user_api_keys")
      .select("api_key_encrypted")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single();

    if (keyError || !keyRow) {
      return new Response(JSON.stringify({ error: "Chave não encontrada para este provedor" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt key
    let decryptedKey = keyRow.api_key_encrypted;
    if (encryptionKey) {
      const { data: decrypted, error: decErr } = await serviceClient.rpc("decrypt_api_key", {
        p_encrypted: keyRow.api_key_encrypted,
        p_encryption_key: encryptionKey,
      });
      if (!decErr && decrypted) decryptedKey = decrypted;
    }

    const model = DEFAULT_MODELS[provider] || "gpt-4o";

    // Test API call
    let testOk = false;
    let errorMsg = "";

    if (provider === "anthropic") {
      // Anthropic uses a different API format
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": decryptedKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });
      if (res.ok) {
        testOk = true;
      } else {
        const t = await res.text();
        errorMsg = `HTTP ${res.status}: ${t.slice(0, 200)}`;
      }
    } else {
      // OpenAI-compatible providers
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${decryptedKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });
      if (res.ok) {
        testOk = true;
      } else {
        const t = await res.text();
        errorMsg = `HTTP ${res.status}: ${t.slice(0, 200)}`;
      }
    }

    return new Response(
      JSON.stringify({ success: testOk, error: testOk ? null : errorMsg }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("test-api-key error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
