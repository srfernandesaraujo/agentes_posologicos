// Conversa com o Time (Fase A). Ações (POST JSON, sempre autenticado como o dono do squad):
//   send     { squadId, thread, text }  → grava a mensagem do dono, roteia (no #time), pede a resposta dos agentes e grava tudo
//   usage    { squadId }                → gasto do mês, teto e estado da conversa
//   set_cap  { squadId, capUsd }        → teto mensal da conversa deste squad
//   clear    { squadId, thread? }       → apaga a conversa (uma conversa ou todas)
// `thread` é "team" (#time) ou o id de um agente do squad (mensagem direta).
// Função separada da `squad-engine`: uma resposta de chat é curta e não deve disputar tempo de execução com as missões.
// O agente só conversa: não executa, não altera entregas. Mensagens e respostas usam os mesmos filtros de dados das missões.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { screenInput, maskSecrets, buildMemoryContext, buildMemoryExtractionPrompt, parseMemoryExtraction, type MemoryItem } from "../_shared/squadCore.ts";
import { getTemplate } from "../_shared/squadTemplates.ts";
import { getOrderedKeysForUser, callWithFallback, estimateCost, logAiUsage } from "../_shared/llmProvider.ts";
import { HttpError } from "../_shared/squadRunner.ts";
import {
  CHAT_MAX_OUTPUT_TOKENS, CHAT_RATE_LIMIT_PER_MIN, CHAT_MISSION_CONTEXT_CHARS, CHAT_HISTORY_LIMIT, TEAM_THREAD,
  CHAT_MEMORY_MAX_PENDING, CHAT_CITED_CHARS,
  buildChatSystemPrompt, buildRouterPrompt, buildTranscriptMessage, capCrossing, chatBudget, cleanChatText, clampChatCap,
  clip, looksLikeTeaching, monthStartIso, parseMentions, parseRouterReply, routeByRules, type ChatAgent, type ChatLine,
} from "../_shared/squadChatCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Uma conversa é curta: se o modelo não responder neste prazo, o agente avisa em vez de pendurar a tela.
const FUNCTION_DEADLINE_MS = 70_000;
const ROUTER_DEADLINE_MS = 12_000;
// Roteador barato: onde o provedor tem um modelo pequeno conhecido, usa-o; nos demais vale o modelo padrão (já econômico).
const ROUTER_MODELS: Record<string, string> = { openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-20241022" };

const MISSION_STATUS: Record<string, string> = {
  running: "em andamento", paused: "pausada por custo", awaiting_approval: "aguardando a decisão do dono", awaiting_owner: "aguardando resposta do dono",
  completed: "concluída", failed: "falhou", cancelled: "cancelada",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    const loadOwnedSquad = async (squadId: string) => {
      const { data: squad } = await admin.from("squads").select("*").eq("id", squadId).maybeSingle();
      if (!squad || squad.owner_id !== user.id) throw new HttpError(404, "Squad não encontrado");
      const template = getTemplate(squad.template_slug);
      if (!template) throw new HttpError(400, "Template do squad não existe mais");
      return { squad, template };
    };

    const monthSpend = async (squadId: string): Promise<number> => {
      const { data, error } = await admin.rpc("squad_chat_month_spend", { p_squad: squadId, p_since: monthStartIso() });
      if (error) throw error;
      return Number(data || 0);
    };
    const usageOf = (spent: number, cap: number) => ({ spentUsd: Math.round(spent * 1_000_000) / 1_000_000, capUsd: cap, ...chatBudget(spent, cap) });

    if (action === "usage") {
      const { squad } = await loadOwnedSquad(String(body?.squadId || ""));
      return json({ usage: usageOf(await monthSpend(squad.id), Number(squad.chat_monthly_cap_usd)) });
    }

    if (action === "set_cap") {
      const { squad } = await loadOwnedSquad(String(body?.squadId || ""));
      const cap = clampChatCap(body?.capUsd);
      const { error } = await admin.from("squads").update({ chat_monthly_cap_usd: cap }).eq("id", squad.id);
      if (error) throw error;
      return json({ usage: usageOf(await monthSpend(squad.id), cap) });
    }

    if (action === "clear") {
      const { squad } = await loadOwnedSquad(String(body?.squadId || ""));
      let q = admin.from("squad_chat_messages").delete().eq("squad_id", squad.id).eq("owner_id", user.id);
      if (body?.thread) q = q.eq("thread", String(body.thread));
      const { error } = await q;
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "send") {
      const { squad, template } = await loadOwnedSquad(String(body?.squadId || ""));
      const text = cleanChatText(body?.text);
      if (!text) throw new HttpError(400, "Escreva uma mensagem");

      const { data: agentRows } = await admin.from("squad_agents").select("id, slug, name, role, system_prompt, sort_order").eq("squad_id", squad.id).order("sort_order");
      const agents = (agentRows || []) as (ChatAgent & { system_prompt: string })[];
      const thread = String(body?.thread || TEAM_THREAD);
      if (thread !== TEAM_THREAD && !agents.some((a) => a.id === thread)) throw new HttpError(400, "Conversa inexistente");

      // Limite de ritmo: protege o custo contra envio em rajada.
      const { count: recent } = await admin.from("squad_chat_messages").select("id", { count: "exact", head: true })
        .eq("squad_id", squad.id).eq("author", "user").gte("created_at", new Date(Date.now() - 60_000).toISOString());
      if ((recent || 0) >= CHAT_RATE_LIMIT_PER_MIN) throw new HttpError(429, "Muitas mensagens em pouco tempo. Aguarde um minuto.", "chat_rate_limit");

      // Teto mensal da conversa (separado do teto das missões).
      const cap = Number(squad.chat_monthly_cap_usd);
      const spentBefore = await monthSpend(squad.id);
      if (chatBudget(spentBefore, cap).state === "exceeded") {
        throw new HttpError(402, "O teto mensal da conversa deste squad foi atingido. Aumente o teto para continuar.", "chat_cap_reached");
      }

      const keys = await getOrderedKeysForUser(admin, user.id);
      if (!keys.length) throw new HttpError(400, "Nenhuma chave de API configurada. Adicione uma em Configurações para conversar com o time.");

      // Mesmos filtros das missões: dados pessoais conforme a sensibilidade do squad e, nos squads de código, segredos.
      const pii = screenInput(text, squad.sensitivity);
      const sec = template.maskSecrets ? maskSecrets(pii.text) : { text: pii.text, findings: [] as { type: string; count: number }[] };
      const clean = sec.text;
      const userMeta: Record<string, unknown> = {};
      if (pii.findings.length) userMeta.masked_pii = pii.findings;
      if (sec.findings.length) userMeta.masked_secrets = sec.findings;

      // Entrega citada pelo dono: o agente recebe o texto dela (recortado) junto com o resto do contexto.
      let cited: { id: string; title: string; version: number; content: string } | null = null;
      if (body?.deliverableId) {
        const { data: d } = await admin.from("squad_deliverables").select("id, title, version, content, squad_id, owner_id").eq("id", String(body.deliverableId)).maybeSingle();
        if (!d || d.squad_id !== squad.id || d.owner_id !== user.id) throw new HttpError(404, "Entrega não encontrada");
        cited = { id: d.id, title: d.title, version: d.version, content: d.content };
        userMeta.cited = { id: d.id, title: d.title, version: d.version };
      }

      // Histórico da conversa (antes de gravar a mensagem nova) e contexto compartilhado.
      const { data: histRows } = await admin.from("squad_chat_messages").select("author, agent_id, content")
        .eq("squad_id", squad.id).eq("thread", thread).order("created_at", { ascending: false }).limit(CHAT_HISTORY_LIMIT);
      const nameById = new Map(agents.map((a) => [a.id, a.name]));
      const history: ChatLine[] = (histRows || []).reverse().map((h: any) => ({ author: h.author, agentName: h.agent_id ? nameById.get(h.agent_id) : undefined, content: h.content }));

      const { data: memRows } = await admin.from("squad_memories").select("id, kind, content, pinned, status, created_at")
        .eq("squad_id", squad.id).eq("owner_id", user.id).eq("status", "active");
      const memoryContext = buildMemoryContext(squad.memory || "", (memRows || []) as MemoryItem[]);

      const inserted: any[] = [];
      const insert = async (row: Record<string, unknown>) => {
        const { data, error } = await admin.from("squad_chat_messages").insert({ squad_id: squad.id, owner_id: user.id, thread, ...row }).select().single();
        if (error) throw error;
        inserted.push(data);
        return data;
      };
      await insert({ author: "user", content: clean, meta: userMeta });

      // Quem responde: mensagem direta → o agente; #time → @menção, senão o roteador (modelo barato), senão regras.
      let responders: string[] = [];
      let totalCost = 0;
      if (thread !== TEAM_THREAD) {
        responders = [thread];
      } else {
        responders = parseMentions(clean, agents);
        if (!responders.length) {
          let via: "llm" | "rules" = "rules";
          let reason = "";
          let routerCost = 0;
          const rp = buildRouterPrompt(agents, clean);
          const routed = await callWithFallback(admin, keys, {
            systemPrompt: rp.system, messages: [{ role: "user", content: rp.user }], temperature: 0, mode: "text", maxTokens: 120,
            modelOverridePerProvider: ROUTER_MODELS, deadlineAt: Date.now() + ROUTER_DEADLINE_MS,
          });
          if (routed && routed.ok && routed.output) {
            routerCost = estimateCost(routed.model!, routed.tokensInput, routed.tokensOutput);
            await logAiUsage(admin, { userId: user.id, provider: routed.provider!, model: routed.model!, tokensInput: routed.tokensInput, tokensOutput: routed.tokensOutput, promptType: "squad_chat_router" });
            const parsed = parseRouterReply(routed.output, agents);
            if (parsed.ids.length) { responders = parsed.ids; via = "llm"; reason = parsed.reason; }
          }
          if (!responders.length) responders = routeByRules(clean, agents);
          totalCost += routerCost;
          const names = responders.map((id) => nameById.get(id)).filter(Boolean).join(" e ");
          await insert({
            author: "system", content: `Roteador: ${names}${reason ? ` (${reason})` : ""}`, cost_usd: routerCost,
            meta: { router: { agents: responders, via, reason } },
          });
        }
      }

      // Contexto do trabalho mais recente (uma vez só; cada agente recorta a parte dele).
      const { data: lastMission } = await admin.from("squad_missions").select("id, briefing, status").eq("squad_id", squad.id).eq("owner_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      let delivs: any[] = [];
      if (lastMission) {
        const { data } = await admin.from("squad_deliverables").select("title, kind, status, content, agent_id, created_at")
          .eq("mission_id", lastMission.id).order("created_at", { ascending: false }).limit(40);
        delivs = data || [];
      }
      const citedBlock = cited
        ? `Entrega citada pelo dono, "${cited.title}" (versão ${cited.version}). Responda sobre ela:\n${clip(String(cited.content || ""), CHAT_CITED_CHARS)}`
        : "";
      const missionContextFor = (agentId: string): string => {
        const base = baseMissionContext(agentId);
        return [base, citedBlock].filter(Boolean).join("\n\n");
      };
      const baseMissionContext = (agentId: string): string => {
        if (!lastMission) return "";
        const latestPerTitle = new Map<string, any>();
        for (const d of delivs) if (!latestPerTitle.has(d.title)) latestPerTitle.set(d.title, d);
        const all = [...latestPerTitle.values()];
        const final = all.find((d) => d.kind === "Entrega");
        const own = all.filter((d) => d.agent_id === agentId && d.kind !== "Entrega").slice(0, 2);
        const parts = [`Última missão (${MISSION_STATUS[lastMission.status] || lastMission.status}). Pedido: ${clip(String(lastMission.briefing || ""), 400)}`];
        for (const d of own) parts.push(`Entrega sua, "${d.title}":\n${clip(String(d.content || ""), 2500)}`);
        if (final) parts.push(`Pacote final, "${final.title}":\n${clip(String(final.content || ""), 3000)}`);
        return clip(parts.join("\n\n"), CHAT_MISSION_CONTEXT_CHARS);
      };

      const deadlineAt = Date.now() + FUNCTION_DEADLINE_MS;
      const channel = thread === TEAM_THREAD ? "team" : "direct";

      // Quando o dono ensina algo duradouro ("use sempre Vancouver"), sugere um item de memória em paralelo às respostas.
      // Só sugere: o item entra como "suggested" e o dono confirma no próprio chat ou na aba Memória.
      const suggestMemory = async (): Promise<{ items: { id: string; kind: string; content: string }[]; cost: number } | null> => {
        try {
          const { data: existingRows } = await admin.from("squad_memories").select("content").eq("squad_id", squad.id).eq("owner_id", user.id).neq("status", "archived");
          const existing = (existingRows || []) as { content: string }[];
          const { count: pending } = await admin.from("squad_memories").select("id", { count: "exact", head: true })
            .eq("squad_id", squad.id).eq("owner_id", user.id).eq("status", "suggested");
          const room = Math.max(0, CHAT_MEMORY_MAX_PENDING - (pending || 0));
          if (!room) return null;
          const prompt = buildMemoryExtractionPrompt({
            source: "chat", ownerText: clean, existing,
            about: thread === TEAM_THREAD ? "canal #time" : `mensagem direta com ${nameById.get(thread)}`,
          });
          const res = await callWithFallback(admin, keys, {
            systemPrompt: prompt.system, messages: [{ role: "user", content: prompt.user }], temperature: 0.2, mode: "text", maxTokens: 800,
            deadlineAt: Date.now() + 25_000,
          });
          if (!res || !res.ok || !res.output) return null;
          const cost = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
          await logAiUsage(admin, { userId: user.id, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_chat_memory" });
          const items = parseMemoryExtraction(res.output, existing).slice(0, room);
          if (!items.length) return { items: [], cost };
          const { data: rows, error } = await admin.from("squad_memories")
            .insert(items.map((m) => ({ squad_id: squad.id, owner_id: user.id, kind: m.kind, content: m.content, source: "auto", status: "suggested" })))
            .select("id, kind, content");
          if (error) throw error;
          return { items: (rows || []) as { id: string; kind: string; content: string }[], cost };
        } catch (e) {
          console.warn("[squad-chat] suggestMemory failed:", (e as Error).message);
          return null;
        }
      };
      const memoryPromise = looksLikeTeaching(clean) ? suggestMemory() : Promise.resolve(null);
      const results = await Promise.all(responders.map(async (agentId) => {
        const agent = agents.find((a) => a.id === agentId)!;
        const system = buildChatSystemPrompt({
          agentSystemPrompt: agent.system_prompt, agentName: agent.name, team: agents.map((a) => ({ name: a.name, role: a.role })),
          memoryContext, missionContext: missionContextFor(agentId), channel,
        });
        const res = await callWithFallback(admin, keys, {
          systemPrompt: system, messages: [{ role: "user", content: buildTranscriptMessage(history, clean) }],
          temperature: 0.5, mode: "text", maxTokens: CHAT_MAX_OUTPUT_TOKENS, deadlineAt,
        });
        return { agent, res };
      }));

      for (const { agent, res } of results) {
        if (!res || !res.ok || !res.output) {
          await insert({ author: "system", agent_id: agent.id, content: `${agent.name} não conseguiu responder agora (provedor de IA indisponível). Tente de novo em instantes.`, meta: { error: true } });
          continue;
        }
        const cost = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
        totalCost += cost;
        await logAiUsage(admin, { userId: user.id, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_chat" });
        const content = res.output.trim() + (res.finishReason === "length" ? " […]" : "");
        await insert({
          author: "agent", agent_id: agent.id, content, cost_usd: cost, tokens_input: res.tokensInput, tokens_output: res.tokensOutput,
          provider: res.provider, model: res.model, meta: res.finishReason === "length" ? { truncated: true } : {},
        });
      }

      // Sugestão de memória (se o dono ensinou algo): vira um cartão no chat; o custo da extração conta no teto da conversa.
      const mem = await memoryPromise;
      if (mem) {
        totalCost += mem.cost;
        await insert({
          author: "system", content: mem.items.length ? "Sugestão de memória" : "Nada novo para guardar na memória", cost_usd: mem.cost,
          meta: { memory: { items: mem.items } },
        });
      }

      // Aviso quando a conversa cruza 80% ou 100% do teto do mês.
      const spentAfter = spentBefore + totalCost;
      const crossing = capCrossing(spentBefore, spentAfter, cap);
      if (crossing) {
        await insert({
          author: "system", meta: { cap: crossing },
          content: crossing === "exceeded"
            ? "Teto mensal da conversa atingido. Aumente o teto para continuar conversando."
            : "A conversa deste mês passou de 80% do teto.",
        });
      }
      return json({ messages: inserted, usage: usageOf(spentAfter, cap) });
    }

    throw new HttpError(400, "Ação desconhecida");
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
    console.error("[squad-chat] error:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
