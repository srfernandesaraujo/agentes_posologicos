import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export function fmtUsd(n: number): string {
  return `US$ ${n.toFixed(2).replace(".", ",")}`;
}

/** Teto de custo da missão: o squad avisa aos 80% e pausa aos 100%. */
export function CostCapField({
  value, onChange, max, estimate, label = "Teto de custo desta missão",
}: { value: number; onChange: (v: number) => void; max: number; estimate: { min: number; max: number }; label?: string }) {
  const below = value < estimate.min;
  const tight = !below && value < estimate.max;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm text-white/80">{label}</Label>
        <span className="font-mono text-sm text-white">{fmtUsd(value)}</span>
      </div>
      <Slider min={0.5} max={max} step={0.5} value={[value]} onValueChange={(v) => onChange(v[0])} aria-label={label} />
      <p className="text-xs text-white/40">
        Estimativa do template: {fmtUsd(estimate.min)} a {fmtUsd(estimate.max)} (valor inicial, será recalibrado com o uso real).
        O squad avisa aos 80% e pausa aos 100% para você decidir.
      </p>
      {below && <p className="text-xs text-amber-400">Teto abaixo da estimativa mínima: o squad vai pausar antes de terminar.</p>}
      {tight && <p className="text-xs text-amber-400/80">Teto dentro da faixa, mas apertado: pode pausar perto da revisão.</p>}
    </div>
  );
}
