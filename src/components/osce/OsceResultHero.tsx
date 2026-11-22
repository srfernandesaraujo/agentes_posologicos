import { motion } from "framer-motion";
import { Clock, Coins, Trophy } from "lucide-react";
import { CountUp } from "@/components/ds/CountUp";
import { Gauge } from "@/components/ds/Gauge";
import { EASE, useMotionOn } from "@/lib/motion";

interface Item { criterion: string; score: number | string; max_score: number | string }

interface Props {
  title: string;
  score: number;
  max: number;
  durationMin: number;
  credits: number;
  items: Item[];
  feedback?: string | null;
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

function verdict(pct: number): { label: string; tone: string } {
  if (pct >= 70) return { label: "Bom desempenho", tone: "var(--dom-acervo)" };
  if (pct >= 50) return { label: "Em desenvolvimento", tone: "var(--dom-ensino)" };
  return { label: "Precisa de reforço", tone: "var(--dom-ajuda)" };
}

/** Relatório do OSCE: nota em destaque e o retrato dos critérios da rubrica em radar (ou barras quando há poucos critérios). */
export function OsceResultHero({ title, score, max, durationMin, credits, items, feedback }: Props) {
  const on = useMotionOn();
  const pct = max > 0 ? (score / max) * 100 : 0;
  const v = verdict(pct);
  const vals = items.map((i) => (Number(i.max_score) > 0 ? Math.max(0, Math.min(1, Number(i.score) / Number(i.max_score))) : 0));
  const radar = items.length >= 3;
  const R = 92;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const poly = vals.map((x, i) => pt(i, x * R).map((n) => n.toFixed(1)).join(",")).join(" ");

  return (
    <section className="pos-elev overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[hsl(var(--dom-ensino)/0.12)] via-card to-card p-6 md:p-8" aria-label="Resultado">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--dom-ensino))]"><Trophy className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />Resultado da estação</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h1>

      <div className="mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-6">
          <Gauge value={pct / 100} size={150} stroke={11} color={`hsl(${v.tone})`} label={`Nota ${pct.toFixed(0)}%`}>
            <div>
              <div className="font-display text-4xl font-extrabold leading-none text-foreground"><CountUp value={score} decimals={1} /></div>
              <div className="font-mono text-xs text-muted-foreground">de {max.toFixed(1)}</div>
            </div>
          </Gauge>
          <div>
            <div className="font-display text-3xl font-extrabold" style={{ color: `hsl(${v.tone})` }}><CountUp value={pct} suffix="%" /></div>
            <div className="text-sm font-medium text-foreground">{v.label}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{durationMin} min</span>
              <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />{credits} créditos</span>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="min-w-0">
            {radar ? (
              <svg viewBox="-150 -120 300 240" className="mx-auto w-full max-w-[420px]" role="img" aria-label="Radar dos critérios da rubrica">
                {[0.33, 0.66, 1].map((k) => (
                  <polygon key={k} points={items.map((_, i) => pt(i, R * k).map((n) => n.toFixed(1)).join(",")).join(" ")} fill="none" stroke="hsl(var(--border))" />
                ))}
                {items.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="hsl(var(--border))" />; })}
                <motion.polygon
                  points={poly} fill="hsl(var(--dom-ensino) / 0.22)" stroke="hsl(var(--dom-ensino))" strokeWidth="2" strokeLinejoin="round"
                  initial={{ opacity: on ? 0 : 1, scale: on ? 0.2 : 1 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: EASE }} style={{ transformOrigin: "0px 0px" }}
                />
                {vals.map((x, i) => { const [px, py] = pt(i, x * R); return <circle key={i} cx={px} cy={py} r="3" fill="hsl(var(--dom-ensino))" />; })}
                {items.map((it, i) => {
                  const [x, y] = pt(i, R + 16);
                  return <text key={i} x={x} y={y + 3} textAnchor={Math.abs(x) < 8 ? "middle" : x > 0 ? "start" : "end"} fontSize="8.5" fontFamily="JetBrains Mono, monospace" fill="hsl(var(--muted-foreground))">{short(it.criterion, 18)}</text>;
                })}
              </svg>
            ) : (
              <ul className="space-y-3">
                {items.map((it, i) => (
                  <li key={i}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-foreground">{it.criterion}</span><b className="font-mono text-foreground">{Number(it.score).toFixed(1)}/{it.max_score}</b></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-[hsl(var(--dom-ensino))]" initial={{ width: on ? 0 : `${vals[i] * 100}%` }} animate={{ width: `${vals[i] * 100}%` }} transition={{ duration: 0.9, ease: EASE }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {feedback && <p className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed text-foreground/90">{feedback}</p>}
    </section>
  );
}
