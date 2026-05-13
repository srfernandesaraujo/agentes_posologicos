// Edge function: Auto fine-tuning de agentes baseado em feedbacks
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function decrypt(svc: any, enc: string): Promise<string | null> {
  try {
    const { data, error } = await svc.rpc("decrypt_api_key", { p_encrypted: enc });
    if (error) return null;
    return data as string;
  } catch { return null; }
}

// Provider order: Google > OpenAI > Anthropic > Groq > NVIDIA > GitHub > OpenRouter > Lovable
async function callOptimizerLLM(svc: any, ownerUserId: string | null, systemMsg: string, userMsg: string): Promise<{ text: string; provider: string; model: string } | null> {
  // 1) Try owner's API keys in order
  if (ownerUserId) {
    const { data: keys } = await svc
      .from("user_api_keys")
      .select("provider, api_key_encrypted, key_expires_at")
      .eq("user_id", ownerUserId);
    const now = Date.now();
    const order = ["google", "openai", "anthropic", "groq", "nvidia", "github", "openrouter"];
    for (const prov of order) {
      const k = (keys || []).find((x: any) => x.provider === prov);
      if (!k) continue;
      if (k.key_expires_at && new Date(k.key_expires_at).getTime() < now) continue;
      const apiKey = await decrypt(svc, k.api_key_encrypted);
      if (!apiKey) continue;
      try {
        if (prov === "google") {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { role: "system", parts: [{ text: systemMsg }] },
              contents: [{ role: "user", parts: [{ text: userMsg }] }],
            }),
          });
          if (resp.ok) {
            const j = await resp.json();
            const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
            if (text) return { text, provider: "google", model: "gemini-2.5-pro" };
          }
        } else if (prov === "openai") {
          const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] }),
          });
          if (resp.ok) {
            const j = await resp.json();
            const text = j?.choices?.[0]?.message?.content || "";
            if (text) return { text, provider: "openai", model: "gpt-4o" };
          }
        } else if (prov === "anthropic") {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 4096, system: systemMsg, messages: [{ role: "user", content: userMsg }] }),
          });
          if (resp.ok) {
            const j = await resp.json();
            const text = j?.content?.[0]?.text || "";
            if (text) return { text, provider: "anthropic", model: "claude-3-5-sonnet" };
          }
        } else if (prov === "groq") {
          const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] }),
          });
          if (resp.ok) {
            const j = await resp.json();
            const text = j?.choices?.[0]?.message?.content || "";
            if (text) return { text, provider: "groq", model: "llama-3.3-70b" };
          }
        }
      } catch (_) { /* try next */ }
    }
  }
  // 2) Fallback to Lovable AI Gateway
  if (LOVABLE_API_KEY) {
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({ model: "google/gemini-2.5-pro", messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] }),
      });
      if (resp.ok) {
        const j = await resp.json();
        const text = j?.choices?.[0]?.message?.content || "";
        if (text) return { text, provider: "lovable", model: "google/gemini-2.5-pro" };
      }
    } catch (_) { /* nothing */ }
  }
  return null;
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
