import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { action, content, agentName, sessionId, messageId, verificationCode } = await req.json();

    // ---- VERIFY action (public, no auth needed) ----
    if (action === "verify") {
      if (!verificationCode) {
        return new Response(JSON.stringify({ error: "Código de verificação obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase
        .from("content_certificates")
        .select("*")
        .eq("verification_code", verificationCode.toUpperCase().trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({ valid: false, message: "Certificado não encontrado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          certificate: {
            id: data.id,
            verification_code: data.verification_code,
            content_hash: data.content_hash,
            content_preview: data.content_preview,
            agent_name: data.agent_name,
            created_at: data.created_at,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- GENERATE action (requires auth) ----
    if (action === "generate") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!content || content.trim().length < 10) {
        return new Response(JSON.stringify({ error: "Conteúdo muito curto para certificar" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contentHash = await sha256(content.trim());
      const verCode = generateVerificationCode();
      const preview = content.trim().substring(0, 200) + (content.trim().length > 200 ? "..." : "");

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: cert, error: insertError } = await supabase
        .from("content_certificates")
        .insert({
          user_id: user.id,
          verification_code: verCode,
          content_hash: contentHash,
          content_preview: preview,
          agent_name: agentName || "Agente IA",
          session_id: sessionId || null,
          message_id: messageId || null,
          metadata: {
            content_length: content.trim().length,
            generated_at: new Date().toISOString(),
            platform: "Agentes Posológicos",
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          certificate: {
            id: cert.id,
            verification_code: cert.verification_code,
            content_hash: cert.content_hash,
            created_at: cert.created_at,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- VALIDATE HASH action (public) ----
    if (action === "validate_hash") {
      if (!verificationCode || !content) {
        return new Response(JSON.stringify({ error: "Código e conteúdo obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase
        .from("content_certificates")
        .select("content_hash")
        .eq("verification_code", verificationCode.toUpperCase().trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ valid: false, message: "Certificado não encontrado" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const submittedHash = await sha256(content.trim());
      const matches = submittedHash === data.content_hash;

      return new Response(
        JSON.stringify({
          valid: true,
          integrity: matches,
          message: matches
            ? "Conteúdo íntegro — o texto confere com o original certificado."
            : "Conteúdo alterado — o texto não corresponde ao original certificado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("content-certificate error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
