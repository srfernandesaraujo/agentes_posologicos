import { useId, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, X, AlertTriangle } from "lucide-react";
import {
  calcWeightBasedDose,
  calcBodySurfaceArea,
  calcDoseByBsa,
  calcCreatinineClearance,
  classifyRenalFunction,
  estimatePediatricWeightKg,
  isCalcErr,
  RENAL_STAGE_LABEL,
  type CalcResult,
  type BsaFormula,
  type BiologicalSex,
} from "@/lib/doseCalculator";

interface Props {
  enabled: boolean;
}

function ResultBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[hsl(174,62%,47%)]/30 bg-[hsl(174,62%,47%)]/[0.08] p-2.5 text-xs text-white/90 space-y-1">
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-2.5 text-xs text-amber-200">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Renders a CalcResult as either the error box or `render(value)` — centralizes
 * the ok/error branching so call sites never touch `.ok` directly (see the
 * `isCalcErr` docstring in doseCalculator.ts for why). */
function CalcResultView<T>({ result, render }: { result: CalcResult<T> | null; render: (value: T) => ReactNode }) {
  if (!result) return null;
  if (isCalcErr(result)) return <ErrorBox message={result.error} />;
  return <>{render(result.value)}</>;
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] text-white/60">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 bg-white/5 border-white/10 text-white text-xs"
      />
    </div>
  );
}

function WeightTab() {
  const [weight, setWeight] = useState("");
  const [dosePerKg, setDosePerKg] = useState("");
  const [maxDose, setMaxDose] = useState("");

  const result = useMemo(() => {
    if (!weight || !dosePerKg) return null;
    return calcWeightBasedDose({
      weightKg: parseFloat(weight),
      doseMgPerKg: parseFloat(dosePerKg),
      maxDoseMg: maxDose ? parseFloat(maxDose) : undefined,
    });
  }, [weight, dosePerKg, maxDose]);

  return (
    <div className="space-y-2.5">
      <NumField label="Peso (kg)" value={weight} onChange={setWeight} placeholder="70" />
      <NumField label="Dose (mg/kg)" value={dosePerKg} onChange={setDosePerKg} placeholder="10" />
      <NumField label="Dose máxima (mg) — opcional" value={maxDose} onChange={setMaxDose} placeholder="ex: 500" />
      <CalcResultView
        result={result}
        render={(value) => (
          <ResultBox>
            <div className="font-semibold text-sm">{value.totalDoseMg.toLocaleString("pt-BR")} mg</div>
            {value.cappedAtMax && <div className="text-amber-300">Limitado pela dose máxima informada.</div>}
            <div className="text-white/50">{result && !isCalcErr(result) ? result.formula : ""}</div>
          </ResultBox>
        )}
      />
    </div>
  );
}

function BsaTab() {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [formula, setFormula] = useState<BsaFormula>("mosteller");
  const [dosePerM2, setDosePerM2] = useState("");
  const [maxDose, setMaxDose] = useState("");

  const bsaResult = useMemo(() => {
    if (!height || !weight) return null;
    return calcBodySurfaceArea({ heightCm: parseFloat(height), weightKg: parseFloat(weight), formula });
  }, [height, weight, formula]);

  const bsaValue = bsaResult && !isCalcErr(bsaResult) ? bsaResult.value : undefined;

  const doseResult = useMemo(() => {
    if (bsaValue === undefined || !dosePerM2) return null;
    return calcDoseByBsa({
      bsaM2: bsaValue,
      doseMgPerM2: parseFloat(dosePerM2),
      maxDoseMg: maxDose ? parseFloat(maxDose) : undefined,
    });
  }, [bsaValue, dosePerM2, maxDose]);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Altura (cm)" value={height} onChange={setHeight} placeholder="170" />
        <NumField label="Peso (kg)" value={weight} onChange={setWeight} placeholder="70" />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-white/60">Fórmula</Label>
        <Select value={formula} onValueChange={(v) => setFormula(v as BsaFormula)}>
          <SelectTrigger className="h-8 bg-white/5 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mosteller">Mosteller</SelectItem>
            <SelectItem value="dubois">Du Bois</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CalcResultView
        result={bsaResult}
        render={(value) => (
          <div className="text-xs text-white/70">BSA: <span className="font-semibold text-white">{value} m²</span></div>
        )}
      />
      <NumField label="Dose (mg/m²) — opcional" value={dosePerM2} onChange={setDosePerM2} placeholder="ex: 175" />
      <NumField label="Dose máxima (mg) — opcional" value={maxDose} onChange={setMaxDose} placeholder="ex: 300" />
      <CalcResultView
        result={doseResult}
        render={(value) => (
          <ResultBox>
            <div className="font-semibold text-sm">{value.totalDoseMg.toLocaleString("pt-BR")} mg</div>
            {value.cappedAtMax && <div className="text-amber-300">Limitado pela dose máxima informada.</div>}
            <div className="text-white/50">{doseResult && !isCalcErr(doseResult) ? doseResult.formula : ""}</div>
          </ResultBox>
        )}
      />
    </div>
  );
}

function RenalTab() {
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState<BiologicalSex>("M");
  const [creatinine, setCreatinine] = useState("");

  const result = useMemo(() => {
    if (!age || !weight || !creatinine) return null;
    return calcCreatinineClearance({
      ageYears: parseFloat(age),
      weightKg: parseFloat(weight),
      sex,
      serumCreatinineMgDl: parseFloat(creatinine),
    });
  }, [age, weight, sex, creatinine]);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Idade (anos)" value={age} onChange={setAge} placeholder="60" />
        <NumField label="Peso (kg)" value={weight} onChange={setWeight} placeholder="70" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dose-calc-sex" className="text-[11px] text-white/60">Sexo</Label>
        <Select value={sex} onValueChange={(v) => setSex(v as BiologicalSex)}>
          <SelectTrigger id="dose-calc-sex" className="h-8 bg-white/5 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="F">Feminino</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <NumField label="Creatinina sérica (mg/dL)" value={creatinine} onChange={setCreatinine} placeholder="1.0" />
      <CalcResultView
        result={result}
        render={(value) => (
          <ResultBox>
            <div className="font-semibold text-sm">{value} mL/min</div>
            <div>{RENAL_STAGE_LABEL[classifyRenalFunction(value)]}</div>
            <div className="text-white/50">{result && !isCalcErr(result) ? result.formula : ""}</div>
          </ResultBox>
        )}
      />
    </div>
  );
}

function PediatricTab() {
  const [age, setAge] = useState("");
  const [knownWeight, setKnownWeight] = useState("");
  const [dosePerKg, setDosePerKg] = useState("");
  const [maxDose, setMaxDose] = useState("");

  const estimated = useMemo(() => {
    if (knownWeight || !age) return null;
    return estimatePediatricWeightKg(parseFloat(age));
  }, [age, knownWeight]);

  const estimatedValue = estimated && !isCalcErr(estimated) ? estimated.value : undefined;
  const effectiveWeight = knownWeight ? parseFloat(knownWeight) : estimatedValue;

  const doseResult = useMemo(() => {
    if (effectiveWeight === undefined || !dosePerKg) return null;
    return calcWeightBasedDose({
      weightKg: effectiveWeight,
      doseMgPerKg: parseFloat(dosePerKg),
      maxDoseMg: maxDose ? parseFloat(maxDose) : undefined,
    });
  }, [effectiveWeight, dosePerKg, maxDose]);

  return (
    <div className="space-y-2.5">
      <NumField label="Idade (anos)" value={age} onChange={setAge} placeholder="6" />
      <NumField label="Peso real (kg) — se conhecido" value={knownWeight} onChange={setKnownWeight} placeholder="deixe em branco para estimar" />
      {!knownWeight && (
        <CalcResultView
          result={estimated}
          render={(value) => (
            <div className="text-xs text-white/70">
              Peso estimado (APLS): <span className="font-semibold text-white">{value} kg</span>
              <div className="text-white/40">{estimated && !isCalcErr(estimated) ? estimated.formula : ""}</div>
            </div>
          )}
        />
      )}
      <NumField label="Dose (mg/kg)" value={dosePerKg} onChange={setDosePerKg} placeholder="10" />
      <NumField label="Dose máxima (mg) — opcional" value={maxDose} onChange={setMaxDose} placeholder="ex: 250" />
      <CalcResultView
        result={doseResult}
        render={(value) => (
          <ResultBox>
            <div className="font-semibold text-sm">{value.totalDoseMg.toLocaleString("pt-BR")} mg</div>
            {value.cappedAtMax && <div className="text-amber-300">Limitado pela dose máxima informada.</div>}
            {!knownWeight && <div className="text-amber-300">Baseado em peso estimado — use o peso real sempre que possível.</div>}
          </ResultBox>
        )}
      />
    </div>
  );
}

// Conteúdo puro da calculadora (abas + disclaimer), sem o wrapper fixed/FAB — reutilizado
// tanto pelo widget flutuante do chat quanto pela página standalone em /calculadora.
export function DoseCalculatorPanel({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Tabs defaultValue="peso" className="flex flex-col">
        <TabsList className="grid grid-cols-4 h-8 bg-white/5">
          <TabsTrigger value="peso" className="text-[10px] px-1">Peso</TabsTrigger>
          <TabsTrigger value="bsa" className="text-[10px] px-1">SC</TabsTrigger>
          <TabsTrigger value="renal" className="text-[10px] px-1">Renal</TabsTrigger>
          <TabsTrigger value="pediatrico" className="text-[10px] px-1">Pediatria</TabsTrigger>
        </TabsList>
        <div className="mt-2">
          <TabsContent value="peso" className="mt-0"><WeightTab /></TabsContent>
          <TabsContent value="bsa" className="mt-0"><BsaTab /></TabsContent>
          <TabsContent value="renal" className="mt-0"><RenalTab /></TabsContent>
          <TabsContent value="pediatrico" className="mt-0"><PediatricTab /></TabsContent>
        </div>
      </Tabs>

      <div className="pt-3 mt-2 border-t border-white/10 text-[10px] text-white/30">
        ⚠️ Cálculo de apoio — confirme sempre com a bula e o julgamento clínico
      </div>
    </div>
  );
}

export function DoseCalculator({ enabled }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  if (!enabled) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed left-4 top-24 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(174,62%,47%)]/20 border border-[hsl(174,62%,47%)]/40 text-[hsl(174,62%,67%)] hover:bg-[hsl(174,62%,47%)]/30 transition-colors shadow-lg"
        title="Abrir Calculadora de Dose"
      >
        <Calculator className="h-5 w-5" />
      </button>
    );
  }

  return (
    <aside className="fixed left-4 top-20 bottom-4 z-40 w-80 rounded-xl border border-white/10 bg-[hsl(220,25%,8%)]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[hsl(174,62%,67%)]" />
          <span className="text-sm font-semibold text-white">Calculadora de Dose</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white hover:bg-white/10" onClick={() => setCollapsed(true)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <DoseCalculatorPanel />
      </div>
    </aside>
  );
}
