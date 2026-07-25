import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysForUser, callWithFallback, logAiUsage } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um extrator de fatos duráveis sobre o usuário a partir do diálogo dele com um assistente de IA na área da saúde/educação.

REGRAS:
- Extraia APENAS fatos sobre o USUÁRIO (profissão, contexto institucional, público que ele atende, projetos em andamento, preferências de estilo, restrições, ferramentas que usa).
- NÃO extraia conteúdo da resposta do assistente, conhecimento factual médico, ou perguntas pontuais.
- Cada fato deve ser uma frase curta em pt-BR (máx 140 caracteres), autocontida e útil em futuras conversas.
- Se nada útil for encontrado, retorne lista vazia.
- Não invente. Use SOMENTE o que está explícito ou claramente implícito na mensagem do usuário.
- Máximo 5 fatos por extração.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate user with anon client to derive userId from JWT
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const userMessage: string = String(body?.userMessage ?? "").slice(0, 4000);
    const sessionId: string | null = body?.sessionId ?? null;
    if (!userMessage || userMessage.trim().length < 20) {
      return new Response(JSON.stringify({ extracted: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    // Respect user opt-out
    const { data: ctx } = await service
      .from("user_profile_context")
      .select("memory_enabled, auto_extract_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (ctx && (ctx.memory_enabled === false || ctx.auto_extract_enabled === false)) {
      return new Response(JSON.stringify({ extracted: 0, skipped: "opt-out" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orderedKeys = await getOrderedKeysForUser(service, userId);
    const result = await callWithFallback(service, orderedKeys, {
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: `Mensagem do usuário:\n"""${userMessage}"""` }],
      mode: "tools",
      tools: [{
        type: "function",
        function: {
          name: "save_user_facts",
          description: "Salva fatos duráveis sobre o usuário",
          parameters: {
            type: "object",
            properties: {
              facts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    fact: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["fact"],
                },
              },
            },
            required: ["facts"],
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "save_user_facts" } },
    });

    if (!result) {
      console.error("extract-user-facts: all providers failed");
      return new Response(JSON.stringify({ extracted: 0, error: "ai_error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await logAiUsage(service, {
      userId,
      provider: result.provider!,
      model: result.model!,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      promptType: "extract-user-facts",
    });
    const parsed = result.toolCallArgs || {};
    const facts: Array<{ fact: string; confidence?: number }> = Array.isArray(parsed?.facts) ? parsed.facts : [];

    // Dedupe vs existing active facts
    const { data: existing } = await service
      .from("user_memory_facts")
      .select("fact")
      .eq("user_id", userId)
      .eq("active", true);
    const seen = new Set((existing || []).map((r: any) => String(r.fact).toLowerCase().trim()));

    const rows = facts
      .map(f => ({ fact: String(f.fact || "").trim(), confidence: typeof f.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : 0.7 }))
      .filter(f => f.fact.length >= 6 && f.fact.length <= 200 && !seen.has(f.fact.toLowerCase()))
      .slice(0, 5)
      .map(f => ({ user_id: userId, fact: f.fact, confidence: f.confidence, source_session_id: sessionId, active: true }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ extracted: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: insErr } = await service.from("user_memory_facts").insert(rows);
    if (insErr) {
      console.error("Insert error", insErr);
      return new Response(JSON.stringify({ extracted: 0, error: "insert_error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ extracted: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-user-facts error", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});