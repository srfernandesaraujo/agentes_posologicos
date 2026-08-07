import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slug(s: string) {
  return (s || "ferramenta").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { scope } = await req.json().catch(() => ({}));
    if (scope !== "native" && scope !== "custom") {
      return json({ error: "Escopo inválido. Use 'native' ou 'custom'." }, 400);
    }

    let rows: any[] = [];
    let manifestType: string;

    if (scope === "native") {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Apenas administradores podem fazer backup das ferramentas nativas." }, 403);
      const { data, error } = await supabase.from("agents").select("*").order("name");
      if (error) throw error;
      rows = data ?? [];
      manifestType = "native_agents";
    } else {
      const { data, error } = await supabase.from("custom_agents").select("*").eq("user_id", user.id).order("name");
      if (error) throw error;
      rows = data ?? [];
      manifestType = "custom_agents";
    }

    const filesMap: Record<string, Uint8Array> = {};
    const usedNames = new Set<string>();
    for (const row of rows) {
      const base = slug(row.name || row.slug || row.id);
      let fname = `${base}.json`;
      let i = 2;
      while (usedNames.has(fname)) {
        fname = `${base}-${i}.json`;
        i++;
      }
      usedNames.add(fname);
      filesMap[`ferramentas/${fname}`] = strToU8(JSON.stringify(row, null, 2));
    }

    const manifest = {
      app: "agentes-posologicos",
      type: manifestType,
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      count: rows.length,
    };
    filesMap["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    filesMap["README.md"] = strToU8(
      `# Backup de ferramentas (${scope === "native" ? "nativas" : "próprias"})\n\n` +
        `Gerado em ${new Date().toLocaleString("pt-BR")} por ${user.email}.\n\n` +
        `Contém ${rows.length} ferramenta(s). Restaure este arquivo .zip na tela de Backup do sistema.\n`,
    );

    const zipped = zipSync(filesMap, { level: 6 });
    const filenameBase = `backup-${scope === "native" ? "ferramentas-nativas" : "minhas-ferramentas"}-${new Date()
      .toISOString()
      .slice(0, 10)}`;

    return json({
      filename: `${filenameBase}.zip`,
      count: rows.length,
      zip_base64: base64Encode(zipped),
    });
  } catch (e: any) {
    console.error("backup-agents error", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
