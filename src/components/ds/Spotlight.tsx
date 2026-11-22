import { useRef, type HTMLAttributes, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** cor da luz, ex.: "var(--dom-clinica)" (sem hsl) */
  tone?: string;
}

/** Cartão com brilho e borda iluminada no ponto onde o mouse passa (efeito em CSS, sem re-render). */
export function Spotlight({ tone = "var(--dom-inicio)", className, children, style, onPointerMove, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    onPointerMove?.(e);
  };
  return (
    <div ref={ref} onPointerMove={move} className={cn("pos-spot", className)} style={{ ...style, ["--tone" as string]: tone }} {...rest}>
      {children}
    </div>
  );
}
