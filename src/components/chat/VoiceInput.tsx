import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const SpeechRecognition: any =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const hasWebSpeech = !!SpeechRecognition;

  useEffect(() => () => {
    try { recognitionRef.current?.stop?.(); } catch {}
    try { mediaRecorderRef.current?.stop?.(); } catch {}
  }, []);

  const startWebSpeech = () => {
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0]?.transcript || "").join(" ").trim();
      if (text) onTranscript(text);
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed") toast.error("Permissão de microfone negada");
      else if (e?.error !== "no-speech") toast.error("Falha no reconhecimento");
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                 : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setProcessing(true);
        try {
          const buf = await blob.arrayBuffer();
          let bin = "";
          const u8 = new Uint8Array(buf);
          for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
          const base64 = btoa(bin);
          const { data, error } = await supabase.functions.invoke("voice-transcribe", {
            body: { audioBase64: base64, mimeType: mr.mimeType || "audio/webm" },
          });
          if (error) throw error;
          const text = (data as any)?.text?.trim();
          if (text) onTranscript(text);
          else toast.error("Não foi possível transcrever");
        } catch (e) {
          console.error(e);
          toast.error("Falha ao transcrever áudio");
        } finally {
          setProcessing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setListening(true);
    } catch {
      toast.error("Permissão de microfone negada");
    }
  };

  const stopAll = () => {
    try { recognitionRef.current?.stop?.(); } catch {}
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    setListening(false);
  };

  const toggle = () => {
    if (processing) return;
    if (listening) { stopAll(); return; }
    if (hasWebSpeech) startWebSpeech();
    else startMediaRecorder();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || processing}
      title={hasWebSpeech ? "Falar (Web Speech)" : "Falar (gravação, 1 crédito)"}
      className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
        listening
          ? "border-red-500/40 bg-red-500/10 text-red-300 animate-pulse"
          : "border-white/10 bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/10"
      } disabled:opacity-40`}
    >
      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}