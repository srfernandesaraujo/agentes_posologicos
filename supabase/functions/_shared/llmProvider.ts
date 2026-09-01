import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Provider API endpoints — all OpenAI-compatible except anthropic (native Messages API)
// NOTE: "github" (GitHub Models, models.inference.ai.azure.com) was removed 2026-09-01 —
// GitHub retired the product outright (API now returns "github_models_retirement_brownout"
// on every call, confirmed live), not just a URL change. Existing user_api_keys rows with
// provider='github' are simply never tried anymore; no migration needed.
export const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "nvidia-gptos": "https://integrate.api.nvidia.com/v1/chat/completions",
  "nvidia-deepseek": "https://integrate.api.nvidia.com/v1/chat/completions",
};

// Priority order for trying user API keys (no more Lovable AI Gateway fallback)
export const PROVIDER_PRIORITY_ORDER = ["google", "openai", "anthropic", "groq", "nvidia-gptos", "nvidia-deepseek", "openrouter"];

export const DEFAULT_MODELS_PER_PROVIDER: Record<string, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  // llama-3.3-70b-versatile was retired by Groq (confirmed live 2026-09-01: 404
  // model_not_found) — llama-3.1-8b-instant was already this app's own documented
  // safe fallback for groq (see PROVIDER_SUPPORTED_MODELS below).
  groq: "llama-3.1-8b-instant",
  "nvidia-gptos": "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "nvidia-deepseek": "deepseek-ai/deepseek-v3.2",
  openrouter: "google/gemini-2.5-flash",
};

// Groq does not support multimodal content in this integration
export const TEXT_ONLY_PROVIDERS = ["groq"];

// Remap unsupported model ids to a safe default per provider
export const PROVIDER_SUPPORTED_MODELS: Record<string, string[]> = {
  groq: ["llama-3.1-8b-instant", "gemma2-9b-it"],
};

// OpenAI-compatible providers don't get a sane default max_tokens from every backend —
// OpenRouter in particular defaults to the model's full context window, which fails with
// a 402 "insufficient credits" on any account without a large balance (confirmed live
// 2026-09-01: requested 65535, account could only afford 16000). Capping this explicitly
// avoids that failure mode and bounds cost for every OpenAI-compatible provider.
const DEFAULT_MAX_TOKENS = 8192;

// Cost estimation per 1M tokens (input/output) in USD, keyed by model id
export const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "google/gemini-3-flash-preview": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemma2-9b-it": { input: 0.2, output: 0.2 },
};

export function estimateCost(model: string, tokensInput: number, tokensOutput: number): number {
  const costEntry = COST_PER_MILLION[model] || { input: 0.5, output: 1.0 };
  const cost = (tokensInput * costEntry.input + tokensOutput * costEntry.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function extractUsage(data: any) {
  return { tokensInput: data?.usage?.prompt_tokens ?? 0, tokensOutput: data?.usage?.completion_tokens ?? 0 };
}

export function extractAnthropicUsage(data: any) {
  return { tokensInput: data?.usage?.input_tokens ?? 0, tokensOutput: data?.usage?.output_tokens ?? 0 };
}

// Decrypt an API key stored in user_api_keys (supports legacy plaintext if no encryption key configured)
export async function decryptApiKey(supabaseAdmin: SupabaseClient, encryptedKey: string): Promise<string> {
  const encKey = Deno.env.get("API_ENCRYPTION_KEY");
  if (!encKey) return encryptedKey;
  const { data, error } = await supabaseAdmin.rpc("decrypt_api_key", { p_encrypted: encryptedKey, p_encryption_key: encKey });
  if (error) {
    console.warn("Decrypt failed, using raw value:", error.message);
    return encryptedKey;
  }
  return data as string;
}

export interface OrderedKey {
  provider: string;
  apiKeyEncrypted: string;
  model: string;
}

// Fetch a user's configured API keys, drop expired ones, sort by priority (optionally fronting one provider)
export async function getOrderedKeysForUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  opts?: { preferredProvider?: string; excludeProviders?: string[] },
): Promise<OrderedKey[]> {
  const { data, error } = await supabaseAdmin
    .from("user_api_keys")
    .select("provider, api_key_encrypted, key_expires_at")
    .eq("user_id", userId);
  if (error || !data) return [];

  const now = Date.now();
  const excluded = new Set(opts?.excludeProviders || []);
  const usable = (data as any[]).filter(
    (k) => !excluded.has(k.provider) && (!k.key_expires_at || new Date(k.key_expires_at).getTime() > now),
  );

  const sorted = usable.sort((a, b) => {
    if (opts?.preferredProvider) {
      if (a.provider === opts.preferredProvider) return -1;
      if (b.provider === opts.preferredProvider) return 1;
    }
    const aIdx = PROVIDER_PRIORITY_ORDER.indexOf(a.provider);
    const bIdx = PROVIDER_PRIORITY_ORDER.indexOf(b.provider);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return sorted.map((k) => ({
    provider: k.provider,
    apiKeyEncrypted: k.api_key_encrypted,
    model: DEFAULT_MODELS_PER_PROVIDER[k.provider] || "gpt-4o",
  }));
}

// Resolve the designated admin account used as a fallback key source for routes with no logged-in user.
// Override via ADMIN_LLM_FALLBACK_USER_ID secret if the admin account ever needs to change without a code edit.
export async function resolveAdminFallbackUserId(supabaseAdmin: SupabaseClient): Promise<string | null> {
  const override = Deno.env.get("ADMIN_LLM_FALLBACK_USER_ID");
  if (override) return override;
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as any).user_id as string;
}

// Convenience: ordered keys for a specific user, falling back to the admin account's keys if that
// user has none configured (or if userId is null — i.e. anonymous/public/guest/system callers).
export async function getOrderedKeysWithAdminFallback(
  supabaseAdmin: SupabaseClient,
  userId: string | null,
  opts?: { preferredProvider?: string; excludeProviders?: string[] },
): Promise<OrderedKey[]> {
  let keys: OrderedKey[] = [];
  if (userId) {
    keys = await getOrderedKeysForUser(supabaseAdmin, userId, opts);
  }
  if (keys.length === 0) {
    const adminId = await resolveAdminFallbackUserId(supabaseAdmin);
    if (adminId && adminId !== userId) {
      keys = await getOrderedKeysForUser(supabaseAdmin, adminId, opts);
    }
  }
  return keys;
}

export type CallMode = "text" | "tools" | "json" | "stream";

export interface CallProviderParams {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: string; content: any }>;
  temperature?: number;
  mode?: CallMode;
  tools?: any[];
  toolChoice?: any;
}

export interface CallProviderResult {
  ok: boolean;
  output?: string;
  toolCallArgs?: any;
  tokensInput: number;
  tokensOutput: number;
  errorText?: string;
  streamResponse?: Response;
}

// Anthropic does not support function-calling or streaming in this integration (Phase 0 scope decision) —
// callers using getOrderedKeys*/callWithFallback with mode "tools"/"stream" should exclude it up front;
// callProvider still guards here as a defensive fallback.
export async function callProvider(params: CallProviderParams): Promise<CallProviderResult> {
  const { provider, apiKey, model, systemPrompt, messages, temperature, mode = "text", tools, toolChoice } = params;
  const endpoint = PROVIDER_ENDPOINTS[provider];
  if (!endpoint) return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: `Unknown provider: ${provider}` };

  if (provider === "anthropic") {
    if (mode === "tools" || mode === "stream") {
      return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: `Anthropic does not support mode=${mode}` };
    }
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: temperature ?? 0.7,
          system: systemPrompt || undefined,
          messages: messages.filter((m) => m.role !== "system"),
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: `${resp.status} ${errText}` };
      }
      const data = await resp.json();
      const output = data.content?.[0]?.text || "";
      if (!output.trim()) return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: "empty content" };
      return { ok: true, output, ...extractAnthropicUsage(data) };
    } catch (e) {
      return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: (e as Error).message };
    }
  }

  // OpenAI-compatible providers (groq, openai, openrouter, google, nvidia-*, github)
  let effectiveModel = model;
  const supportedList = PROVIDER_SUPPORTED_MODELS[provider];
  if (supportedList && !supportedList.includes(effectiveModel)) {
    effectiveModel = supportedList[0];
  }

  const body: Record<string, any> = {
    model: effectiveModel,
    temperature: temperature ?? 0.7,
    max_tokens: DEFAULT_MAX_TOKENS,
    messages: [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), ...messages],
  };
  if (mode === "tools" && tools) {
    body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
  }
  if (mode === "json") {
    body.response_format = { type: "json_object" };
  }
  if (mode === "stream") {
    body.stream = true;
  }

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (mode === "stream") {
      if (!resp.ok) {
        const errText = await resp.text();
        return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: `${resp.status} ${errText}` };
      }
      return { ok: true, tokensInput: 0, tokensOutput: 0, streamResponse: resp };
    }

    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: `${resp.status} ${errText}` };
    }
    const data = await resp.json();

    if (mode === "tools") {
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: "no tool call returned" };
      let args: any;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: "invalid tool call arguments JSON" };
      }
      return { ok: true, toolCallArgs: args, ...extractUsage(data) };
    }

    const output = data.choices?.[0]?.message?.content || "";
    if (!output.trim()) return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: "empty content" };
    return { ok: true, output, ...extractUsage(data) };
  } catch (e) {
    return { ok: false, tokensInput: 0, tokensOutput: 0, errorText: (e as Error).message };
  }
}

export interface FallbackCallResult extends CallProviderResult {
  provider?: string;
  model?: string;
}

// Try each ordered key in turn, skipping Anthropic for tools/stream modes, until one succeeds.
export async function callWithFallback(
  supabaseAdmin: SupabaseClient,
  orderedKeys: OrderedKey[],
  params: Omit<CallProviderParams, "provider" | "apiKey" | "model"> & { modelOverridePerProvider?: Record<string, string> },
): Promise<FallbackCallResult | null> {
  const mode = params.mode || "text";
  for (const key of orderedKeys) {
    if (key.provider === "anthropic" && (mode === "tools" || mode === "stream")) {
      console.log("Skipping anthropic key for mode", mode, "— trying next provider");
      continue;
    }
    const apiKey = await decryptApiKey(supabaseAdmin, key.apiKeyEncrypted);
    const model = params.modelOverridePerProvider?.[key.provider] || key.model;
    console.log(`Trying provider ${key.provider} (mode=${mode}, model=${model})`);
    const result = await callProvider({ ...params, provider: key.provider, apiKey, model });
    if (result.ok) {
      return { ...result, provider: key.provider, model };
    }
    console.warn(`Provider ${key.provider} failed: ${result.errorText} — trying next`);
  }
  return null;
}

// Shared helper for logging AI usage — insert shape only; callers keep their own credit-deduction rules.
export async function logAiUsage(
  supabaseAdmin: SupabaseClient,
  params: { userId: string; provider: string; model: string; tokensInput: number; tokensOutput: number; promptType?: string },
): Promise<void> {
  try {
    const estimatedCost = estimateCost(params.model, params.tokensInput, params.tokensOutput);
    await supabaseAdmin.from("ai_usage_log").insert({
      user_id: params.userId,
      provider: params.provider,
      model: params.model,
      prompt_type: params.promptType || "chat",
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      estimated_cost_usd: estimatedCost,
    });
  } catch (e) {
    console.warn("AI usage logging failed:", (e as Error).message);
  }
}
