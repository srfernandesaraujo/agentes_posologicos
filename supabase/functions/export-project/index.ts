import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slug(s: string) {
  return (s || "item").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify caller via JWT
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { project_id } = await req.json().catch(() => ({}));
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check access via has_project_access
    const { data: hasAccess, error: accessErr } = await admin.rpc("has_project_access", {
      _project_id: project_id,
      _user_id: user.id,
      _min_role: "viewer",
    });
    if (accessErr || !hasAccess) {
      return new Response(JSON.stringify({ error: "Sem acesso ao projeto" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load project + items
    const { data: project } = await admin.from("projects").select("*").eq("id", project_id).maybeSingle();
    if (!project) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: items = [] } = await admin.from("project_items").select("*").eq("project_id", project_id);
    const { data: collaborators = [] } = await admin.from("project_collaborators").select("*").eq("project_id", project_id);

    const filesMap: Record<string, Uint8Array> = {};

    // Group by type
    const byType: Record<string, string[]> = {};
    for (const it of items) {
      (byType[it.item_type] ||= []).push(it.item_id);
    }

    const itemTitles: Record<string, string> = {};

    // Conversations -> markdown
    if (byType.conversation?.length) {
      const { data: sessions = [] } = await admin
        .from("chat_sessions")
        .select("id, title, created_at")
        .in("id", byType.conversation);
      const { data: messages = [] } = await admin
        .from("chat_messages")
        .select("session_id, role, content, created_at")
        .in("session_id", byType.conversation)
        .order("created_at", { ascending: true });
      const msgsBySession: Record<string, any[]> = {};
      for (const m of messages) (msgsBySession[m.session_id] ||= []).push(m);
      for (const s of sessions) {
        itemTitles[`conversation:${s.id}`] = s.title || "Conversa";
        const md = [
          `# ${s.title || "Conversa"}`,
          `_Iniciada em ${new Date(s.created_at).toLocaleString("pt-BR")}_`,
          "",
          ...(msgsBySession[s.id] || []).map(
            (m) => `## ${m.role === "user" ? "Usuário" : "Assistente"}\n\n${m.content}\n`,
          ),
        ].join("\n");
        filesMap[`conversas/${slug(s.title || s.id)}-${s.id.slice(0, 8)}.md`] = strToU8(md);
      }
    }

    // Flows -> json
    if (byType.flow?.length) {
      const { data: flows = [] } = await admin.from("agent_flows").select("*").in("id", byType.flow);
      const { data: nodes = [] } = await admin.from("agent_flow_nodes").select("*").in("flow_id", byType.flow);
      const { data: edges = [] } = await admin.from("agent_flow_edges").select("*").in("flow_id", byType.flow);
      for (const f of flows) {
        itemTitles[`flow:${f.id}`] = f.name;
        const payload = {
          flow: f,
          nodes: nodes.filter((n: any) => n.flow_id === f.id),
          edges: edges.filter((e: any) => e.flow_id === f.id),
        };
        filesMap[`fluxos/${slug(f.name)}-${f.id.slice(0, 8)}.json`] = strToU8(JSON.stringify(payload, null, 2));
      }
    }

    // Knowledge bases -> json + contents
    if (byType.knowledge_base?.length) {
      const { data: kbs = [] } = await admin.from("knowledge_bases").select("*").in("id", byType.knowledge_base);
      const { data: contents = [] } = await admin
        .from("knowledge_contents")
        .select("*")
        .in("knowledge_base_id", byType.knowledge_base);
      for (const kb of kbs) {
        itemTitles[`knowledge_base:${kb.id}`] = kb.name;
        const payload = {
          knowledge_base: kb,
          contents: contents.filter((c: any) => c.knowledge_base_id === kb.id),
        };
        filesMap[`bases/${slug(kb.name)}-${kb.id.slice(0, 8)}.json`] = strToU8(JSON.stringify(payload, null, 2));
      }
    }

    // Meetings -> markdown
    if (byType.meeting?.length) {
      const { data: meetings = [] } = await admin.from("meetings").select("*").in("id", byType.meeting);
      for (const m of meetings) {
        itemTitles[`meeting:${m.id}`] = m.title || m.meet_link || "Reunião";
        const md = [
          `# ${m.title || "Reunião"}`,
          `**Link:** ${m.meet_link}`,
          `**Status:** ${m.status}`,
          `**Data:** ${new Date(m.created_at).toLocaleString("pt-BR")}`,
          "",
          "## Ata",
          m.summary || "_Sem ata_",
          "",
          "## Transcrição",
          m.transcript || "_Sem transcrição_",
        ].join("\n");
        filesMap[`reunioes/${slug(m.title || m.id)}-${m.id.slice(0, 8)}.md`] = strToU8(md);
      }
    }

    // Certificates -> json
    if (byType.certificate?.length) {
      const { data: certs = [] } = await admin
        .from("content_certificates")
        .select("*")
        .in("id", byType.certificate);
      for (const c of certs) {
        itemTitles[`certificate:${c.id}`] = `${c.agent_name}`;
        filesMap[`certificados/${slug(c.agent_name)}-${c.id.slice(0, 8)}.json`] = strToU8(
          JSON.stringify(c, null, 2),
        );
      }
    }

    // project.json manifest
    const manifest = {
      project,
      collaborators,
      items: items.map((it: any) => ({
        ...it,
        title: itemTitles[`${it.item_type}:${it.item_id}`] || null,
      })),
      exported_at: new Date().toISOString(),
      exported_by: user.email,
    };
    filesMap["project.json"] = strToU8(JSON.stringify(manifest, null, 2));
    filesMap["README.md"] = strToU8(
      `# ${project.name}\n\n${project.description || ""}\n\nExportado em ${new Date().toLocaleString("pt-BR")} por ${user.email}.\n\nConteúdo: ${items.length} itens.\n`,
    );

    const zipped = zipSync(filesMap, { level: 6 });

    // Upload to storage
    const filePath = `${user.id}/${project_id}/${Date.now()}-${slug(project.name)}.zip`;
    const { error: upErr } = await admin.storage
      .from("project-exports")
      .upload(filePath, zipped, { contentType: "application/zip", upsert: true });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await admin.storage
      .from("project-exports")
      .createSignedUrl(filePath, 60 * 60 * 24); // 24h
    if (signErr) throw signErr;

    return new Response(
      JSON.stringify({
        url: signed.signedUrl,
        path: filePath,
        items: items.length,
        size_bytes: zipped.byteLength,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("export-project error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});