import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORCHESTRATOR_COST = 12;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(messages: any[], schema?: any) {
  const body: any = {
    model: "google/gemini-2.5-flash",
    messages,
  };
  if (schema) {
    body.tools = [{ type: "function", function: { name: "respond", parameters: schema } }];
    body.tool_choice = { type: "function", function: { name: "respond" } };
  }
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gateway ${r.status}: ${t.slice(0, 300)}`);
  }
  const j = await r.json();
  const choice = j.choices?.[0];
  if (schema) {
    const args = choice?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : null;
  }
  return choice?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { goal } = await req.json();
    if (!goal || typeof goal !== "string" || goal.length < 10) {
      return new Response(JSON.stringify({ error: "Descreva um objetivo (mín. 10 caracteres)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (goal.length > 4000) {
      return new Response(JSON.stringify({ error: "Objetivo muito longo (máx 4000 caracteres)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // Bypass credit check for unlimited users
    const { data: unlimited } = await admin
      .from("unlimited_users")
      .select("id").eq("email", (user.email || "").toLowerCase()).eq("is_active", true).maybeSingle();
    const hasUnlimited = !!unlimited;

    if (!hasUnlimited) {
      const { data: ledger } = await admin
        .from("credits_ledger").select("amount").eq("user_id", user.id);
      const balance = (ledger || []).reduce((s: number, r: any) => s + r.amount, 0);
      if (balance < ORCHESTRATOR_COST) {
        return new Response(JSON.stringify({ error: `Créditos insuficientes (necessário: ${ORCHESTRATOR_COST}, saldo: ${balance})` }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1) Load catalog
    const { data: agents } = await admin
      .from("agents")
      .select("id, slug, name, description, category, credit_cost")
      .eq("active", true);
    const catalog = (agents || []).filter((a: any) => a.slug !== "super-agente");
    const catalogText = catalog.map((a: any) =>
      `- ${a.slug} | ${a.name} (${a.category}): ${a.description}`
    ).join("\n");

    // 2) Plan
    const plan = await callGateway([
      { role: "system", content: `Você é um Agente Orquestrador. Decomponha o objetivo do usuário em 2 a 5 subtarefas e roteie cada uma para o melhor agente especialista disponível. Use SOMENTE slugs do catálogo abaixo. Responda em português. Cada subtarefa deve ter um prompt completo e autônomo (o especialista não vê o objetivo geral).\n\nCATÁLOGO DE AGENTES:\n${catalogText}` },
      { role: "user", content: `Objetivo: ${goal}` },
    ], {
      type: "object",
      properties: {
        rationale: { type: "string", description: "Raciocínio geral do roteamento (2-4 frases)" },
        subtasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              agent_slug: { type: "string" },
              reason: { type: "string", description: "Por que este agente foi escolhido" },
              prompt: { type: "string", description: "Prompt completo e autônomo para o especialista" },
            },
            required: ["title", "agent_slug", "reason", "prompt"],
          },
        },
      },
      required: ["rationale", "subtasks"],
    });

    if (!plan?.subtasks?.length) throw new Error("Falha ao planejar subtarefas");

    // 3) Execute (parallel)
    const slugToAgent = new Map(catalog.map((a: any) => [a.slug, a]));
    const results = await Promise.all(
      plan.subtasks.map(async (st: any) => {
        const agent = slugToAgent.get(st.agent_slug);
        if (!agent) return { ...st, error: "Agente não encontrado", output: "" };
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              agentId: agent.id,
              input: st.prompt,
              skipCredits: true,
              userId: user.id,
            }),
          });
          const data = await r.json();
          return {
            ...st,
            agent_name: agent.name,
            agent_category: agent.category,
            output: data?.response || data?.output || data?.message || JSON.stringify(data).slice(0, 500),
          };
        } catch (e: any) {
          return { ...st, agent_name: agent.name, error: e.message, output: "" };
        }
      })
    );

    // 4) Consolidate
    const dossier = await callGateway([
      { role: "system", content: "Você consolida resultados de múltiplos agentes especialistas num dossiê único, claro e navegável em Markdown. Use cabeçalhos H2, listas e tabelas quando útil. Não invente informações além das fornecidas. Português." },
      { role: "user", content: `Objetivo original: ${goal}\n\nResultados dos especialistas:\n\n${results.map((r: any, i: number) =>
        `### Etapa ${i + 1}: ${r.title} (${r.agent_name || r.agent_slug})\n${r.output || `(erro: ${r.error})`}`).join("\n\n---\n\n")}` },
    ]);

    // 5) Debit
    if (!hasUnlimited) {
      await admin.from("credits_ledger").insert({
        user_id: user.id,
        amount: -ORCHESTRATOR_COST,
        type: "usage",
        description: `Agente Orquestrador: ${goal.slice(0, 80)}`,
      });
    }

    return new Response(JSON.stringify({
      rationale: plan.rationale,
      results,
      dossier,
      cost: hasUnlimited ? 0 : ORCHESTRATOR_COST,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("orchestrator error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});