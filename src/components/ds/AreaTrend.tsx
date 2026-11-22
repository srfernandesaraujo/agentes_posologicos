import { useId } from "react";
import { motion } from "framer-motion";
import { EASE, useMotionOn } from "@/lib/motion";

interface Props {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  /** rótulo acessível */
  label?: string;
}

/** Gráfico de área sem eixos, para tendências. A linha se desenha ao aparecer; o último ponto é destacado. */
export function AreaTrend({ values, color = "hsl(var(--dom-inicio))", height = 96, className, label = "Tendência" }: Props) {
  const gid = useId();
  const on = useMotionOn();
  const W = 300, H = 100, pad = 6;
  if (values.length < 2) return <svg viewBox={`0 0 ${W} ${H}`} height={height} className={className} aria-hidden="true" />;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - pad * 2), H - pad - ((v - min) / span) * (H - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} height={height} className={className} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={H * f} y2={H * f} stroke="hsl(var(--border))" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
      ))}
      <motion.path d={`${line}L${W - pad} ${H}L${pad} ${H}Z`} fill={`url(#${gid})`} initial={{ opacity: on ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.3 }} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: on ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE }} />
      <circle cx={lx} cy={ly} r="3.5" fill={color} />
    </svg>
  );
}
