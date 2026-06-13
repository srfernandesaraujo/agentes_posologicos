import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, Play, Square } from "lucide-react";

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
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => {
    try { window.speechSynthesis?.cancel(); } catch {}
  }, []);

  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const start = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(stripMarkdown(text).slice(0, 5000));
    utt.lang = "pt-BR";
    utt.rate = rate;
    const voices = synth.getVoices();
    const pt = voices.find((v) => v.lang?.toLowerCase().startsWith("pt"));
    if (pt) utt.voice = pt;
    utt.onend = () => { setPlaying(false); setPaused(false); };
    utt.onerror = () => { setPlaying(false); setPaused(false); };
    uttRef.current = utt;
    synth.speak(utt);
    setPlaying(true);
    setPaused(false);
  };

  const togglePause = () => {
    const synth = window.speechSynthesis;
    if (paused) { synth.resume(); setPaused(false); }
    else { synth.pause(); setPaused(true); }
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
  };

  const changeRate = (next: number) => {
    setRate(next);
    if (playing) { stop(); setTimeout(start, 60); }
  };

  return (
    <div className="flex items-center gap-1">
      {!playing ? (
        <button
          onClick={start}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Ouvir resposta"
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