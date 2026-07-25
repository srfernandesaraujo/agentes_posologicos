import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptApiKey, OrderedKey } from "./llmProvider.ts";

// Only these providers expose a dedicated audio-transcription endpoint (Whisper family).
export const TRANSCRIPTION_PROVIDERS = ["groq", "openai"];

const TRANSCRIPTION_ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/audio/transcriptions",
  openai: "https://api.openai.com/v1/audio/transcriptions",
};

const TRANSCRIPTION_MODELS: Record<string, string> = {
  groq: "whisper-large-v3-turbo",
  openai: "whisper-1",
};

function extFromMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  errorText?: string;
}

export async function transcribeAudio(params: {
  provider: string;
  apiKey: string;
  audioBase64: string;
  mimeType: string;
}): Promise<TranscribeResult> {
  const { provider, apiKey, audioBase64, mimeType } = params;
  const endpoint = TRANSCRIPTION_ENDPOINTS[provider];
  if (!endpoint) return { ok: false, errorText: `Provider ${provider} has no transcription endpoint` };

  try {
    const binaryStr = atob(audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });

    const form = new FormData();
    form.append("file", blob, `audio.${extFromMime(mimeType)}`);
    form.append("model", TRANSCRIPTION_MODELS[provider]);
    form.append("language", "pt");

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, errorText: `${resp.status} ${errText}` };
    }
    const data = await resp.json();
    const text = (data.text || "").trim();
    if (!text) return { ok: false, errorText: "empty transcription" };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, errorText: (e as Error).message };
  }
}

// Try the user's (or admin fallback's) groq/openai keys in order until one transcribes successfully.
export async function transcribeWithFallback(
  supabaseAdmin: SupabaseClient,
  orderedKeys: OrderedKey[],
  params: { audioBase64: string; mimeType: string },
): Promise<TranscribeResult> {
  const candidates = orderedKeys.filter((k) => TRANSCRIPTION_PROVIDERS.includes(k.provider));
  for (const key of candidates) {
    const apiKey = await decryptApiKey(supabaseAdmin, key.apiKeyEncrypted);
    const result = await transcribeAudio({ provider: key.provider, apiKey, ...params });
    if (result.ok) return result;
    console.warn(`Transcription via ${key.provider} failed: ${result.errorText} — trying next`);
  }
  return { ok: false, errorText: "Nenhum provedor de transcrição disponível (configure uma chave Groq ou OpenAI)" };
}
