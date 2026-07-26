import { supabase } from "@/integrations/supabase/client";

// supabase.functions.invoke() swallows the JSON body of non-2xx responses, which
// hides our edge functions' specific error messages (e.g. "Créditos insuficientes",
// "Limite de salas atingido"). Call via direct fetch instead so those surface to the
// user. Mirrors the pattern already used in src/pages/Chat.tsx.
export async function invokeFunction<T = any>(name: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const rawText = await resp.text();
  let data: any = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }
  if (!resp.ok) {
    const errorMsg =
      (data && typeof data === "object" && data.error) ||
      (typeof data === "string" && data) ||
      `Erro na requisição (HTTP ${resp.status})`;
    throw new Error(errorMsg);
  }
  return data as T;
}
