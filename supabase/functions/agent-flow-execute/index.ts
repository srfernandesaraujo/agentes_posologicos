import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { flow_id, initial_input, user_id } = await req.json();
    if (!flow_id || !initial_input || !user_id) {
      return new Response(JSON.stringify({ error: "flow_id, initial_input e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
      .insert({ flow_id, user_id, status: "running", initial_input })
      .select()
      .single();

    if (execErr) throw execErr;

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

        // Call agent-chat function
        const agentId = node.agent_id;
        const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agentId: agentId,
            input: contextMessage,
            userId: user_id,
            history: [],
            skipCredits: true,
          }),
        });

        if (!chatResponse.ok) {
          const errText = await chatResponse.text();
          throw new Error(`Agent error: ${errText}`);
        }

        // Read streamed response
        const reader = chatResponse.body?.getReader();
        const decoder = new TextDecoder();
        let fullOutput = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            // Parse SSE
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullOutput += content;
              } catch {
                // Non-JSON response, treat as plain text
                if (jsonStr && jsonStr !== "[DONE]") fullOutput += jsonStr;
              }
            }
          }
        }

        // If no streamed content, try reading as plain text/json
        if (!fullOutput) {
          try {
            const text = await chatResponse.text();
            const json = JSON.parse(text);
            fullOutput = json.response || json.output || text;
          } catch {
            // already consumed
          }
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
          input_text: currentInput,
          output_text: e.message,
          status: "error",
        });

        // Stop execution on error
        await supabase
          .from("agent_flow_executions")
          .update({ status: "error", final_output: `Erro no nó ${agentName}: ${e.message}`, completed_at: new Date().toISOString() })
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
