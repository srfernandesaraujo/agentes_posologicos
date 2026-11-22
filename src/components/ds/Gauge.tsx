import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { EASE, useMotionOn } from "@/lib/motion";

interface Props {
  /** 0 a 1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label?: string;
}

/** Anel de medidor com preenchimento animado e conteúdo no centro. */
export function Gauge({ value, size = 96, stroke = 8, color = "hsl(var(--dom-inicio))", children, label }: Props) {
  const on = useMotionOn();
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = size / 2;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <motion.circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          initial={{ pathLength: on ? 0 : v }} animate={{ pathLength: v }} transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
