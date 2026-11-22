import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Cast, MessageCircleQuestion, Radio, Users, X } from "lucide-react";
import { AreaTrend } from "@/components/ds/AreaTrend";
import { CountUp } from "@/components/ds/CountUp";

interface Msg { created_at: string; sender_name?: string; is_anonymous?: boolean }

interface Props {
  pin: string;
  shareUrl: string;
  live: boolean;
  questions: Msg[];
  broadcasts: Msg[];
}

const BUCKET_MS = 5 * 60_000;
const BUCKETS = 12; // última hora

const pad = (n: number) => String(n).padStart(2, "0");

/** Faixa de pulso da aula: dúvidas chegando, ritmo da última hora, tempo de aula e o código para projetar. */
export function LiveClassPulse({ pin, shareUrl, live, questions, broadcasts }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [project, setProject] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setProject(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project]);

  const series = useMemo(() => {
    const out = new Array(BUCKETS).fill(0);
    const end = Math.floor(now / BUCKET_MS) * BUCKET_MS + BUCKET_MS;
    questions.forEach((q) => {
      const idx = BUCKETS - 1 - Math.floor((end - new Date(q.created_at).getTime() - 1) / BUCKET_MS);
      if (idx >= 0 && idx < BUCKETS) out[idx] += 1;
    });
    return out;
  }, [questions, now]);

  const last10 = questions.filter((q) => now - new Date(q.created_at).getTime() < 10 * 60_000).length;
  const askers = new Set(questions.filter((q) => !q.is_anonymous && q.sender_name).map((q) => q.sender_name)).size;
  const start = broadcasts.length ? new Date(broadcasts[0].created_at).getTime() : null;
  const elapsed = start ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  const clock = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`;

  return (
    <>
      <div className="grid gap-3 border-b border-white/10 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[auto_1fr_auto]" role="region" aria-label="Pulso da aula">
        <div className="flex items-center gap-4">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${live ? "border-[hsl(var(--destructive-vivid)/0.6)] text-[hsl(var(--destructive-vivid))]" : "border-border text-muted-foreground"}`}>
            <Radio className={`h-3.5 w-3.5 ${live ? "animate-pulse" : ""}`} /> {live ? "ao vivo" : "pausada"}
          </span>
          <div>
            <div className="font-display text-2xl font-extrabold tabular-nums text-foreground">{start ? clock : "--:--:--"}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">tempo de aula</div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div>
            <div className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-foreground"><MessageCircleQuestion className="h-4 w-4 text-[hsl(var(--dom-ensino))]" /><CountUp value={questions.length} duration={0.6} /></div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{last10} nos últimos 10 min</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-foreground"><Users className="h-4 w-4 text-[hsl(var(--dom-ensino))]" /><CountUp value={askers} duration={0.6} /></div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">perguntaram com nome</div>
          </div>
          <div className="min-w-0 flex-1">
            <AreaTrend values={series} color="hsl(var(--dom-ensino))" height={44} className="w-full" label="Dúvidas por 5 minutos, última hora" />
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">dúvidas por 5 min · última hora</div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button onClick={() => setProject(true)} className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--dom-ensino)/0.5)] bg-[hsl(var(--dom-ensino)/0.10)] px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-[hsl(var(--dom-ensino)/0.18)]">
            <Cast className="h-4 w-4 text-[hsl(var(--dom-ensino))]" /> Projetar código
          </button>
        </div>
      </div>

      {project && createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-pos-vacuo/95 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Código da sala para projetar" onClick={() => setProject(false)}>
          <button onClick={() => setProject(false)} aria-label="Fechar" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          <div className="flex max-w-5xl flex-col items-center gap-8 text-center md:flex-row md:text-left" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-3xl bg-white p-5 shadow-[0_30px_80px_-30px_hsl(var(--dom-ensino))]">
              <QRCodeSVG value={shareUrl} size={260} level="M" />
            </div>
            <div>
              <p className="font-mono text-sm uppercase tracking-[0.2em] text-[hsl(var(--dom-ensino))]">Entre na sala</p>
              <p className="mt-2 font-display text-[clamp(64px,14vw,160px)] font-extrabold leading-none tracking-tight text-foreground">{pin}</p>
              <p className="mt-3 break-all font-mono text-base text-muted-foreground">{shareUrl.replace(/^https?:\/\//, "")}</p>
              <p className="mt-6 text-sm text-muted-foreground">Aponte a câmera para o QR ou digite o código. Esc para fechar.</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
