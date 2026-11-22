import { motion } from "framer-motion";
import { EASE, useMotionOn } from "@/lib/motion";

interface Step { name: string; error?: boolean }

interface Props {
  goal: string;
  /** etapas do plano; vazio enquanto carrega */
  steps: Step[];
  loading: boolean;
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

/** O plano desenhado: objetivo à esquerda, especialistas no meio, dossiê à direita. As ligações se desenham em sequência. */
export function OrchestratorGraph({ goal, steps, loading }: Props) {
  const on = useMotionOn();
  const placeholders = loading && steps.length === 0 ? 3 : 0;
  const n = Math.max(steps.length, placeholders);
  if (n === 0) return null;

  const W = 720, rowH = 54, H = Math.max(150, n * rowH + 30);
  const gx = 90, mx = 360, dx = 630;
  const cy = H / 2;
  const ys = Array.from({ length: n }, (_, i) => 30 + (i + 0.5) * ((H - 60) / n));
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;

  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full min-w-[560px] max-w-[760px]" role="img" aria-label={`Plano com ${n} especialistas`}>
        {ys.map((y, i) => (
          <g key={i}>
            <motion.path d={curve(gx + 62, cy, mx - 92, y)} fill="none" stroke="hsl(var(--dom-equipes))" strokeOpacity=".6" strokeWidth="1.6" strokeDasharray={loading && !steps.length ? "4 5" : undefined}
              className={loading && !steps.length ? "pos-flow-line" : undefined}
              initial={{ pathLength: on && steps.length ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.15 * i, ease: EASE }} />
            <motion.path d={curve(mx + 92, y, dx - 62, cy)} fill="none" stroke="hsl(var(--dom-equipes))" strokeOpacity=".6" strokeWidth="1.6" strokeDasharray={loading && !steps.length ? "4 5" : undefined}
              className={loading && !steps.length ? "pos-flow-line" : undefined}
              initial={{ pathLength: on && steps.length ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.15 * i + 0.3, ease: EASE }} />
          </g>
        ))}

        <g>
          <rect x={gx - 62} y={cy - 22} width="124" height="44" rx="12" fill="hsl(var(--dom-clinica) / 0.16)" stroke="hsl(var(--dom-clinica))" />
          <text x={gx} y={cy - 3} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="hsl(var(--dom-clinica))" letterSpacing="1.5">OBJETIVO</text>
          <text x={gx} y={cy + 11} textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))">{short(goal || "seu objetivo", 18)}</text>
        </g>

        {ys.map((y, i) => {
          const st = steps[i];
          const err = !!st?.error;
          const stroke = err ? "hsl(var(--destructive-vivid))" : "hsl(var(--dom-equipes))";
          return (
            <motion.g key={i} initial={{ opacity: on ? 0 : 1, y: on ? 8 : 0 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 * i + 0.1 }}>
              <rect x={mx - 92} y={y - 19} width="184" height="38" rx="11" fill="hsl(var(--card))" stroke={stroke} strokeOpacity={st ? 1 : 0.5} />
              {st ? (
                <text x={mx} y={y + 4} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">{short(st.name, 26)}</text>
              ) : (
                <rect x={mx - 60} y={y - 4} width="120" height="8" rx="4" className="pos-shimmer" />
              )}
            </motion.g>
          );
        })}

        <g>
          <rect x={dx - 62} y={cy - 22} width="124" height="44" rx="12" fill="hsl(var(--dom-acervo) / 0.14)" stroke="hsl(var(--dom-acervo))" strokeOpacity={steps.length ? 1 : 0.4} />
          <text x={dx} y={cy - 3} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="hsl(var(--dom-acervo))" letterSpacing="1.5">DOSSIÊ</text>
          <text x={dx} y={cy + 11} textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))">{steps.length ? "consolidado" : "a caminho"}</text>
        </g>
      </svg>
      {loading && steps.length === 0 && <p className="mt-1 text-center font-mono text-[11px] text-muted-foreground">Decompondo o objetivo e escolhendo os especialistas…</p>}
    </div>
  );
}
