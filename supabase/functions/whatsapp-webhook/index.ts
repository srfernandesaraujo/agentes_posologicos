import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[whatsapp-webhook] Received event:", body?.event, "instance:", body?.instance);

    // Only process messages.upsert events
    if (body?.event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, skipped: "not messages.upsert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = body.data;
    if (!data?.key || !data?.message) {
      return new Response(JSON.stringify({ ok: true, skipped: "no key or message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignore messages sent by the bot itself
    if (data.key.fromMe === true) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignore group messages
    const remoteJid: string = data.key.remoteJid || "";
    if (remoteJid.endsWith("@g.us")) {
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message text
    const messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    if (!messageText.trim()) {
      return new Response(JSON.stringify({ ok: true, skipped: "empty message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instanceName = body.instance;
    const pushName = data.pushName || "Usuário";
    const phoneNumber = remoteJid.split("@")[0];

    console.log(`[whatsapp-webhook] Message from ${phoneNumber} (${pushName}): "${messageText.substring(0, 100)}"`);

    // Setup Supabase service client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the whatsapp_connection for this instance
    const { data: connection, error: connError } = await supabase
      .from("whatsapp_connections")
      .select("id, agent_id, user_id, instance_name, evolution_api_url, evolution_api_key_encrypted, service_type")
      .eq("instance_name", instanceName)
      .eq("status", "active")
      .eq("service_type", "evolution")
      .maybeSingle();

    if (connError || !connection) {
      console.error("[whatsapp-webhook] No connection found for instance:", instanceName, connError);
      return new Response(JSON.stringify({ ok: false, error: "No connection found for instance" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agent_id, user_id, evolution_api_url, evolution_api_key_encrypted } = connection;

    if (!evolution_api_url || !evolution_api_key_encrypted) {
      console.error("[whatsapp-webhook] Missing Evolution API config for connection:", connection.id);
      return new Response(JSON.stringify({ ok: false, error: "Evolution API not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt the Evolution API key
    let evolutionApiKey = evolution_api_key_encrypted;
    try {
      const { data: decrypted } = await supabase.rpc("decrypt_api_key", {
        p_encrypted: evolution_api_key_encrypted,
      });
      if (decrypted) evolutionApiKey = decrypted;
    } catch (e) {
      console.warn("[whatsapp-webhook] Could not decrypt API key, using raw value:", e);
    }

    // Load last 20 messages for context
    const { data: history } = await supabase
      .from("whatsapp_conversations")
      .select("role, content")
      .eq("whatsapp_connection_id", connection.id)
      .eq("remote_jid", remoteJid)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build conversation history (reversed to chronological order)
    const conversationHistory = (history || []).reverse();

    // Save the incoming user message
    await supabase.from("whatsapp_conversations").insert({
      whatsapp_connection_id: connection.id,
      remote_jid: remoteJid,
      role: "user",
      content: messageText,
    });

    // Build input with context
    let fullInput = messageText;
    if (conversationHistory.length > 0) {
      const contextLines = conversationHistory
        .map((m: any) => `${m.role === "user" ? "Aluno" : "Tutor"}: ${m.content}`)
        .join("\n");
      fullInput = `[Histórico da conversa]\n${contextLines}\n\n[Mensagem atual]\nAluno (${pushName}): ${messageText}`;
    } else {
      fullInput = `Aluno (${pushName}): ${messageText}`;
    }

    // Call agent-chat via internal fetch
    console.log("[whatsapp-webhook] Calling agent-chat for agent:", agent_id);

    const agentChatUrl = `${supabaseUrl}/functions/v1/agent-chat`;
    const agentResp = await fetch(agentChatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        agentId: agent_id,
        input: fullInput,
        isCustomAgent: true,
        userId: user_id,
        skipCredits: false,
      }),
    });

    if (!agentResp.ok) {
      const errText = await agentResp.text();
      console.error("[whatsapp-webhook] agent-chat error:", agentResp.status, errText);
      return new Response(JSON.stringify({ ok: false, error: "agent-chat failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse response — agent-chat may return JSON or SSE stream
    let assistantText = "";
    const contentType = agentResp.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await agentResp.json();
      assistantText = json.response || json.content || json.message || "";
    } else {
      // SSE stream — collect all data chunks
      const fullText = await agentResp.text();
      const lines = fullText.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) assistantText += parsed.token;
            if (parsed.content) assistantText += parsed.content;
            if (parsed.response) assistantText = parsed.response;
          } catch {
            // If not JSON, it's raw text
            assistantText += payload;
          }
        }
      }
    }

    if (!assistantText.trim()) {
      assistantText = "Desculpe, não consegui gerar uma resposta. Tente novamente.";
    }

    // Save assistant response to history
    await supabase.from("whatsapp_conversations").insert({
      whatsapp_connection_id: connection.id,
      remote_jid: remoteJid,
      role: "assistant",
      content: assistantText,
    });

    // Clean up old messages (keep only last 40 per conversation)
    const { data: allMsgs } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("whatsapp_connection_id", connection.id)
      .eq("remote_jid", remoteJid)
      .order("created_at", { ascending: false })
      .range(40, 1000);

    if (allMsgs && allMsgs.length > 0) {
      const idsToDelete = allMsgs.map((m: any) => m.id);
      await supabase.from("whatsapp_conversations").delete().in("id", idsToDelete);
    }

    // Send response back via Evolution API
    const sendUrl = `${evolution_api_url.replace(/\/$/, "")}/message/sendText/${instanceName}`;
    console.log("[whatsapp-webhook] Sending reply to:", sendUrl);

    const sendResp = await fetch(sendUrl, {
      method: "POST",
      headers: {
        apikey: evolutionApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: assistantText,
      }),
    });

    if (!sendResp.ok) {
      const sendErr = await sendResp.text();
      console.error("[whatsapp-webhook] Failed to send WhatsApp reply:", sendResp.status, sendErr);
    } else {
      await sendResp.text(); // consume body
      console.log("[whatsapp-webhook] Reply sent successfully to", phoneNumber);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-webhook] Unexpected error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

