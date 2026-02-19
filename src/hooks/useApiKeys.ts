import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ApiKey {
  id: string;
  user_id: string;
  provider: string;
  api_key_encrypted: string;
  created_at: string;
  updated_at: string;
}

export const LLM_PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    url: "https://console.groq.com/keys",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  },
  {
    id: "openai",
    name: "OpenAI",
    url: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    url: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    url: "https://openrouter.ai/keys",
    models: ["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514", "google/gemini-2.5-flash"],
  },
  {
    id: "google",
    name: "Google AI",
    url: "https://aistudio.google.com/apikey",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
] as const;

export function useApiKeys() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["api-keys", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_api_keys" as any)
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as unknown as ApiKey[];
    },
    enabled: !!user,
  });

  const upsertKey = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const { error } = await supabase
        .from("user_api_keys" as any)
        .upsert(
          { user_id: user!.id, provider, api_key_encrypted: apiKey },
          { onConflict: "user_id,provider" }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const deleteKey = useMutation({
    mutationFn: async (provider: string) => {
      const { error } = await supabase
        .from("user_api_keys" as any)
        .delete()
        .eq("user_id", user!.id)
        .eq("provider", provider);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const hasAnyKey = (query.data?.length ?? 0) > 0;
  const getKeyForProvider = (provider: string) =>
    query.data?.find((k) => k.provider === provider);

  return { ...query, upsertKey, deleteKey, hasAnyKey, getKeyForProvider };
}
