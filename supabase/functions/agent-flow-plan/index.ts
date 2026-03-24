import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, user_id, preflight_answers } = await req.json();
    if (!description || !user_id) {
      return new Response(JSON.stringify({ error: "description e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load available agents
    const [nativeRes, customRes] = await Promise.all([
      supabase.from("agents").select("id, name, slug, description, category").eq("active", true),
      supabase.from("custom_agents").select("id, name, description").eq("user_id", user_id),
    ]);

    const nativeAgents = (nativeRes.data || []).map((a: any) => `- [NATIVO] ${a.name} (slug: ${a.slug}): ${a.description}`);
    const customAgentsList = (customRes.data || []).map((a: any) => `- [CUSTOM] ${a.name} (id: ${a.id}): ${a.description}`);

    const catalogText = [...nativeAgents, ...customAgentsList].join("\n");

    const systemPrompt = `Você é um ARQUITETO PREMIUM de fluxos de agentes de IA. Seu trabalho é criar planos de fluxo de altíssima qualidade, com prompts detalhados e completos para cada agente.

CATÁLOGO DE AGENTES DISPONÍVEIS:
${catalogText}

## SUAS RESPONSABILIDADES:

### 1. GERAR PROMPTS PREMIUM (500-1000 palavras cada)
Para cada agente no fluxo, você DEVE gerar um prompt completo e detalhado no campo "new_agent_prompt" (mesmo para agentes existentes, este prompt será usado como instrução de contexto). O prompt deve seguir esta estrutura:

<OBJETIVO>
[Descrição precisa do que este agente deve produzir nesta etapa do pipeline]
</OBJETIVO>

<INSTRUCOES>
[Instruções detalhadas passo-a-passo de COMO realizar a tarefa]
[Inclua técnicas específicas, frameworks, metodologias]
[Se o agente precisa pesquisar: especifique QUAIS fontes, COMO buscar, QUAIS termos usar]
[Se o agente precisa formatar: especifique EXATAMENTE o formato esperado com exemplos]
</INSTRUCOES>

<FORMATO_SAIDA>
[Descrição EXATA do formato de saída esperado]
[Inclua exemplos de estrutura, seções, títulos]
[Especifique extensão mínima/máxima se aplicável]
</FORMATO_SAIDA>

<REGRAS>
1. NÃO faça perguntas ao usuário durante a execução. Use as informações do pipeline e sua expertise.
2. Se faltar informação, assuma a alternativa mais razoável e justifique brevemente.
3. Produza conteúdo COMPLETO e DEFINITIVO, não rascunhos ou esboços.
4. Sua resposta deve ter no MÍNIMO 800 palavras (exceto se a tarefa for naturalmente curta).
</REGRAS>

<LIMITACOES>
[O que este agente NÃO deve fazer]
[Limites de escopo para não invadir o trabalho de outros agentes]
</LIMITACOES>

### 2. AUTO-DETECÇÃO DE MODO (execution_mode)
Analise as dependências entre as etapas e determine automaticamente:
- "sequential": quando cada etapa depende do resultado da anterior (pipeline linear)
- "parallel": quando 2+ etapas podem trabalhar independentemente e um sintetizador final consolida

REGRAS DE DETECÇÃO:
- Se a descrição menciona "pesquisar E analisar E redigir" em cadeia → sequential
- Se menciona tarefas independentes ("um agente faz X enquanto outro faz Y") → parallel
- Se menciona "coordenador" ou "planejador" que alimenta múltiplos agentes → parallel
- Se há uma etapa final de "revisão", "consolidação" ou "integração" → o modo depende do que vem antes
- Na dúvida, prefira sequential (mais simples e previsível)

### 3. PREFLIGHT QUESTIONS
Se algum agente REALMENTE precisa de informação que não está na descrição do usuário, compile TODAS as perguntas de TODOS os agentes em "preflight_questions". Exemplos:
- "Qual o público-alvo do texto? (estudantes, profissionais, público geral)"
- "Qual o tom desejado? (formal acadêmico, informal educativo, técnico)"
- "Qual o idioma de saída desejado?"

NÃO inclua perguntas óbvias ou que podem ser inferidas da descrição.
Se a descrição já contém informação suficiente, retorne preflight_questions como array vazio [].

### 4. INSTRUÇÃO DE FERRAMENTAS
Quando um agente precisar de pesquisa externa, inclua instruções EXPLÍCITAS no prompt:
- Para pesquisa acadêmica: "Realize pesquisa bibliográfica abrangente usando suas capacidades de busca. Cite artigos com autores, ano e DOI quando disponível."
- Para dados atualizados: "Busque informações recentes e atualizadas sobre o tema. Priorize fontes oficiais e dados de 2024-2026."
- Para análise de dados: "Analise os dados fornecidos usando métodos estatísticos apropriados. Apresente resultados em tabelas Markdown."

### 5. REGRAS DE QUALIDADE
- Cada agente deve ter um papel DISTINTO e CLARO no pipeline
- NÃO crie agentes redundantes
- O primeiro agente deve receber o input do usuário de forma clara
- O último agente (ou sintetizador em modo paralelo) deve entregar o PRODUTO FINAL prometido
- Para modo paralelo: marque o último nó como is_synthesizer=true

### 6. SELEÇÃO DE AGENTES
- Prefira agentes existentes do catálogo quando adequados
- Crie novos agentes (agent_type="new") apenas quando necessário
- Para novos agentes: gere name, description E system_prompt completo

RESPONDA APENAS com a tool call create_flow_plan.`;

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have preflight answers, append them to the description
    let enrichedDescription = description;
    if (preflight_answers && typeof preflight_answers === "object") {
      const answersText = Object.entries(preflight_answers)
        .map(([q, a]) => `Pergunta: ${q}\nResposta: ${a}`)
        .join("\n\n");
      enrichedDescription = `${description}\n\n--- INFORMAÇÕES ADICIONAIS DO USUÁRIO ---\n${answersText}`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: enrichedDescription },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_flow_plan",
              description: "Cria um plano de fluxo de agentes premium com prompts detalhados",
              parameters: {
                type: "object",
                properties: {
                  flow_name: { type: "string", description: "Nome do fluxo" },
                  flow_description: { type: "string", description: "Descrição breve do fluxo" },
                  execution_mode: { type: "string", enum: ["sequential", "parallel"], description: "Modo de execução auto-detectado" },
                  preflight_questions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Perguntas que precisam ser respondidas ANTES da execução do fluxo. Array vazio se não necessário.",
                  },
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        agent_id: { type: "string", description: "ID ou slug do agente existente, ou 'CREATE_NEW' se precisa criar" },
                        agent_type: { type: "string", enum: ["native", "custom", "new"] },
                        input_prompt: { type: "string", description: "Instrução de contexto curta para o nó no pipeline" },
                        new_agent_name: { type: "string", description: "Nome do novo agente (se agent_type=new)" },
                        new_agent_description: { type: "string", description: "Descrição do novo agente (se agent_type=new)" },
                        new_agent_prompt: { type: "string", description: "Prompt COMPLETO e DETALHADO do agente (500-1000 palavras) com seções OBJETIVO, INSTRUCOES, FORMATO_SAIDA, REGRAS, LIMITACOES" },
                        is_synthesizer: { type: "boolean", description: "True se este é o nó sintetizador final (apenas em modo parallel)" },
                      },
                      required: ["agent_id", "agent_type", "input_prompt", "new_agent_prompt"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["flow_name", "flow_description", "execution_mode", "preflight_questions", "nodes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_flow_plan" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no gateway de IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao gerar plano com IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou plano estruturado");

    const plan = JSON.parse(toolCall.function.arguments);

    // If there are preflight questions and no answers yet, return them without creating the flow
    if (plan.preflight_questions?.length > 0 && !preflight_answers) {
      return new Response(
        JSON.stringify({
          needs_preflight: true,
          preflight_questions: plan.preflight_questions,
          plan_preview: {
            flow_name: plan.flow_name,
            execution_mode: plan.execution_mode,
            node_count: plan.nodes.length,
            node_names: plan.nodes.map((n: any) => n.new_agent_name || n.agent_id),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the flow with auto-detected execution_mode
    const executionMode = plan.execution_mode || "sequential";
    const { data: flow, error: flowErr } = await supabase
      .from("agent_flows")
      .insert({
        user_id,
        name: plan.flow_name,
        description: plan.flow_description,
        execution_mode: executionMode,
      })
      .select()
      .single();

    if (flowErr) throw flowErr;

    // Resolve agents and create nodes
    const allNative = nativeRes.data || [];
    const allCustom = customRes.data || [];

    const isParallel = executionMode === "parallel";
    const nodeCount = plan.nodes.length;

    for (let i = 0; i < nodeCount; i++) {
      const planNode = plan.nodes[i];
      let agentId: string;
      let agentType = planNode.agent_type;

      if (agentType === "new") {
        // Create a new custom agent with the premium prompt
        const { data: newAgent, error: newErr } = await supabase
          .from("custom_agents")
          .insert({
            user_id,
            name: planNode.new_agent_name || `Agente ${i + 1}`,
            description: planNode.new_agent_description || "",
            system_prompt: planNode.new_agent_prompt || planNode.input_prompt || "",
            status: "active",
          })
          .select()
          .single();

        if (newErr) throw newErr;
        agentId = newAgent.id;
        agentType = "custom";
      } else if (agentType === "native") {
        const found = allNative.find((a: any) => a.slug === planNode.agent_id || a.id === planNode.agent_id);
        agentId = found?.id || planNode.agent_id;
      } else {
        agentId = planNode.agent_id;
      }

      // Position nodes: parallel mode puts non-synthesizer nodes side by side
      let x: number, y: number;
      if (isParallel) {
        const isSynth = planNode.is_synthesizer === true;
        if (isSynth) {
          // Synthesizer centered below
          x = 100 + ((nodeCount - 2) * 250) / 2;
          y = 300;
        } else {
          // Parallel nodes side by side at top
          const parallelIndex = plan.nodes.slice(0, i).filter((n: any) => !n.is_synthesizer).length;
          x = 100 + parallelIndex * 250;
          y = 80;
        }
      } else {
        x = 100 + (i % 3) * 250;
        y = 80 + Math.floor(i / 3) * 140;
      }

      await supabase
        .from("agent_flow_nodes")
        .insert({
          flow_id: flow.id,
          agent_id: agentId,
          agent_type: agentType,
          position_x: x,
          position_y: y,
          sort_order: i,
          input_prompt: planNode.input_prompt || "",
          is_synthesizer: planNode.is_synthesizer === true,
        })
        .select()
        .single();
    }

    // Create edges
    const { data: createdNodes } = await supabase
      .from("agent_flow_nodes")
      .select("id, is_synthesizer, sort_order")
      .eq("flow_id", flow.id)
      .order("sort_order");

    if (createdNodes && createdNodes.length > 1) {
      if (isParallel) {
        // Parallel: all non-synthesizer nodes connect to synthesizer
        const synthNode = createdNodes.find((n: any) => n.is_synthesizer);
        const parallelNodes = createdNodes.filter((n: any) => !n.is_synthesizer);
        if (synthNode) {
          for (const pn of parallelNodes) {
            await supabase.from("agent_flow_edges").insert({
              flow_id: flow.id,
              source_node_id: pn.id,
              target_node_id: synthNode.id,
            });
          }
        }
      } else {
        // Sequential: chain nodes
        for (let i = 0; i < createdNodes.length - 1; i++) {
          await supabase.from("agent_flow_edges").insert({
            flow_id: flow.id,
            source_node_id: createdNodes[i].id,
            target_node_id: createdNodes[i + 1].id,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ flow_id: flow.id, plan, execution_mode: executionMode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Flow plan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
