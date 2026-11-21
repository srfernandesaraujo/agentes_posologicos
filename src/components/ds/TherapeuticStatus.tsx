import { cn } from "@/lib/utils";

export type TherapeuticState = "within" | "attention" | "outside";

const STYLE: Record<TherapeuticState, { cls: string; label: string }> = {
  within: { cls: "text-[hsl(var(--success))] border-[hsl(var(--success)/0.4)]", label: "Dentro da janela" },
  attention: { cls: "text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)]", label: "Atenção" },
  outside: { cls: "text-[hsl(var(--destructive-vivid))] border-[hsl(var(--destructive-vivid)/0.4)]", label: "Fora da janela" },
};

/** Pílula de estado da "janela terapêutica": padrão visual único para doses, créditos, notas e uso. */
export function TherapeuticStatus({ state, label, className }: { state: TherapeuticState; label?: string; className?: string }) {
  const s = STYLE[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? s.label}
    </span>
  );
}
