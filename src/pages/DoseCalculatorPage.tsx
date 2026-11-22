import { Calculator, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DoseCalculatorPanel } from "@/components/chat/DoseCalculator";
import { useNewUI } from "@/contexts/NewUIContext";
import { PkCurve } from "@/components/ds/PkCurve";
import { DoseBench } from "@/components/calculator/DoseBench";

export default function DoseCalculatorPage() {
  const { enabled: newUI } = useNewUI();

  if (newUI) {
    return (
      <div className="container max-w-6xl py-8 space-y-5">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(var(--dom-clinica)/0.12)] via-pos-base to-pos-base p-6 md:p-8">
          <PkCurve draw height={110} className="pointer-events-none absolute bottom-0 right-0 hidden w-[46%] opacity-40 [mask-image:linear-gradient(to_right,transparent,#000_45%)] md:block" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--dom-clinica))]">Clínica</p>
              <Badge variant="outline" className="gap-1 border-white/20 text-xs text-white/70">
                <WifiOff className="h-3 w-3" /> Funciona offline
              </Badge>
            </div>
            <h1 className="mt-2 flex items-center gap-3 font-brand text-3xl font-extrabold tracking-tight text-white">
              <Calculator className="h-7 w-7 text-[hsl(var(--dom-clinica))]" /> Calculadora de Dose
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/55">
              mg/kg, superfície corporal, clearance renal (Cockcroft-Gault) e peso pediátrico estimado.
              Cálculos determinísticos que continuam funcionando sem conexão. Dica: digite a conta na barra de busca,
              por exemplo <span className="font-mono text-white/80">70 kg 5 mg/kg</span>.
            </p>
          </div>
        </div>
        <DoseBench />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" /> Calculadora de Dose
        </h1>
        <Badge variant="outline" className="gap-1 text-xs">
          <WifiOff className="h-3 w-3" /> Funciona offline
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Cálculos determinísticos de mg/kg, superfície corporal, clearance renal (Cockcroft-Gault)
        e peso pediátrico estimado. Uma vez carregada, esta página continua funcionando mesmo
        sem conexão.
      </p>
      <div className="rounded-xl border border-white/10 bg-[hsl(220,25%,8%)] p-4">
        <DoseCalculatorPanel />
      </div>
    </div>
  );
}
