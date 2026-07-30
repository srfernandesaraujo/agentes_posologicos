import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CURATED_VOICES, DEFAULT_VOICE_ID, findCuratedVoice } from "@/lib/elevenLabsVoices";

interface Props {
  value: string;
  onChange: (voiceId: string) => void;
}

const CUSTOM_OPTION = "__custom__";

export function VoicePicker({ value, onChange }: Props) {
  const curated = findCuratedVoice(value);
  const [mode, setMode] = useState<"curated" | "custom">(curated || !value ? "curated" : "custom");

  return (
    <div className="space-y-2">
      <Select
        value={mode === "custom" ? CUSTOM_OPTION : (value || DEFAULT_VOICE_ID)}
        onValueChange={(v) => {
          if (v === CUSTOM_OPTION) {
            setMode("custom");
            return;
          }
          setMode("curated");
          onChange(v);
        }}
      >
        <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
          <SelectValue placeholder="Selecione uma voz" />
        </SelectTrigger>
        <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          {CURATED_VOICES.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name} — {v.description}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_OPTION}>Personalizado (ID da ElevenLabs)</SelectItem>
        </SelectContent>
      </Select>

      {mode === "custom" && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Cole o Voice ID da sua conta ElevenLabs"
          className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 font-mono text-xs"
        />
      )}

      <p className="text-xs text-white/30">
        Usada ao ouvir as respostas deste agente em voz. Se a voz curada não estiver na sua biblioteca ElevenLabs,
        adicione-a em elevenlabs.io/app/voice-library ou use um ID personalizado.
      </p>
    </div>
  );
}
