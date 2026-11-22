import { useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Pin, Sparkles, X } from "lucide-react";
import { PkCurve } from "@/components/ds/PkCurve";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { EASE, useMotionOn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  calcBodySurfaceArea,
  calcCreatinineClearance,
  calcDoseByBsa,
  calcWeightBasedDose,
  classifyRenalFunction,
  estimatePediatricWeightKg,
  isCalcErr,
  RENAL_STAGE_LABEL,
  type BiologicalSex,
  type BsaFormula,
  type CalcResult,
} from "@/lib/doseCalculator";
import { accumulationFactor, simulate, timeToSteadyStateH } from "@/lib/pkAccumulation";

type Mode = "peso" | "sc" | "renal" | "ped";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "peso", label: "Dose por peso", hint: "mg/kg" },
  { id: "sc", label: "Superfície corporal", hint: "m²" },
  { id: "renal", label: "Função renal", hint: "Cockcroft-Gault" },
  { id: "ped", label: "Pediatria", hint: "peso estimado" },
];

const EXAMPLE_HINT: Record<Mode, string> = {
  peso: "70 kg · 5 mg/kg",
  sc: "70 kg · 170 cm · 100 mg/m²",
  renal: "60 anos · 70 kg · creatinina 1,0",
  ped: "6 anos (peso estimado) · 10 mg/kg",
};

const num = (s: string) => (s.trim() === "" ? NaN : parseFloat(s.replace(",", ".")));
const ok = <T,>(r: CalcResult<T> | null) => (r && !isCalcErr(r) ? r : null);
const err = <T,>(r: CalcResult<T> | null) => (r && isCalcErr(r) ? r.error : null);

interface Outcome {
  value: number;
  unit: string;
  decimals: number;
  title: string;
  formula: string;
  notes: string[];
}

function Field({ label, unit, value, onChange, placeholder, optional }: { label: string; unit: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        {optional && <span className="font-mono text-[10px] opacity-70">opcional</span>}
      </label>
      <div className="flex items-center rounded-xl border border-border bg-background/60 transition focus-within:border-[hsl(var(--dom-clinica))] focus-within:shadow-[0_0_0_4px_hsl(var(--dom-clinica)/0.15)]">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent px-3 py-2.5 font-mono text-lg text-foreground outline-none placeholder:text-muted-foreground/40"
        />
        <span className="pr-3 font-mono text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

/** Barra de estágios da função renal com marcador. */
function RenalScale({ value }: { value: number }) {
  const on = useMotionOn();
  const stages = [
    { to: 15, color: "var(--dom-ajuda)", name: "falência" },
    { to: 30, color: "var(--dom-ensino)", name: "grave" },
    { to: 60, color: "var(--dom-ensino)", name: "moderada" },
    { to: 90, color: "var(--dom-acervo)", name: "leve" },
    { to: 120, color: "var(--dom-acervo)", name: "normal" },
  ];
  const pos = Math.max(0, Math.min(1, value / 120)) * 100;
  let from = 0;
  return (
    <div className="mt-6">
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-full">
          {stages.map((s, i) => {
            const w = ((s.to - from) / 120) * 100;
            from = s.to;
            return <div key={s.name} style={{ width: `${w}%`, background: `hsl(${s.color} / ${0.35 + i * 0.12})` }} />;
          })}
        </div>
        <motion.div
          className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_3px_hsl(var(--background))]"
          initial={{ left: on ? "0%" : `${pos}%` }}
          animate={{ left: `${pos}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0</span><span>15</span><span>30</span><span>60</span><span>90</span><span>120+ mL/min</span>
      </div>
    </div>
  );
}

/** Simulação didática de acúmulo com cursor interativo. */
function AccumulationLab() {
  const gid = useId();
  const on = useMotionOn();
  const [tau, setTau] = useState(8);
  const [half, setHalf] = useState(6);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sim = useMemo(() => simulate(tau, half), [tau, half]);

  const W = 600, H = 200, padL = 8, padR = 8, padT = 12, padB = 22;
  const ymax = Math.max(sim.max * 1.12, 1.2);
  const X = (t: number) => padL + (t / sim.totalH) * (W - padL - padR);
  const Y = (c: number) => H - padB - (c / ymax) * (H - padT - padB);
  const path = sim.points.map(([t, c], i) => `${i ? "L" : "M"}${X(t).toFixed(1)} ${Y(c).toFixed(1)}`).join("");
  const ss = timeToSteadyStateH(half);
  const R = accumulationFactor(tau, half);

  const hp = hover === null ? null : sim.points[Math.max(0, Math.min(sim.points.length - 1, Math.round(hover * (sim.points.length - 1))))];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-bold text-foreground">Simular acúmulo de doses repetidas</h3>
        <span className="font-mono text-[10.5px] text-muted-foreground">ilustração didática · concentração relativa</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Informe o intervalo e a meia-vida do fármaco que você está estudando. O gráfico mostra como a concentração sobe até o equilíbrio. Não usa dados de nenhum medicamento específico.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          <span className="flex justify-between font-mono"><span>intervalo entre doses</span><b className="text-foreground">{tau} h</b></span>
          <input type="range" min={1} max={48} step={1} value={tau} onChange={(e) => setTau(+e.target.value)} className="mt-1 w-full accent-[hsl(var(--dom-clinica))]" />
        </label>
        <label className="block text-xs text-muted-foreground">
          <span className="flex justify-between font-mono"><span>meia-vida</span><b className="text-foreground">{half} h</b></span>
          <input type="range" min={1} max={48} step={1} value={half} onChange={(e) => setHalf(+e.target.value)} className="mt-1 w-full accent-[hsl(var(--dom-clinica))]" />
        </label>
      </div>

      <div className="relative mt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          height={200}
          preserveAspectRatio="none"
          role="img"
          aria-label="Concentração relativa ao longo de doses repetidas"
          onPointerMove={(e) => {
            const r = svgRef.current?.getBoundingClientRect();
            if (r) setHover(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor="#2DD4BF" /><stop offset=".6" stopColor="#38BDF8" /><stop offset="1" stopColor="#A78BFA" /></linearGradient>
            <linearGradient id={`${gid}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2DD4BF" stopOpacity=".25" /><stop offset="1" stopColor="#2DD4BF" stopOpacity="0" /></linearGradient>
          </defs>
          {[1, 2, 3].filter((v) => v < ymax).map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="hsl(var(--border))" strokeDasharray={v === 1 ? "5 4" : "2 6"} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {ss < sim.totalH && <line x1={X(ss)} x2={X(ss)} y1={padT} y2={H - padB} stroke="hsl(var(--dom-ensino))" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
          <path d={`${path}L${X(sim.totalH)} ${H - padB}L${X(0)} ${H - padB}Z`} fill={`url(#${gid}f)`} />
          <motion.path
            d={path} fill="none" stroke={`url(#${gid})`} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: on ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: EASE }}
          />
          {hp && <line x1={X(hp[0])} x2={X(hp[0])} y1={padT} y2={H - padB} stroke="hsl(var(--foreground))" strokeOpacity=".35" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hp && (
          <div className="pointer-events-none absolute top-1 rounded-lg border border-border bg-popover px-2 py-1 font-mono text-[11px] text-foreground shadow-lg" style={{ left: `${Math.min(78, Math.max(0, (hp[0] / sim.totalH) * 100))}%` }}>
            {hp[0].toFixed(0)} h · {hp[1].toFixed(2)}×
          </div>
        )}
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>0 h</span><span>{Math.round(sim.totalH / 2)} h</span><span>{Math.round(sim.totalH)} h</span></div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-muted/50 p-3"><dd className="font-display text-2xl font-extrabold text-foreground"><CountUp value={R} decimals={2} suffix="×" /></dd><dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">fator de acúmulo</dt></div>
        <div className="rounded-xl bg-muted/50 p-3"><dd className="font-display text-2xl font-extrabold text-foreground"><CountUp value={ss} decimals={0} suffix=" h" /></dd><dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">até o equilíbrio (≈4,5 meias-vidas)</dt></div>
        <div className="rounded-xl bg-muted/50 p-3"><dd className="font-display text-2xl font-extrabold text-foreground"><CountUp value={sim.trough > 0 ? sim.peak / sim.trough : 0} decimals={1} suffix="×" /></dd><dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">pico ÷ vale no equilíbrio</dt></div>
      </dl>
    </div>
  );
}

/** Calculadora do novo visual: entrada à esquerda, resultado grande à direita, comparação de cenários e simulação. */
export function DoseBench() {
  const [mode, setMode] = useState<Mode>("peso");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<BiologicalSex>("M");
  const [creat, setCreat] = useState("");
  const [dosePerKg, setDosePerKg] = useState("");
  const [dosePerM2, setDosePerM2] = useState("");
  const [maxDose, setMaxDose] = useState("");
  const [formula, setFormula] = useState<BsaFormula>("mosteller");
  const [pinned, setPinned] = useState<{ id: number; label: string; value: number; unit: string; decimals: number }[]>([]);

  const maxMg = Number.isNaN(num(maxDose)) ? undefined : num(maxDose);

  const computed = useMemo<{ outcome: Outcome | null; error: string | null }>(() => {
    const w = num(weight), h = num(height), a = num(age), c = num(creat), dk = num(dosePerKg), dm = num(dosePerM2);
    if (mode === "peso") {
      if (Number.isNaN(w) || Number.isNaN(dk)) return { outcome: null, error: null };
      const r = calcWeightBasedDose({ weightKg: w, doseMgPerKg: dk, maxDoseMg: maxMg });
      const o = ok(r);
      return { outcome: o ? { value: o.value.totalDoseMg, unit: "mg", decimals: o.value.totalDoseMg % 1 ? 1 : 0, title: "Dose total", formula: o.formula, notes: o.value.cappedAtMax ? ["Limitada pela dose máxima informada."] : [] } : null, error: err(r) };
    }
    if (mode === "sc") {
      if (Number.isNaN(h) || Number.isNaN(w)) return { outcome: null, error: null };
      const b = calcBodySurfaceArea({ heightCm: h, weightKg: w, formula });
      const bo = ok(b);
      if (!bo) return { outcome: null, error: err(b) };
      if (!Number.isNaN(dm)) {
        const r = calcDoseByBsa({ bsaM2: bo.value, doseMgPerM2: dm, maxDoseMg: maxMg });
        const o = ok(r);
        if (!o) return { outcome: null, error: err(r) };
        return { outcome: { value: o.value.totalDoseMg, unit: "mg", decimals: o.value.totalDoseMg % 1 ? 1 : 0, title: `Dose total · SC ${bo.value} m²`, formula: o.formula, notes: o.value.cappedAtMax ? ["Limitada pela dose máxima informada."] : [] }, error: null };
      }
      return { outcome: { value: bo.value, unit: "m²", decimals: 2, title: "Superfície corporal", formula: bo.formula, notes: [] }, error: null };
    }
    if (mode === "renal") {
      if (Number.isNaN(a) || Number.isNaN(w) || Number.isNaN(c)) return { outcome: null, error: null };
      const r = calcCreatinineClearance({ ageYears: a, weightKg: w, sex, serumCreatinineMgDl: c });
      const o = ok(r);
      return { outcome: o ? { value: o.value, unit: "mL/min", decimals: 1, title: "Clearance de creatinina", formula: o.formula, notes: [RENAL_STAGE_LABEL[classifyRenalFunction(o.value)]] } : null, error: err(r) };
    }
    // pediatria
    if (Number.isNaN(dk) || (Number.isNaN(w) && Number.isNaN(a))) return { outcome: null, error: null };
    let kg = w;
    const notes: string[] = [];
    if (Number.isNaN(kg)) {
      const est = estimatePediatricWeightKg(a);
      const eo = ok(est);
      if (!eo) return { outcome: null, error: err(est) };
      kg = eo.value;
      notes.push(`Peso estimado (APLS): ${kg} kg. Use o peso real sempre que possível.`);
    }
    const r = calcWeightBasedDose({ weightKg: kg, doseMgPerKg: dk, maxDoseMg: maxMg });
    const o = ok(r);
    if (!o) return { outcome: null, error: err(r) };
    if (o.value.cappedAtMax) notes.push("Limitada pela dose máxima informada.");
    return { outcome: { value: o.value.totalDoseMg, unit: "mg", decimals: o.value.totalDoseMg % 1 ? 1 : 0, title: "Dose total", formula: o.formula, notes }, error: null };
  }, [mode, weight, height, age, creat, sex, dosePerKg, dosePerM2, maxMg, formula]);

  const { outcome, error } = computed;
  const fillExample = () => {
    if (mode === "peso") { setWeight("70"); setDosePerKg("5"); }
    else if (mode === "sc") { setWeight("70"); setHeight("170"); setDosePerM2("100"); }
    else if (mode === "renal") { setAge("60"); setWeight("70"); setCreat("1,0"); setSex("M"); }
    else { setAge("6"); setWeight(""); setDosePerKg("10"); }
  };
  const showSim = outcome && outcome.unit === "mg";
  const modeInfo = MODES.find((m) => m.id === mode)!;

  const pin = () => {
    if (!outcome) return;
    setPinned((p) => [...p.slice(-3), { id: Date.now(), label: modeInfo.label, value: outcome.value, unit: outcome.unit, decimals: outcome.decimals }]);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* entrada */}
      <Reveal className="space-y-4">
        <RevealItem>
          <div role="tablist" aria-label="Tipo de cálculo" className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition",
                  mode === m.id ? "border-[hsl(var(--dom-clinica))] bg-[hsl(var(--dom-clinica)/0.12)]" : "border-border bg-card hover:border-[hsl(var(--dom-clinica)/0.5)]"
                )}
              >
                <span className="block text-sm font-semibold text-foreground">{m.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.hint}</span>
              </button>
            ))}
          </div>
        </RevealItem>

        <RevealItem className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-5 [&>*:last-child:nth-child(odd)]:col-span-2">
          {(mode === "peso" || mode === "sc" || mode === "renal" || mode === "ped") && (
            <Field label={mode === "ped" ? "Peso real (deixe vazio para estimar pela idade)" : "Peso"} unit="kg" value={weight} onChange={setWeight} placeholder="70" optional={mode === "ped"} />
          )}
          {mode === "sc" && <Field label="Altura" unit="cm" value={height} onChange={setHeight} placeholder="170" />}
          {(mode === "renal" || mode === "ped") && <Field label="Idade" unit="anos" value={age} onChange={setAge} placeholder={mode === "ped" ? "6" : "60"} optional={mode === "ped"} />}
          {mode === "renal" && (
            <>
              <div className="col-span-2">
                <span className="mb-1 block text-[11px] text-muted-foreground">Sexo</span>
                <div className="grid grid-cols-2 gap-2">
                  {([["M", "Masculino"], ["F", "Feminino"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setSex(v)} aria-pressed={sex === v} className={cn("rounded-xl border px-3 py-2 text-sm transition", sex === v ? "border-[hsl(var(--dom-clinica))] bg-[hsl(var(--dom-clinica)/0.12)] text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
                  ))}
                </div>
              </div>
              <Field label="Creatinina sérica" unit="mg/dL" value={creat} onChange={setCreat} placeholder="1,0" />
            </>
          )}
          {mode === "sc" && (
            <div className="col-span-2">
              <span className="mb-1 block text-[11px] text-muted-foreground">Fórmula</span>
              <div className="grid grid-cols-2 gap-2">
                {([["mosteller", "Mosteller"], ["dubois", "Du Bois"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setFormula(v)} aria-pressed={formula === v} className={cn("rounded-xl border px-3 py-2 text-sm transition", formula === v ? "border-[hsl(var(--dom-clinica))] bg-[hsl(var(--dom-clinica)/0.12)] text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {(mode === "peso" || mode === "ped") && <Field label="Dose" unit="mg/kg" value={dosePerKg} onChange={setDosePerKg} placeholder="10" />}
          {mode === "sc" && <Field label="Dose" unit="mg/m²" value={dosePerM2} onChange={setDosePerM2} placeholder="175" optional />}
          {mode !== "renal" && <Field label="Dose máxima" unit="mg" value={maxDose} onChange={setMaxDose} placeholder="500" optional />}
        </RevealItem>

        <RevealItem>
          <p className="px-1 text-[11px] text-muted-foreground">Cálculo de apoio. Confirme sempre com a bula e o julgamento clínico. Funciona sem conexão.</p>
        </RevealItem>
      </Reveal>

      {/* resultado */}
      <div className="min-w-0 space-y-5">
        <div className="pos-elev relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[hsl(var(--dom-clinica)/0.12)] via-card to-card p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--dom-clinica))]">{outcome ? outcome.title : modeInfo.label}</p>
            {outcome && (
              <button onClick={pin} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-[hsl(var(--dom-clinica))] hover:text-foreground">
                <Pin className="h-3 w-3" /> Fixar para comparar
              </button>
            )}
          </div>

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] p-3 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" /> {error}
            </div>
          ) : outcome ? (
            <>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="bg-gradient-to-r from-[#2DD4BF] to-[#38BDF8] bg-clip-text font-display text-6xl font-extrabold tracking-tight text-transparent md:text-7xl">
                  <CountUp value={outcome.value} decimals={outcome.decimals} duration={0.9} />
                </span>
                <span className="font-mono text-xl text-muted-foreground">{outcome.unit}</span>
              </div>
              <p className="mt-3 font-mono text-xs text-muted-foreground">{outcome.formula}</p>
              {outcome.notes.map((n) => (
                <p key={n} className="mt-2 text-sm text-foreground/85">{n}</p>
              ))}
              {mode === "renal" && <RenalScale value={outcome.value} />}
            </>
          ) : (
            <div className="mt-4 flex flex-col gap-5 lg:min-h-[240px]">
              <div>
                <p className="font-display text-3xl font-bold text-foreground/70 md:text-4xl">Preencha os campos ao lado</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">O resultado aparece aqui na hora, sem botão de calcular.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={fillExample} className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--dom-clinica)/0.5)] bg-[hsl(var(--dom-clinica)/0.1)] px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-[hsl(var(--dom-clinica)/0.18)]">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--dom-clinica))]" /> Preencher com um exemplo
                </button>
                <span className="font-mono text-[11px] text-muted-foreground">{EXAMPLE_HINT[mode]}</span>
              </div>
              <PkCurve className="pointer-events-none mt-auto w-full opacity-30" height={80} />
            </div>
          )}
        </div>

        {pinned.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Comparar cenários</div>
            <ul className="flex flex-wrap gap-2">
              {pinned.map((p) => {
                const diff = outcome && outcome.unit === p.unit ? outcome.value - p.value : null;
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/50 py-1.5 pl-3 pr-1.5 text-sm">
                    <span className="text-muted-foreground">{p.label}</span>
                    <b className="font-mono text-foreground">{p.value.toLocaleString("pt-BR", { maximumFractionDigits: p.decimals })} {p.unit}</b>
                    {diff !== null && Math.abs(diff) > 1e-9 && (
                      <span className={cn("font-mono text-xs", diff > 0 ? "text-[hsl(var(--dom-ensino))]" : "text-[hsl(var(--dom-clinica))]")}>
                        agora {diff > 0 ? "+" : "−"}{Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: p.decimals })}
                      </span>
                    )}
                    <button onClick={() => setPinned((l) => l.filter((x) => x.id !== p.id))} aria-label="Remover cenário" className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3 w-3" /></button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {showSim && <AccumulationLab />}
      </div>
    </div>
  );
}

