import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OrderedKey, callWithFallback, getOrderedKeysForUser, logAiUsage } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORCHESTRATOR_COST = 12;

async function callGateway(
  admin: SupabaseClient,
  orderedKeys: OrderedKey[],
  userId: string,
  messages: any[],
  schema?: any,
) {
  const result = await callWithFallback(admin, orderedKeys, {
    messages,
    mode: schema ? "tools" : "text",
    tools: schema ? [{ type: "function", function: { name: "respond", parameters: schema } }] : undefined,
    toolChoice: schema ? { type: "function", function: { name: "respond" } } : undefined,
  });
  if (!result) throw new Error("Nenhum provedor de IA disponível (configure uma chave em Configurações)");
  await logAiUsage(admin, {
    userId,
    provider: result.provider!,
    model: result.model!,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    promptType: "agent-orchestrator",
  });
  if (schema) return result.toolCallArgs;
  return result.output || "";
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
    const { data: isAdminFlag } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const hasUnlimited = !!unlimited || isAdminFlag === true;

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
    const orderedKeys = await getOrderedKeysForUser(admin, user.id);
    const plan = await callGateway(admin, orderedKeys, user.id, [
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
    const dossier = await callGateway(admin, orderedKeys, user.id, [
      { role: "system", content: "Você consolida resultados de múltiplos agentes especialistas num dossiê único, claro e navegável em Markdown. Use cabeçalhos H2, listas e tabelas quando útil. Não invente informações além das fornecidas. Português." },
      { role: "user", content: `Objetivo original: ${goal}\n\nResultados dos especialistas:\n\n${results.map((r: any, i: number) =>
        `### Etapa ${i + 1}: ${r.title} (${r.agent_name || r.agent_slug})\n${r.output || `(erro: ${r.error})`}`).join("\n\n---\n\n")}` },
    ]);

    // 5) Debit (atomic — see spend_credits migration)
    if (!hasUnlimited) {
      try {
        await admin.rpc("spend_credits", {
          p_user_id: user.id,
          p_amount: ORCHESTRATOR_COST,
          p_description: `Agente Orquestrador: ${goal.slice(0, 80)}`,
        });
      } catch (e: any) {
        console.warn(`orchestrator charge skipped for user ${user.id}: ${e?.message || e}`);
      }
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