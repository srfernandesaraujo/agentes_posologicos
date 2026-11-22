import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { EASE, useMotionOn } from "@/lib/motion";

interface Props {
  /** Intervalo entre doses (h) */
  tau?: number;
  /** Número de doses */
  doses?: number;
  /** Faixa da janela terapêutica como fração do pico (0..1) */
  window?: [number, number];
  className?: string;
  height?: number;
  /** valor de preserveAspectRatio; padrão estica na largura toda */
  preserve?: string;
  /** a linha se desenha ao aparecer */
  draw?: boolean;
}

/** Curva farmacocinética de doses repetidas (1 compartimento, via oral). Elemento decorativo e informativo. */
export function PkCurve({ tau = 6, doses = 6, window: win = [0.55, 0.9], className, height = 160, preserve = "none", draw = false }: Props) {
  const gid = useId();
  const motionOn = useMotionOn();
  const [lo, hi] = win;
  const { d, yTop, yBottom } = useMemo(() => {
    const ka = 1.4, ke = 0.17, T = tau * doses + 4, W = 1000, H = 200, pad = 12;
    const C = (t: number) => {
      let s = 0;
      for (let i = 0; i < doses; i++) {
        const x = t - i * tau;
        if (x > 0) s += (ka / (ka - ke)) * (Math.exp(-ke * x) - Math.exp(-ka * x));
      }
      return s;
    };
    let mx = 0;
    for (let t = 0; t < T; t += 0.1) mx = Math.max(mx, C(t));
    const X = (t: number) => pad + (t / T) * (W - 2 * pad);
    const Y = (c: number) => H - 8 - (c / (mx * 1.12)) * (H - 24);
    let path = "";
    for (let t = 0; t <= T; t += 0.2) path += `${t ? "L" : "M"}${X(t).toFixed(1)} ${Y(C(t)).toFixed(1)}`;
    return { d: path, yTop: Y(mx * hi), yBottom: Y(mx * lo) };
  }, [tau, doses, lo, hi]);

  return (
    <svg
      viewBox="0 0 1000 200"
      height={height}
      className={className}
      role="img"
      aria-label="Curva de concentração ao longo de doses repetidas, dentro da janela terapêutica"
      preserveAspectRatio={preserve}
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset=".6" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect x="12" y={yTop} width="976" height={yBottom - yTop} fill="rgba(45,212,191,.09)" stroke="rgba(45,212,191,.35)" strokeDasharray="4 5" />
      {draw && motionOn ? (
        <motion.path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: EASE }} />
      ) : (
        <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
