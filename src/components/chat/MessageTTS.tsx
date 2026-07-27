import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, Play, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MessageTTSProps { text: string }

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/[*_~]/g, "")
    .replace(/^#+\s/gm, "")
    .replace(/\|/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function MessageTTS({ text }: MessageTTSProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    try {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    } catch {}
  }, []);

  const ensureAudio = async (): Promise<HTMLAudioElement | null> => {
    if (audioRef.current && urlRef.current) return audioRef.current;
    setLoading(true);
    try {
      const clean = stripMarkdown(text).slice(0, 5000);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        toast.error("Faça login para ouvir a narração");
        return null;
      }
      const url = `${SUPABASE_URL}/functions/v1/tts-elevenlabs`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) {
        toast.error("Falha ao gerar áudio");
        return null;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      urlRef.current = objUrl;
      const audio = new Audio(objUrl);
      audio.playbackRate = rate;
      audio.onended = () => { setPlaying(false); setPaused(false); };
      audio.onerror = () => { setPlaying(false); setPaused(false); };
      audioRef.current = audio;
      return audio;
    } finally {
      setLoading(false);
    }
  };

  const start = async () => {
    const audio = await ensureAudio();
    if (!audio) return;
    audio.currentTime = 0;
    audio.playbackRate = rate;
    await audio.play();
    setPlaying(true);
    setPaused(false);
  };

  const togglePause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (paused) { audio.play(); setPaused(false); }
    else { audio.pause(); setPaused(true); }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setPlaying(false);
    setPaused(false);
  };

  const changeRate = (next: number) => {
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="flex items-center gap-1">
      {loading ? (
        <span className="flex items-center gap-1 px-2 py-1 text-xs text-white/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...
        </span>
      ) : !playing ? (
        <button
          onClick={start}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Ouvir com voz natural (ElevenLabs)"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <>
          <button onClick={togglePause} className="flex items-center rounded px-1.5 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10" title={paused ? "Continuar" : "Pausar"}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
          <button onClick={stop} className="flex items-center rounded px-1.5 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10" title="Parar">
            <Square className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <select
        value={rate}
        onChange={(e) => changeRate(Number(e.target.value))}
        className="bg-transparent text-[10px] text-white/50 hover:text-white/80 border border-white/10 rounded px-1 py-0.5 cursor-pointer"
        title="Velocidade"
      >
        <option value={0.8} className="bg-slate-900">0.8x</option>
        <option value={1} className="bg-slate-900">1x</option>
        <option value={1.25} className="bg-slate-900">1.25x</option>
        <option value={1.5} className="bg-slate-900">1.5x</option>
        <option value={1.75} className="bg-slate-900">1.75x</option>
      </select>
    </div>
  );
}