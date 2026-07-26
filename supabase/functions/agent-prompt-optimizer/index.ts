// Edge function: Auto fine-tuning de agentes baseado em feedbacks
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getOrderedKeysWithAdminFallback, callWithFallback } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Uses the owner's configured API keys in priority order (falls back to the admin account's keys
// if the owner has none configured, or if this is a native agent with no owner).
async function callOptimizerLLM(svc: any, ownerUserId: string | null, systemMsg: string, userMsg: string): Promise<{ text: string; provider: string; model: string } | null> {
  const orderedKeys = await getOrderedKeysWithAdminFallback(svc, ownerUserId);
  const result = await callWithFallback(svc, orderedKeys, {
    systemPrompt: systemMsg,
    messages: [{ role: "user", content: userMsg }],
    mode: "text",
  });
  if (!result?.output) return null;
  return { text: result.output, provider: result.provider!, model: result.model! };
}

function extractPromptAndSummary(raw: string): { prompt: string; summary: string } {
  // Try fenced JSON
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/\{[\s\S]*"system_prompt"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (obj.system_prompt) {
        return { prompt: String(obj.system_prompt), summary: String(obj.change_summary || obj.summary || "Refinamento automático baseado em feedback.") };
      }
    } catch (_) { /* fall through */ }
  }
  // Fallback: split by markers
  const promptMatch = raw.match(/<NOVO_PROMPT>([\s\S]*?)<\/NOVO_PROMPT>/i);
  const summaryMatch = raw.match(/<RESUMO>([\s\S]*?)<\/RESUMO>/i);
  if (promptMatch) {
    return { prompt: promptMatch[1].trim(), summary: (summaryMatch?.[1] || "Refinamento automático baseado em feedback.").trim() };
  }
  return { prompt: raw.trim(), summary: "Refinamento automático baseado em feedback." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { agentId, agentType, force, triggeredBy } = await req.json().catch(() => ({}));
    if (!agentId || !["native", "custom"].includes(agentType)) {
      return json({ error: "agentId e agentType (native|custom) são obrigatórios" }, 400);
    }

    // Authenticate: either the daily cron job (shared secret) or a real logged-in
    // user manually triggering a run for an agent they own (or an admin).
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authVal = req.headers.get("Authorization") || "";
    const isCron = triggeredBy === "cron" && (
      (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
      (!!anonKey && authVal === `Bearer ${anonKey}`)
    );

    let callerUserId: string | null = null;
    if (!isCron) {
      if (!authVal) return json({ error: "Não autenticado" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authVal } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Não autenticado" }, 401);
      callerUserId = user.id;
    }

    // Identify agent owner + current prompt
    let ownerUserId: string | null = null;
    let currentPrompt = "";
    let agentName = "";
    if (agentType === "custom") {
      const { data: ag } = await svc.from("custom_agents").select("user_id,system_prompt,name").eq("id", agentId).maybeSingle();
      if (!ag) return json({ error: "Agent not found" }, 404);
      ownerUserId = (ag as any).user_id;
      currentPrompt = (ag as any).system_prompt || "";
      agentName = (ag as any).name || "";
    } else {
      const { data: ag } = await svc.from("agents").select("system_prompt,name,slug").eq("id", agentId).maybeSingle();
      if (!ag) return json({ error: "Agent not found" }, 404);
      currentPrompt = (ag as any).system_prompt || "";
      agentName = (ag as any).name || "";
    }

    // Authorization: manual triggers require ownership (custom agents) or admin (native agents).
    if (!isCron) {
      const isOwner = agentType === "custom" && ownerUserId === callerUserId;
      if (!isOwner) {
        const { data: isAdminFlag } = await svc.rpc("has_role", { _user_id: callerUserId, _role: "admin" });
        if (!isAdminFlag) return json({ error: "Sem permissão" }, 403);
      }
    }

    // Use latest active version as base if exists
    const { data: activeVer } = await svc
      .from("agent_prompt_versions")
      .select("version,system_prompt")
      .eq("agent_id", agentId).eq("agent_type", agentType).eq("status", "active")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const lastVersionNum: number = (activeVer as any)?.version || 0;
    if (activeVer && (activeVer as any).system_prompt) currentPrompt = (activeVer as any).system_prompt;

    // Settings
    const { data: settings } = await svc.from("agent_optimization_settings")
      .select("*").eq("agent_id", agentId).eq("agent_type", agentType).maybeSingle();
    const minFeedbacks = (settings as any)?.min_feedbacks ?? 10;
    const negThreshold = Number((settings as any)?.negative_threshold ?? 0.2);
    const autoApply = Boolean((settings as any)?.auto_apply);
    const enabled = Boolean((settings as any)?.auto_optimize_enabled);

    if (!force && !enabled) {
      return json({ skipped: true, reason: "auto_optimize_disabled" });
    }

    // Window: since last run or 60d
    const sinceTs = (settings as any)?.last_run_at || new Date(Date.now() - 60 * 86400 * 1000).toISOString();

    // Collect feedbacks
    const { data: feedbacks } = await svc
      .from("response_feedback")
      .select("rating,comment,message_id,session_id,created_at")
      .eq("agent_id", String(agentId))
      .gte("created_at", sinceTs)
      .order("created_at", { ascending: false })
      .limit(200);

    const total = (feedbacks || []).length;
    const positives = (feedbacks || []).filter((f: any) => f.rating === "up").length;
    const negatives = (feedbacks || []).filter((f: any) => f.rating === "down").length;
    const comments = (feedbacks || []).filter((f: any) => (f.comment || "").trim().length > 0);

    const negRate = total > 0 ? negatives / total : 0;
    const eligible = total >= minFeedbacks && (negRate >= negThreshold || comments.length >= 5);

    // Insert run
    const { data: runRow } = await svc.from("agent_optimization_runs").insert({
      agent_id: agentId, agent_type: agentType,
      status: "running",
      feedback_window_start: sinceTs, feedback_window_end: new Date().toISOString(),
      feedback_count: total, positive_count: positives, negative_count: negatives,
      comments_used: Math.min(comments.length, 50),
      triggered_by: triggeredBy === "manual" ? "manual" : "cron",
    }).select("id").single();
    const runId = (runRow as any)?.id;

    if (!force && !eligible) {
      await svc.from("agent_optimization_runs").update({ status: "skipped", error_message: `not eligible (total=${total}, negRate=${negRate.toFixed(2)}, comments=${comments.length})`, completed_at: new Date().toISOString() }).eq("id", runId);
      return json({ skipped: true, reason: "not_eligible", total, negatives, comments: comments.length });
    }

    // Fetch sample messages for negative feedbacks
    const sampleNegatives = (feedbacks || []).filter((f: any) => f.rating === "down").slice(0, 30);
    const messageIds = sampleNegatives.map((f: any) => f.message_id).filter(Boolean);
    let msgMap: Record<string, { user: string; assistant: string }> = {};
    if (messageIds.length) {
      const { data: msgs } = await svc.from("messages").select("id,session_id,role,content,created_at").in("id", messageIds);
      // For each assistant message, try to find the previous user message in the session
      for (const m of msgs || []) {
        if ((m as any).role !== "assistant") continue;
        const { data: prev } = await svc.from("messages")
          .select("content,created_at")
          .eq("session_id", (m as any).session_id)
          .eq("role", "user")
          .lt("created_at", (m as any).created_at)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        msgMap[(m as any).id] = {
          user: ((prev as any)?.content || "").slice(0, 800),
          assistant: String((m as any).content || "").slice(0, 1200),
        };
      }
    }

    const samples = sampleNegatives.slice(0, 10).map((f: any, i: number) => {
      const ex = msgMap[f.message_id] || { user: "(n/d)", assistant: "(n/d)" };
      return `### Caso ${i + 1} (👎)\nComentário do usuário: ${(f.comment || "(sem comentário)").slice(0, 400)}\nPergunta: ${ex.user}\nResposta avaliada: ${ex.assistant}`;
    }).join("\n\n");

    const positiveComments = comments.filter((c: any) => c.rating === "up").slice(0, 8).map((c: any) => `- ${c.comment}`).join("\n");

    const systemMsg = `Você é um engenheiro de prompts especialista. Receberá o system prompt atual de um agente de IA e exemplos reais de feedbacks negativos (com a pergunta e a resposta avaliada) e positivos.\nSua tarefa: produzir uma versão APRIMORADA do system prompt que corrija os problemas apontados, preservando a identidade, idioma (pt-BR), domínio e formatação obrigatória do agente. NÃO invente novas regras de negócio. Mantenha tabelas Markdown obrigatórias. Não exponha "thought process".\nResponda ESTRITAMENTE em JSON com as chaves: { "system_prompt": "...", "change_summary": "..." }. Sem comentários ou texto fora do JSON.`;

    const userMsg = `# Agente: ${agentName}\n\n## Prompt atual\n${currentPrompt}\n\n## Feedbacks negativos (amostras)\n${samples || "(nenhum exemplo de mensagem disponível)"}\n\n## Comentários positivos relevantes\n${positiveComments || "(nenhum)"}\n\nGere o JSON com o novo system_prompt aprimorado e um change_summary curto (máx 500 chars).`;

    const result = await callOptimizerLLM(svc, ownerUserId, systemMsg, userMsg);
    if (!result) {
      await svc.from("agent_optimization_runs").update({ status: "failed", error_message: "no_provider_available", completed_at: new Date().toISOString() }).eq("id", runId);
      return json({ error: "Nenhum provedor de IA disponível" }, 502);
    }

    const { prompt: newPrompt, summary } = extractPromptAndSummary(result.text);
    if (!newPrompt || newPrompt.length < 50) {
      await svc.from("agent_optimization_runs").update({ status: "failed", error_message: "invalid_prompt_output", model_used: result.model, provider_used: result.provider, completed_at: new Date().toISOString() }).eq("id", runId);
      return json({ error: "Saída inválida do otimizador" }, 502);
    }

    const newVersion = lastVersionNum + 1;
    const status = autoApply ? "active" : "pending";

    // If activating, archive previous active
    if (status === "active") {
      await svc.from("agent_prompt_versions").update({ status: "archived" })
        .eq("agent_id", agentId).eq("agent_type", agentType).eq("status", "active");
    }

    const { data: verRow } = await svc.from("agent_prompt_versions").insert({
      agent_id: agentId, agent_type: agentType, version: newVersion,
      system_prompt: newPrompt, status, origin: "auto_feedback",
      change_summary: summary,
      feedback_positive: positives, feedback_negative: negatives,
      feedback_window_start: sinceTs, feedback_window_end: new Date().toISOString(),
      activated_at: status === "active" ? new Date().toISOString() : null,
    }).select("id").single();

    await svc.from("agent_optimization_runs").update({
      status: "success", model_used: result.model, provider_used: result.provider,
      generated_version_id: (verRow as any)?.id, completed_at: new Date().toISOString(),
    }).eq("id", runId);

    // Upsert settings.last_run_at
    await svc.from("agent_optimization_settings").upsert({
      agent_id: agentId, agent_type: agentType,
      auto_optimize_enabled: enabled, auto_apply: autoApply,
      min_feedbacks: minFeedbacks, negative_threshold: negThreshold,
      last_run_at: new Date().toISOString(),
    }, { onConflict: "agent_id,agent_type" });

    // Notify owner if pending
    if (status === "pending" && ownerUserId) {
      await svc.from("notifications").insert({
        user_id: ownerUserId,
        type: "info",
        title: "Nova versão de prompt sugerida",
        message: `O agente "${agentName}" tem uma nova versão (v${newVersion}) sugerida com base em feedbacks. Revise e aprove.`,
        link: agentType === "custom" ? `/meus-agentes/${agentId}` : `/admin`,
      });
    }

    return json({ ok: true, version: newVersion, status, provider: result.provider, model: result.model, summary });
  } catch (e: any) {
    console.error("optimizer error", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
