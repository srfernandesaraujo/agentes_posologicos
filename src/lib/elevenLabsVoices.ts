/**
 * Curated ElevenLabs premade voices for the agent voice picker.
 * IDs are ElevenLabs' public premade-voice library (eleven_multilingual_v2,
 * supports pt-BR). If a voice isn't in the account's library yet, it needs to
 * be added from https://elevenlabs.io/app/voice-library first — otherwise
 * fall back to the "Personalizado" option with the account's own voice ID.
 */
export interface CuratedVoice {
  id: string;
  name: string;
  description: string;
}

export const CURATED_VOICES: CuratedVoice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Feminina, tom calmo (padrão)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Feminina, tom sereno" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Feminina, tom expressivo" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Masculina, tom grave" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Masculina, tom equilibrado" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Masculina, tom firme" },
];

export const DEFAULT_VOICE_ID = CURATED_VOICES[0].id;

export function findCuratedVoice(voiceId: string | null | undefined): CuratedVoice | undefined {
  return CURATED_VOICES.find((v) => v.id === voiceId);
}
