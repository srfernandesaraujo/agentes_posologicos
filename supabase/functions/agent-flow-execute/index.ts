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
    // Creates execution record and returns ordered nodes with agent info
    if (mode === "init") {
      const { flow_id, initial_input } = body;
      if (!flow_id || !initial_input) {
        return new Response(JSON.stringify({ error: "flow_id e initial_input são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: flowData, error: flowError } = await supabase
        .from("agent_flows").select("id, user_id").eq("id", flow_id).single();
      if (flowError || !flowData || flowData.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Fluxo não encontrado ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load nodes and edges
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

      // Load agent details
      const nativeIds = executionOrder.filter((n: any) => n.agent_type === "native").map((n: any) => n.agent_id);
      const customIds = executionOrder.filter((n: any) => n.agent_type === "custom").map((n: any) => n.agent_id);
      const [nativeRes, customRes] = await Promise.all([
        nativeIds.length ? supabase.from("agents").select("id, name, slug").in("id", nativeIds) : { data: [] },
        customIds.length ? supabase.from("custom_agents").select("id, name").in("id", customIds) : { data: [] },
      ]);

      const agentMap = new Map<string, any>();
      (nativeRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "native" }));
      (customRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "custom" }));

      // Validate agents
      for (const node of executionOrder) {
        if (!agentMap.has(node.agent_id)) {
          return new Response(JSON.stringify({
            error: `Agente não encontrado (agent_id: ${node.agent_id}, tipo: ${node.agent_type})`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Create execution record
      const { data: execution, error: execErr } = await supabase
        .from("agent_flow_executions")
        .insert({ flow_id, user_id: userId, status: "running", initial_input })
        .select().single();
      if (execErr) throw execErr;

      // Return ordered steps with agent info
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

      return new Response(JSON.stringify({ execution_id: execution.id, steps }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== MODE: STEP ==========
    // Executes a single step
    if (mode === "step") {
      const { execution_id, node_id, agent_id, input_text, conversation_history } = body;

      if (!execution_id || !node_id || !agent_id || !input_text) {
        return new Response(JSON.stringify({ error: "execution_id, node_id, agent_id e input_text são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify execution ownership
      const { data: exec } = await supabase
        .from("agent_flow_executions").select("user_id").eq("id", execution_id).single();
      if (!exec || exec.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Execução não encontrada ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create node result
      const { data: nodeResult } = await supabase
        .from("agent_flow_node_results")
        .insert({
          execution_id, node_id, input_text, status: "running",
          started_at: new Date().toISOString(),
        })
        .select().single();

      try {
        // Build history for agent-chat (supports follow-up within same step)
        const history = conversation_history || [];

        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agentId: agent_id,
            input: input_text,
            userId,
            conversationHistory: history,
            skipCredits: true,
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
    // Marks execution as completed
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
          body: JSON.stringify({ agentId: node.agent_id, input: contextMessage, userId, history: [], skipCredits: true }),
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
