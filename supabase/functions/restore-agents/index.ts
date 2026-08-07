import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    const { scope, zip_base64 } = await req.json().catch(() => ({}));
    if (scope !== "native" && scope !== "custom") {
      return json({ error: "Escopo inválido. Use 'native' ou 'custom'." }, 400);
    }
    if (!zip_base64 || typeof zip_base64 !== "string") {
      return json({ error: "Arquivo de backup ausente." }, 400);
    }

    if (scope === "native") {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Apenas administradores podem restaurar ferramentas nativas." }, 403);
    }

    let zipBytes: Uint8Array;
    try {
      zipBytes = base64Decode(zip_base64);
    } catch {
      return json({ error: "Arquivo de backup corrompido ou inválido." }, 400);
    }

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(zipBytes);
    } catch {
      return json({ error: "Não foi possível ler o arquivo .zip." }, 400);
    }

    const manifestFile = unzipped["manifest.json"];
    if (!manifestFile) return json({ error: 'Backup inválido: "manifest.json" não encontrado.' }, 400);

    let manifest: any;
    try {
      manifest = JSON.parse(strFromU8(manifestFile));
    } catch {
      return json({ error: 'Backup inválido: "manifest.json" corrompido.' }, 400);
    }

    const expectedType = scope === "native" ? "native_agents" : "custom_agents";
    if (manifest.type !== expectedType) {
      return json(
        {
          error: `Este arquivo é um backup de "${
            manifest.type === "native_agents" ? "ferramentas nativas" : "ferramentas próprias"
          }" e não pode ser restaurado neste local.`,
        },
        400,
      );
    }

    const items: any[] = [];
    for (const [path, bytes] of Object.entries(unzipped)) {
      if (!path.startsWith("ferramentas/") || !path.endsWith(".json")) continue;
      try {
        items.push(JSON.parse(strFromU8(bytes)));
      } catch {
        // entrada corrompida: ignora e segue com as demais
      }
    }
    if (items.length === 0) return json({ error: "Nenhuma ferramenta encontrada no backup." }, 400);

    const renamed: string[] = [];
    let insertedCount = 0;

    if (scope === "native") {
      const { data: existing } = await supabase.from("agents").select("name, slug");
      const existingNames = new Set((existing ?? []).map((a: any) => (a.name || "").toLowerCase()));
      const existingSlugs = new Set((existing ?? []).map((a: any) => a.slug));

      const rowsToInsert = items.map((item) => {
        const { id: _id, created_at: _createdAt, name: originalName, slug: originalSlug, ...rest } = item;
        let name = originalName || "Ferramenta restaurada";
        if (existingNames.has(name.toLowerCase())) {
          name = `${name} (restaurado)`;
          renamed.push(name);
        }
        existingNames.add(name.toLowerCase());

        const base = slug(originalSlug || originalName || "ferramenta");
        let newSlug = base;
        let i = 2;
        while (existingSlugs.has(newSlug)) {
          newSlug = `${base}-${i}`;
          i++;
        }
        existingSlugs.add(newSlug);

        return { ...rest, name, slug: newSlug };
      });

      const { data: inserted, error } = await supabase.from("agents").insert(rowsToInsert).select("id");
      if (error) throw error;
      insertedCount = inserted?.length ?? 0;
    } else {
      const { data: existing } = await supabase.from("custom_agents").select("name").eq("user_id", user.id);
      const existingNames = new Set((existing ?? []).map((a: any) => (a.name || "").toLowerCase()));

      const rowsToInsert = items.map((item) => {
        const {
          id: _id,
          created_at: _createdAt,
          updated_at: _updatedAt,
          user_id: _userId,
          name: originalName,
          knowledge_base_id: _kbId,
          status: _status,
          published_to_marketplace: _pubMarket,
          publish_virtual_patient: _pubVp,
          publish_whatsapp: _pubWa,
          ...rest
        } = item;
        let name = originalName || "Ferramenta restaurada";
        if (existingNames.has(name.toLowerCase())) {
          name = `${name} (restaurado)`;
          renamed.push(name);
        }
        existingNames.add(name.toLowerCase());

        return {
          ...rest,
          name,
          user_id: user.id,
          knowledge_base_id: null,
          status: "draft",
          published_to_marketplace: false,
          publish_virtual_patient: false,
          publish_whatsapp: false,
        };
      });

      const { data: inserted, error } = await supabase.from("custom_agents").insert(rowsToInsert).select("id");
      if (error) throw error;
      insertedCount = inserted?.length ?? 0;
    }

    return json({ restored: insertedCount, renamed });
  } catch (e: any) {
    console.error("restore-agents error", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
