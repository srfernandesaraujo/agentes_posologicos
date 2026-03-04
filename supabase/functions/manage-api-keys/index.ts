import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "Encryption key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { action, provider, apiKey } = await req.json();

    if (action === "upsert") {
      if (!provider || !apiKey) {
        return new Response(JSON.stringify({ error: "Provider and apiKey required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Encrypt the API key using pgcrypto via SQL
      const { data, error } = await serviceClient.rpc("encrypt_api_key", { p_key: apiKey, p_encryption_key: encryptionKey });
      if (error) {
        console.error("Encryption error:", error);
        return new Response(JSON.stringify({ error: "Failed to encrypt key" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encrypted = data as string;

      // Upsert using service role (since we revoked INSERT/UPDATE from authenticated)
      const { error: upsertError } = await serviceClient
        .from("user_api_keys")
        .upsert(
          { user_id: user.id, provider, api_key_encrypted: encrypted },
          { onConflict: "user_id,provider" }
        );

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(JSON.stringify({ error: "Failed to save key" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!provider) {
        return new Response(JSON.stringify({ error: "Provider required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await serviceClient
        .from("user_api_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);

      if (deleteError) {
        return new Response(JSON.stringify({ error: "Failed to delete key" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-api-keys error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
