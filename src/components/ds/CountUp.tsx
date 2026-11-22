import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { useMotionOn } from "@/lib/motion";

interface Props {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

const fmt = (n: number, d: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Número que conta até o valor quando aparece na tela. Sem movimento, mostra direto o valor final. */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", duration = 1.1, className }: Props) {
  const on = useMotionOn();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const [shown, setShown] = useState(on ? 0 : value);
  const from = useRef(on ? 0 : value);

  useEffect(() => {
    if (!on) { setShown(value); from.current = value; return; }
    if (!inView) return;
    // anima a partir do valor anterior: mudanças seguintes não recomeçam do zero
    const c = animate(from.current, value, { duration: from.current === 0 ? duration : Math.min(duration, 0.6), ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { from.current = v; setShown(v); } });
    return () => c.stop();
  }, [on, inView, value, duration]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }} aria-label={`${prefix}${fmt(value, decimals)}${suffix}`}>
      <span aria-hidden="true">{prefix}{fmt(shown, decimals)}{suffix}</span>
    </span>
  );
}
