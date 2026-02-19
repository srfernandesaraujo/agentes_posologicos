import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SLUG_TO_WEBHOOK: Record<string, string> = {
  "interacoes-cardiovascular": "Analisador_Interacoes",
  "analisador-turma": "Analisador_dados_turma",
  "antibioticoterapia": "Consultor_antibioticoterapia",
  "editais-fomento": "Assistente_editais",
  "educador-cronicas": "Tradutor_Clinico",
  "analise-estatistica": "Analise_estatistica",
  "metodologias-ativas": "Arquiteto_de_metodologias_ativas",
  "fact-checker": "Checador_de_fatos",
  "simulador-clinico": "Simulador_de_casos_clinicos",
  "seo-youtube": "Conteudo_Youtube",
};

const N8N_BASE = "http://n8n-casaos.posologia.app/webhook";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agentId, input } = await req.json();
    if (!agentId || !input) {
      return new Response(
        JSON.stringify({ error: "agentId and input are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Look up agent slug
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("slug")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookPath = SLUG_TO_WEBHOOK[agent.slug];
    if (!webhookPath) {
      return new Response(
        JSON.stringify({ error: "No webhook configured for this agent" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call n8n webhook
    const n8nResponse = await fetch(`${N8N_BASE}/${webhookPath}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

    const n8nData = await n8nResponse.text();

    let output: string;
    try {
      const parsed = JSON.parse(n8nData);
      // n8n may return { output: "..." } or just a string or other shapes
      output =
        typeof parsed === "string"
          ? parsed
          : parsed.output || parsed.response || parsed.text || JSON.stringify(parsed);
    } catch {
      output = n8nData;
    }

    return new Response(JSON.stringify({ output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
