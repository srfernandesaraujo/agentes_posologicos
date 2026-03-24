import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function topologicalSort(nodes: any[], edges: any[]): any[] {
  let executionOrder = [...nodes];
  if (edges && edges.length > 0) {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    nodes.forEach((n: any) => {
      inDegree.set(n.id, 0);
      adjList.set(n.id, []);
    });
    edges.forEach((e: any) => {
      inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
      adjList.get(e.source_node_id)?.push(e.target_node_id);
    });
    const queue: string[] = [];
    inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });
    const sorted: string[] = [];
    while (queue.length) {
      const curr = queue.shift()!;
      sorted.push(curr);
      for (const next of adjList.get(curr) || []) {
        inDegree.set(next, (inDegree.get(next) || 0) - 1);
        if (inDegree.get(next) === 0) queue.push(next);
      }
    }
    if (sorted.length === nodes.length) {
      const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
      executionOrder = sorted.map((id) => nodeMap.get(id)!);
    }
  }
  return executionOrder;
}

// BFS layering: group nodes by depth level for parallel execution
function bfsLayers(nodes: any[], edges: any[]): any[][] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  nodes.forEach((n: any) => {
    inDegree.set(n.id, 0);
    adjList.set(n.id, []);
  });
  edges.forEach((e: any) => {
    inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
    adjList.get(e.source_node_id)?.push(e.target_node_id);
  });

  const layers: any[][] = [];
  let currentLayer: string[] = [];
  inDegree.forEach((deg, id) => { if (deg === 0) currentLayer.push(id); });

  const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));

  while (currentLayer.length > 0) {
    layers.push(currentLayer.map(id => nodeMap.get(id)!));
    const nextLayer: string[] = [];
    for (const id of currentLayer) {
      for (const next of adjList.get(id) || []) {
        inDegree.set(next, (inDegree.get(next) || 0) - 1);
        if (inDegree.get(next) === 0) nextLayer.push(next);
      }
    }
    currentLayer = nextLayer;
  }

  return layers;
}

async function authenticateUser(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await tempClient.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userId = await authenticateUser(req, supabaseUrl, supabaseAnonKey);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode = body.mode || "full";
    const supabase = createClient(supabaseUrl, serviceKey);

    // ========== MODE: INIT ==========
    if (mode === "init") {
      const { flow_id, initial_input } = body;
      if (!flow_id || !initial_input) {
        return new Response(JSON.stringify({ error: "flow_id e initial_input são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: flowData, error: flowError } = await supabase
        .from("agent_flows").select("id, user_id, execution_mode").eq("id", flow_id).single();
      if (flowError || !flowData || flowData.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Fluxo não encontrado ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const executionMode = flowData.execution_mode || "sequential";

      const [{ data: nodes, error: nodesErr }, { data: edges }] = await Promise.all([
        supabase.from("agent_flow_nodes").select("*").eq("flow_id", flow_id).order("sort_order"),
        supabase.from("agent_flow_edges").select("*").eq("flow_id", flow_id),
      ]);

      if (nodesErr || !nodes?.length) {
        return new Response(JSON.stringify({ error: "Fluxo sem nós configurados" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load agent details
      const nativeIds = nodes.filter((n: any) => n.agent_type === "native").map((n: any) => n.agent_id);
      const customIds = nodes.filter((n: any) => n.agent_type === "custom").map((n: any) => n.agent_id);
      const [nativeRes, customRes] = await Promise.all([
        nativeIds.length ? supabase.from("agents").select("id, name, slug").in("id", nativeIds) : { data: [] },
        customIds.length ? supabase.from("custom_agents").select("id, name").in("id", customIds) : { data: [] },
      ]);

      const agentMap = new Map<string, any>();
      (nativeRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "native" }));
      (customRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "custom" }));

      for (const node of nodes) {
        if (!agentMap.has(node.agent_id)) {
          return new Response(JSON.stringify({
            error: `Agente não encontrado (agent_id: ${node.agent_id}, tipo: ${node.agent_type})`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { data: execution, error: execErr } = await supabase
        .from("agent_flow_executions")
        .insert({ flow_id, user_id: userId, status: "running", initial_input })
        .select().single();
      if (execErr) throw execErr;

      if (executionMode === "parallel") {
        // BFS layering for parallel execution
        const layers = bfsLayers(nodes, edges || []);
        const levels = layers.map((layer, levelIdx) =>
          layer.map((node: any) => {
            const agent = agentMap.get(node.agent_id);
            return {
              node_id: node.id,
              agent_id: node.agent_id,
              agent_type: node.agent_type,
              agent_name: agent?.name || "Agente",
              input_prompt: node.input_prompt || "",
              is_synthesizer: node.is_synthesizer || false,
            };
          })
        );

        return new Response(JSON.stringify({
          execution_id: execution.id,
          execution_mode: "parallel",
          levels,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sequential mode (default)
      const executionOrder = topologicalSort(nodes, edges || []);
      const steps = executionOrder.map((node: any, index: number) => {
        const agent = agentMap.get(node.agent_id);
        return {
          index,
          node_id: node.id,
          agent_id: node.agent_id,
          agent_type: node.agent_type,
          agent_name: agent?.name || "Agente",
          input_prompt: node.input_prompt || "",
        };
      });

      return new Response(JSON.stringify({ execution_id: execution.id, execution_mode: "sequential", steps }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== MODE: PARALLEL-STEP ==========
    // Executes multiple nodes in parallel (same level)
    if (mode === "parallel-step") {
      const { execution_id, steps: parallelSteps, input_text, level_index, total_levels, all_levels, initial_input } = body;

      if (!execution_id || !parallelSteps?.length || !input_text) {
        return new Response(JSON.stringify({ error: "execution_id, steps e input_text são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: exec } = await supabase
        .from("agent_flow_executions").select("user_id").eq("id", execution_id).single();
      if (!exec || exec.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Execução não encontrada ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute all steps in this level in parallel
      const results = await Promise.all(parallelSteps.map(async (step: any) => {
        const { data: nodeResult } = await supabase
          .from("agent_flow_node_results")
          .insert({
            execution_id, node_id: step.node_id, input_text, status: "running",
            started_at: new Date().toISOString(),
          })
          .select().single();

        try {
          let contextMessage = input_text;
          if (step.input_prompt) {
            contextMessage = `${step.input_prompt}\n\n---\n\nConteúdo de entrada:\n${input_text}`;
          }

          // Build pipeline description
          let pipelineDesc = "";
          if (all_levels && Array.isArray(all_levels)) {
            pipelineDesc = all_levels.map((level: any[], li: number) => {
              const names = level.map((s: any) => s.agent_name).join(", ");
              const marker = li === level_index ? " ← NÍVEL ATUAL" : "";
              return `  Nível ${li + 1}: [${names}]${marker}`;
            }).join("\n");
          }

          const isSynthesizer = step.is_synthesizer === true;

          let flowInstruction = `\n\n<FLOW_MODE_INSTRUCTION>
IMPORTANTE: Você está operando dentro de um FLUXO PARALELO DE AGENTES (Nível ${(level_index || 0) + 1} de ${total_levels || "?"}).
${isSynthesizer ? "VOCÊ É O AGENTE SINTETIZADOR — sua tarefa é integrar e consolidar TODOS os resultados dos agentes anteriores em uma entrega única e coesa." : "Você é um dos agentes executando EM PARALELO neste nível."}

PIPELINE COMPLETO:
${pipelineDesc || "(não disponível)"}

REGRAS OBRIGATÓRIAS DO MODO FLUXO:
1. NÃO inicie com saudação, apresentação pessoal ou descrição do que você faz. Vá DIRETO ao conteúdo.
2. NUNCA diga "me aguarde", "por favor aguarde enquanto processo" ou qualquer variação. PRODUZA o conteúdo diretamente.
3. REGRA DE AUTONOMIA MÁXIMA: Você NÃO deve fazer perguntas ao usuário. Todas as informações necessárias já foram fornecidas. Se faltar algo, tome a decisão mais razoável e justifique brevemente.
4. Entregue sua resposta COMPLETA e DEFINITIVA imediatamente.
5. NUNCA inclua sugestões de interação ou ofertas como "Posso te ajudar com...", "Deseja que eu...". TERMINANTEMENTE PROIBIDO.
6. Use tabelas Markdown formatadas corretamente quando aplicável.
7. Produza APENAS o que sua especialidade pede.
8. Sua resposta deve ter no MÍNIMO 800 palavras de conteúdo substantivo.
</FLOW_MODE_INSTRUCTION>`;

          const enrichedInput = contextMessage + flowInstruction;

          const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              agentId: step.agent_id,
              input: enrichedInput,
              userId,
              conversationHistory: [],
              skipCredits: true,
              flowMode: true,
            }),
          });

          const responseText = await chatResponse.text();
          if (!chatResponse.ok) throw new Error(`Erro do agente: ${responseText}`);

          let output = "";
          try {
            const json = JSON.parse(responseText);
            output = json.output || json.response || responseText;
          } catch {
            output = responseText;
          }

          if (!output || output.trim().length === 0) throw new Error("Agente retornou resposta vazia");

          await supabase.from("agent_flow_node_results").update({
            output_text: output, status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", nodeResult!.id);

          return { node_id: step.node_id, agent_name: step.agent_name, output, status: "completed" };
        } catch (e: any) {
          await supabase.from("agent_flow_node_results").update({
            output_text: e.message, status: "error",
            completed_at: new Date().toISOString(),
          }).eq("id", nodeResult!.id);

          return { node_id: step.node_id, agent_name: step.agent_name, output: e.message, status: "error" };
        }
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== MODE: SYNTHESIZE ==========
    // Runs a synthesizer node with all parallel outputs as context
    if (mode === "synthesize") {
      const { execution_id, node_id, agent_id, parallel_outputs, input_text, total_levels } = body;

      if (!execution_id || !node_id || !agent_id || !parallel_outputs) {
        return new Response(JSON.stringify({ error: "Parâmetros obrigatórios faltando" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: exec } = await supabase
        .from("agent_flow_executions").select("user_id").eq("id", execution_id).single();
      if (!exec || exec.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Execução não encontrada" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build synthesizer input
      const parallelSection = parallel_outputs.map((po: any) =>
        `[${po.agent_name}]:\n${po.output}`
      ).join("\n---\n");

      const synthInput = `${input_text || ""}

<RESULTADOS_PARALELOS>
${parallelSection}
</RESULTADOS_PARALELOS>

Sua tarefa: integrar e consolidar os resultados acima em uma entrega coesa e completa. Combine as perspectivas de cada agente de forma harmoniosa.`;

      const { data: nodeResult } = await supabase
        .from("agent_flow_node_results")
        .insert({
          execution_id, node_id, input_text: synthInput, status: "running",
          started_at: new Date().toISOString(),
        })
        .select().single();

      try {
        const flowInstruction = `\n\n<FLOW_MODE_INSTRUCTION>
IMPORTANTE: Você é o AGENTE SINTETIZADOR no fluxo paralelo.

REGRAS:
1. Você recebeu resultados de múltiplos agentes que trabalharam em paralelo.
2. Sua tarefa é INTEGRAR todos os resultados em uma entrega ÚNICA e COESA.
3. NÃO repita conteúdo idêntico — sintetize, combine e organize.
4. NÃO inicie com saudação. Vá DIRETO ao conteúdo consolidado.
5. Use formatação Markdown com tabelas quando aplicável.
6. O resultado final deve ser MELHOR do que qualquer resultado individual.
</FLOW_MODE_INSTRUCTION>`;

        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agentId: agent_id,
            input: synthInput + flowInstruction,
            userId,
            conversationHistory: [],
            skipCredits: true,
            flowMode: true,
          }),
        });

        const responseText = await chatResponse.text();
        if (!chatResponse.ok) throw new Error(`Erro do sintetizador: ${responseText}`);

        let output = "";
        try {
          const json = JSON.parse(responseText);
          output = json.output || json.response || responseText;
        } catch {
          output = responseText;
        }

        if (!output || output.trim().length === 0) throw new Error("Sintetizador retornou resposta vazia");

        await supabase.from("agent_flow_node_results").update({
          output_text: output, status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", nodeResult!.id);

        return new Response(JSON.stringify({ output, status: "completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await supabase.from("agent_flow_node_results").update({
          output_text: e.message, status: "error",
          completed_at: new Date().toISOString(),
        }).eq("id", nodeResult!.id);

        return new Response(JSON.stringify({ output: e.message, status: "error", error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ========== MODE: STEP ==========
    if (mode === "step") {
      const { execution_id, node_id, agent_id, input_text, conversation_history, previous_stage_output, stage_number, total_stages, pipeline_context, initial_input } = body;

      if (!execution_id || !node_id || !agent_id || !input_text) {
        return new Response(JSON.stringify({ error: "execution_id, node_id, agent_id e input_text são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: exec } = await supabase
        .from("agent_flow_executions").select("user_id").eq("id", execution_id).single();
      if (!exec || exec.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Execução não encontrada ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: nodeResult } = await supabase
        .from("agent_flow_node_results")
        .insert({
          execution_id, node_id, input_text, status: "running",
          started_at: new Date().toISOString(),
        })
        .select().single();

      try {
        const history = conversation_history || [];

        let pipelineDesc = "";
        if (pipeline_context && Array.isArray(pipeline_context)) {
          pipelineDesc = pipeline_context.map((s: any, i: number) => {
            const marker = i + 1 === (stage_number || 0) ? " ← VOCÊ ESTÁ AQUI" : "";
            return `  Etapa ${i + 1}: ${s.agent_name}${marker}`;
          }).join("\n");
        }

        // Build topic anchor from initial_input
        const topicAnchor = initial_input || input_text;

        let flowInstruction = `\n\n<TEMA_ORIGINAL_DO_FLUXO>
O tema/solicitação ORIGINAL do usuário que iniciou este fluxo é:
"${topicAnchor}"
REGRA CRÍTICA DE COERÊNCIA: TODO o seu conteúdo DEVE estar 100% alinhado com este tema original. Se o tema é sobre semaglutida, você DEVE falar sobre semaglutida. Se é sobre educação, fale sobre educação. NUNCA desvie do tema original. Qualquer desvio temático é considerado uma FALHA GRAVE.
</TEMA_ORIGINAL_DO_FLUXO>

<FLOW_MODE_INSTRUCTION>
IMPORTANTE: Você está operando dentro de um FLUXO SEQUENCIAL DE AGENTES (Etapa ${stage_number || "?"} de ${total_stages || "?"}).

PIPELINE COMPLETO:
${pipelineDesc || "(não disponível)"}

REGRAS OBRIGATÓRIAS DO MODO FLUXO:
1. NÃO inicie com saudação, apresentação pessoal ou descrição do que você faz. Vá DIRETO ao conteúdo. Nunca diga "Olá! Sou o...", "Transformo qualquer conteúdo em...", "Perfeito! Entendido...", "Vou gerar...", etc.
2. NUNCA diga "me aguarde", "por favor aguarde enquanto processo", "aguarde enquanto eu preparo" ou qualquer variação. Simplesmente PRODUZA o conteúdo diretamente.
3. REGRA DE AUTONOMIA MÁXIMA: Você NÃO deve fazer perguntas ao usuário durante a execução do fluxo. Todas as informações necessárias já foram fornecidas no input inicial e no contexto do pipeline. Se alguma informação estiver faltando, tome a decisão mais razoável e justifique brevemente sua escolha. NUNCA interrompa o fluxo com perguntas.
4. NÃO confunda perguntas pedagógicas/didáticas (perguntas socráticas, perguntas de estudo de caso, questões para discussão em sala) com perguntas ao usuário. Perguntas pedagógicas fazem parte do CONTEÚDO e devem ser incluídas normalmente.
5. Entregue sua resposta COMPLETA e DEFINITIVA imediatamente. Não peça permissão, não pergunte "posso prosseguir?", não diga "vou preparar".
6. NUNCA inclua sugestões de interação, listas de próximos passos ou ofertas como "Posso te ajudar com...", "Deseja que eu...", "Agora posso...", "Quer que eu...", etc. TERMINANTEMENTE PROIBIDO.
7. Se esta não é a primeira etapa, sua entrega DEVE ser complementar e construída sobre o resultado da etapa anterior. Integre e referencie o conteúdo anterior. NÃO repita ou resuma o que já foi entregue na etapa anterior — use como base e avance.
8. Ao finalizar sua entrega, inclua um parágrafo de TRANSIÇÃO explicando como seu resultado será utilizado na próxima etapa do fluxo (se houver próxima etapa).
9. Use tabelas Markdown formatadas corretamente quando aplicável.
10. Você é o agente da Etapa ${stage_number}. Produza APENAS o que sua especialidade pede. Não produza conteúdo que pertence a outras etapas.
11. NÃO mencione que algo "já foi fornecido", "já foi respondido" ou "já foi entregue" na etapa anterior. Simplesmente use a informação e produza seu conteúdo.
12. Sua resposta deve ter no MÍNIMO 800 palavras de conteúdo substantivo (exceto se a tarefa for naturalmente curta como classificação ou validação).
13. COERÊNCIA TEMÁTICA: Releia o <TEMA_ORIGINAL_DO_FLUXO> antes de produzir qualquer conteúdo. TODO o seu output deve ser sobre EXATAMENTE aquele tema. Não misture temas nem faça analogias extensas com outros assuntos.
</FLOW_MODE_INSTRUCTION>`;

        if (previous_stage_output && (stage_number || 0) > 1) {
          flowInstruction += `\n\n<RESULTADO_ETAPA_ANTERIOR>
O resultado da etapa anterior do fluxo é apresentado abaixo. Sua resposta DEVE ser complementar a este conteúdo, integrando-o e construindo sobre ele. NÃO repita o conteúdo anterior, mas referencie-o e expanda com sua especialidade. MANTENHA O MESMO TEMA — o tema é: "${topicAnchor}"
---
${previous_stage_output}
</RESULTADO_ETAPA_ANTERIOR>`;
        }

        const enrichedInput = input_text + flowInstruction;

        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agentId: agent_id,
            input: enrichedInput,
            userId,
            conversationHistory: history,
            skipCredits: true,
            flowMode: true,
          }),
        });

        const responseText = await chatResponse.text();
        if (!chatResponse.ok) throw new Error(`Erro do agente: ${responseText}`);

        let output = "";
        try {
          const json = JSON.parse(responseText);
          output = json.output || json.response || responseText;
        } catch {
          output = responseText;
        }

        if (!output || output.trim().length === 0) throw new Error("Agente retornou resposta vazia");

        await supabase.from("agent_flow_node_results").update({
          output_text: output, status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", nodeResult!.id);

        return new Response(JSON.stringify({ output, status: "completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await supabase.from("agent_flow_node_results").update({
          output_text: e.message, status: "error",
          completed_at: new Date().toISOString(),
        }).eq("id", nodeResult!.id);

        return new Response(JSON.stringify({ output: e.message, status: "error", error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ========== MODE: COMPLETE ==========
    if (mode === "complete") {
      const { execution_id, final_output, flow_id } = body;
      await supabase.from("agent_flow_executions").update({
        status: "completed", final_output,
        completed_at: new Date().toISOString(),
      }).eq("id", execution_id);

      if (flow_id) {
        await supabase.from("agent_flows").update({ status: "completed" }).eq("id", flow_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== MODE: FULL (backward compatible) ==========
    const { flow_id, initial_input } = body;
    if (!flow_id || !initial_input) {
      return new Response(JSON.stringify({ error: "flow_id e initial_input são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: flowData, error: flowError } = await supabase
      .from("agent_flows").select("id, user_id").eq("id", flow_id).single();
    if (flowError || !flowData || flowData.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Fluxo não encontrado ou sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: nodes, error: nodesErr }, { data: edges }] = await Promise.all([
      supabase.from("agent_flow_nodes").select("*").eq("flow_id", flow_id).order("sort_order"),
      supabase.from("agent_flow_edges").select("*").eq("flow_id", flow_id),
    ]);

    if (nodesErr || !nodes?.length) {
      return new Response(JSON.stringify({ error: "Fluxo sem nós configurados" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const executionOrder = topologicalSort(nodes, edges || []);

    const nativeIds = executionOrder.filter((n: any) => n.agent_type === "native").map((n: any) => n.agent_id);
    const customIds = executionOrder.filter((n: any) => n.agent_type === "custom").map((n: any) => n.agent_id);
    const [nativeRes, customRes] = await Promise.all([
      nativeIds.length ? supabase.from("agents").select("id, name, slug").in("id", nativeIds) : { data: [] },
      customIds.length ? supabase.from("custom_agents").select("id, name").in("id", customIds) : { data: [] },
    ]);

    const agentMap = new Map<string, any>();
    (nativeRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "native" }));
    (customRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "custom" }));

    for (const node of executionOrder) {
      if (!agentMap.has(node.agent_id)) {
        return new Response(JSON.stringify({ error: `Agente não encontrado (agent_id: ${node.agent_id})` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: execution, error: execErr } = await supabase
      .from("agent_flow_executions")
      .insert({ flow_id, user_id: userId, status: "running", initial_input })
      .select().single();
    if (execErr) throw execErr;

    let currentInput = initial_input;
    const nodeResults: any[] = [];

    for (const node of executionOrder) {
      const agent = agentMap.get(node.agent_id);
      const agentName = agent?.name || "Agente";

      const { data: nodeResult } = await supabase
        .from("agent_flow_node_results")
        .insert({ execution_id: execution.id, node_id: node.id, input_text: currentInput, status: "running", started_at: new Date().toISOString() })
        .select().single();

      try {
        let contextMessage = currentInput;
        if (node.input_prompt) {
          contextMessage = `${node.input_prompt}\n\n---\n\nConteúdo de entrada:\n${currentInput}`;
        }

        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ agentId: node.agent_id, input: contextMessage, userId, conversationHistory: [], skipCredits: true }),
        });

        const responseText = await chatResponse.text();
        if (!chatResponse.ok) throw new Error(`Erro do agente "${agentName}": ${responseText}`);

        let fullOutput = "";
        try { const json = JSON.parse(responseText); fullOutput = json.output || json.response || responseText; } catch { fullOutput = responseText; }
        if (!fullOutput || fullOutput.trim().length === 0) throw new Error(`Agente "${agentName}" retornou resposta vazia`);

        await supabase.from("agent_flow_node_results").update({ output_text: fullOutput, status: "completed", completed_at: new Date().toISOString() }).eq("id", nodeResult!.id);
        nodeResults.push({ node_id: node.id, agent_name: agentName, agent_id: node.agent_id, agent_type: node.agent_type, input_text: currentInput, output_text: fullOutput, status: "completed" });
        currentInput = fullOutput;
      } catch (e: any) {
        await supabase.from("agent_flow_node_results").update({ status: "error", output_text: e.message, completed_at: new Date().toISOString() }).eq("id", nodeResult!.id);
        nodeResults.push({ node_id: node.id, agent_name: agentName, agent_id: node.agent_id, agent_type: node.agent_type, input_text: currentInput, output_text: e.message, status: "error" });
        await supabase.from("agent_flow_executions").update({ status: "error", final_output: `Erro no nó "${agentName}": ${e.message}`, completed_at: new Date().toISOString() }).eq("id", execution.id);
        return new Response(JSON.stringify({ execution_id: execution.id, node_results: nodeResults, final_output: "", error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await supabase.from("agent_flow_executions").update({ status: "completed", final_output: currentInput, completed_at: new Date().toISOString() }).eq("id", execution.id);
    await supabase.from("agent_flows").update({ status: "completed" }).eq("id", flow_id);

    return new Response(JSON.stringify({ execution_id: execution.id, node_results: nodeResults, final_output: currentInput }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Flow execution error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
