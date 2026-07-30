import { Calculator, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DoseCalculatorPanel } from "@/components/chat/DoseCalculator";

export default function DoseCalculatorPage() {
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
