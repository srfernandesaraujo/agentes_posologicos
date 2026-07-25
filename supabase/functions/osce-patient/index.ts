import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { stationId, history, userMessage } = await req.json();
    if (!stationId || !userMessage) {
      return new Response(JSON.stringify({ error: "stationId e userMessage obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: station } = await supabase
      .from("osce_stations")
      .select("title,patient_persona,patient_symptoms,patient_omissions,scenario_brief,exam_results")
      .eq("id", stationId)
      .maybeSingle();
    if (!station) {
      return new Response(JSON.stringify({ error: "Estação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exams = Array.isArray((station as any).exam_results) ? (station as any).exam_results : [];
    const examsBlock = exams.length
      ? exams.map((ex: any, i: number) => {
          const cat = ex.category || "exame";
          const notes = ex.notes?.trim() ? `\nLaudo/observações: ${ex.notes.trim()}` : "";
          return `### Exame ${i + 1} — ${ex.name || "(sem nome)"} [${cat}]\n${ex.content || ""}${notes}`;
        }).join("\n\n")
      : "(nenhum exame cadastrado)";

    const systemPrompt = `Você é um PACIENTE em uma simulação clínica OSCE. Responda SEMPRE em pt-BR, em primeira pessoa, com linguagem coloquial e realista, como uma pessoa leiga.

REGRAS CRÍTICAS:
- NUNCA quebre o personagem. Você é o paciente, não a IA.
- NUNCA mencione que é uma simulação, IA, modelo, ou que existe rubrica/avaliação.
- Responda APENAS o que o profissional perguntar. Não despeje informação não solicitada.
- Se ele perguntar algo vago, peça esclarecimento de forma humana ("Como assim, doutor?").
- OMISSÕES REALISTAS: só revele os itens da lista de omissões se o profissional perguntar especificamente.
- Demonstre emoções coerentes (dor, ansiedade, vergonha quando aplicável).
- Respostas curtas (1-4 frases). Sem listas, sem markdown.

REGRA DE EXAMES:
- Você TEM em mãos os exames listados em "## Exames disponíveis". Eles só devem ser entregues se o profissional solicitar/perguntar especificamente por algum exame (ex.: "trouxe algum exame?", "tem hemograma?", "me mostra o ECG").
- Quando entregar um exame: escreva UMA frase curta em personagem (ex.: "Trouxe sim, doutor, aqui está:") seguida de DUAS quebras de linha e então a TABELA MARKDOWN.
- FORMATO OBRIGATÓRIO DA TABELA (use \\n para nova linha — NUNCA coloque a tabela inteira em uma única linha):
  | Parâmetro | Resultado | Referência |
  | --- | --- | --- |
  | ... | ... | ... |
  Cada linha (cabeçalho, separador e cada linha de dados) DEVE estar em sua própria linha. Sem texto antes ou depois dos pipes na mesma linha.
- Se o conteúdo cadastrado já vier em tabela markdown, reproduza-o preservando as quebras de linha. Se vier como texto livre, converta para tabela com Parâmetro/Resultado/Referência quando fizer sentido.
- Após a tabela, se houver laudo/observações, deixe uma linha em branco e escreva: **Laudo:** <texto>.
- Se o profissional perguntar por um exame que NÃO está na lista, diga em personagem que não trouxe / não fez / não tem esse exame.
- Nunca invente valores de exame que não estejam cadastrados.

## Cenário
${station.scenario_brief}

## Sua persona
${station.patient_persona}

## Seus sintomas e história
${station.patient_symptoms}

## Informações que você SÓ revela se perguntado diretamente (omissões)
${station.patient_omissions || "(nenhuma omissão específica)"}

## Exames disponíveis (só entregar se solicitado)
${examsBlock}`;

    const messages = [
      ...(Array.isArray(history) ? history : []).map((m: any) => ({
        role: m.role === "patient" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
      { role: "user", content: String(userMessage) },
    ];

    const orderedKeys = await getOrderedKeysWithAdminFallback(supabase, null);
    const result = await callWithFallback(supabase, orderedKeys, {
      systemPrompt,
      messages,
      temperature: 0.85,
      mode: "text",
    });
    if (!result) {
      return new Response(JSON.stringify({ error: "Falha na IA", detail: "Nenhum provedor disponível" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const reply = result.output || "...";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});