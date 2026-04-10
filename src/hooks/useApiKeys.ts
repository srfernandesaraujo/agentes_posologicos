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
  key_expires_at: string | null;
}

export const LLM_PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    url: "https://console.groq.com/keys",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-3.2-3b-preview"],
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
  {
    id: "nvidia-gptos",
    name: "NVIDIA GPTOS",
    url: "https://build.nvidia.com/nvidia/llama-3_1-nemotron-ultra-253b-v1",
    models: ["nvidia/llama-3.1-nemotron-ultra-253b-v1"],
  },
  {
    id: "nvidia-deepseek",
    name: "NVIDIA DeepSeek",
    url: "https://build.nvidia.com/deepseek-ai/deepseek-v3_2",
    models: ["deepseek-ai/deepseek-v3.2"],
  },
  {
    id: "github",
    name: "GitHub Models",
    url: "https://github.com/marketplace/models",
    models: ["gpt-4o", "gpt-4o-mini", "Meta-Llama-3.1-405B-Instruct", "Mistral-Large-2"],
    expiresInDays: 30,
  },
] as const;

export function useApiKeys() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["api-keys", user?.id],
    queryFn: async () => {
      // We can still READ keys (RLS SELECT is still allowed)
      // But the encrypted value won't be readable plaintext anymore
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as unknown as ApiKey[];
    },
    enabled: !!user,
  });

  const upsertKey = useMutation({
    mutationFn: async ({ provider, apiKey, expiresInDays }: { provider: string; apiKey: string; expiresInDays?: number }) => {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "upsert", provider, apiKey, expiresInDays },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const deleteKey = useMutation({
    mutationFn: async (provider: string) => {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "delete", provider },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const hasAnyKey = (query.data?.length ?? 0) > 0;
  const getKeyForProvider = (provider: string) =>
    query.data?.find((k) => k.provider === provider);

  return { ...query, upsertKey, deleteKey, hasAnyKey, getKeyForProvider };
}
