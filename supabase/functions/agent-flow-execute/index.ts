import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await tempClient.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        userId = claimsData.claims.sub as string;
      }
    }

    const { flow_id, initial_input } = await req.json();

    if (!flow_id || !initial_input) {
      return new Response(JSON.stringify({ error: "flow_id e initial_input são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify flow ownership
    const { data: flowData, error: flowError } = await supabase
      .from("agent_flows")
      .select("id, user_id")
      .eq("id", flow_id)
      .single();

    if (flowError || !flowData || flowData.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Fluxo não encontrado ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load flow nodes ordered by sort_order
    const { data: nodes, error: nodesErr } = await supabase
      .from("agent_flow_nodes")
      .select("*")
      .eq("flow_id", flow_id)
      .order("sort_order");

    if (nodesErr || !nodes?.length) {
      return new Response(JSON.stringify({ error: "Fluxo sem nós configurados" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load edges to determine execution order (topological sort)
    const { data: edges } = await supabase
      .from("agent_flow_edges")
      .select("*")
      .eq("flow_id", flow_id);

    // Build execution order from edges (topological) or fallback to sort_order
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

    // Create execution record
    const { data: execution, error: execErr } = await supabase
      .from("agent_flow_executions")
      .insert({ flow_id, user_id: userId, status: "running", initial_input })
      .select()
      .single();

    if (execErr) throw execErr;

    // Load agent details and validate all exist
    const nativeIds = executionOrder.filter((n: any) => n.agent_type === "native").map((n: any) => n.agent_id);
    const customIds = executionOrder.filter((n: any) => n.agent_type === "custom").map((n: any) => n.agent_id);

    const [nativeRes, customRes] = await Promise.all([
      nativeIds.length ? supabase.from("agents").select("id, name, slug").in("id", nativeIds) : { data: [] },
      customIds.length ? supabase.from("custom_agents").select("id, name").in("id", customIds) : { data: [] },
    ]);

    const agentMap = new Map<string, any>();
    (nativeRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "native" }));
    (customRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "custom" }));

    // Validate all nodes have valid agents
    for (const node of executionOrder) {
      if (!agentMap.has(node.agent_id)) {
        const errMsg = `Agente não encontrado para o nó (agent_id: ${node.agent_id}, tipo: ${node.agent_type}). Verifique se o agente ainda existe.`;
        await supabase
          .from("agent_flow_executions")
          .update({ status: "error", final_output: errMsg, completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        return new Response(JSON.stringify({ execution_id: execution.id, error: errMsg, node_results: [], final_output: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Execute sequentially
    let currentInput = initial_input;
    const nodeResults: any[] = [];

    for (const node of executionOrder) {
      const agent = agentMap.get(node.agent_id);
      const agentName = agent?.name || "Agente";

      // Create node result
      const { data: nodeResult } = await supabase
        .from("agent_flow_node_results")
        .insert({
          execution_id: execution.id,
          node_id: node.id,
          input_text: currentInput,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      try {
        // Build context with input prompt
        let contextMessage = currentInput;
        if (node.input_prompt) {
          contextMessage = `${node.input_prompt}\n\n---\n\nConteúdo de entrada:\n${currentInput}`;
        }

        // Call agent-chat function with service role key for server-to-server auth
        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agentId: node.agent_id,
            input: contextMessage,
            userId: userId,
            history: [],
            skipCredits: true,
          }),
        });

        const responseText = await chatResponse.text();

        if (!chatResponse.ok) {
          throw new Error(`Erro do agente "${agentName}": ${responseText}`);
        }

        // Parse JSON response from agent-chat (returns { output: "..." })
        let fullOutput = "";
        try {
          const json = JSON.parse(responseText);
          fullOutput = json.output || json.response || responseText;
        } catch {
          fullOutput = responseText;
        }

        if (!fullOutput || fullOutput.trim().length === 0) {
          throw new Error(`Agente "${agentName}" retornou resposta vazia`);
        }

        // Update node result
        await supabase
          .from("agent_flow_node_results")
          .update({
            output_text: fullOutput,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", nodeResult.id);

        nodeResults.push({
          node_id: node.id,
          agent_name: agentName,
          agent_id: node.agent_id,
          agent_type: node.agent_type,
          input_text: currentInput,
          output_text: fullOutput,
          status: "completed",
        });

        currentInput = fullOutput;
      } catch (e: any) {
        await supabase
          .from("agent_flow_node_results")
          .update({ status: "error", output_text: e.message, completed_at: new Date().toISOString() })
          .eq("id", nodeResult.id);

        nodeResults.push({
          node_id: node.id,
          agent_name: agentName,
          agent_id: node.agent_id,
          agent_type: node.agent_type,
          input_text: currentInput,
          output_text: e.message,
          status: "error",
        });

        // Stop execution on error
        await supabase
          .from("agent_flow_executions")
          .update({ status: "error", final_output: `Erro no nó "${agentName}": ${e.message}`, completed_at: new Date().toISOString() })
          .eq("id", execution.id);

        return new Response(
          JSON.stringify({ execution_id: execution.id, node_results: nodeResults, final_output: "", error: e.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Complete execution
    await supabase
      .from("agent_flow_executions")
      .update({ status: "completed", final_output: currentInput, completed_at: new Date().toISOString() })
      .eq("id", execution.id);

    await supabase
      .from("agent_flows")
      .update({ status: "completed" })
      .eq("id", flow_id);

    return new Response(
      JSON.stringify({ execution_id: execution.id, node_results: nodeResults, final_output: currentInput }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Flow execution error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
