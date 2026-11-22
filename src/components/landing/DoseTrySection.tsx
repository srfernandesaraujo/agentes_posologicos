import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";
import { PkCurve } from "@/components/ds/PkCurve";
import type { LandingLocale } from "./landingCopy";
import { Reveal } from "./Reveal";

const COPY = {
  pt: {
    kicker: "Experimente agora, sem cadastro",
    title: "Uma dose pediátrica em segundos",
    sub: "Ajuste peso, dose por quilo e intervalo. A curva mostra como o fármaco se acumula entre as doses.",
    weight: "Peso (kg)",
    perKg: "Dose (mg/kg/dose)",
    every: "Intervalo (h)",
    max: "Dose máxima por tomada (mg)",
    result: "Dose por tomada",
    daily: "Total por dia",
    capped: "Limitada pela dose máxima",
    note: "Demonstração educativa. Confira sempre a bula e o protocolo local antes de prescrever.",
    cta: "Criar conta e usar a calculadora completa",
  },
  en: {
    kicker: "Try it now, no sign-up",
    title: "A pediatric dose in seconds",
    sub: "Adjust weight, dose per kilo and interval. The curve shows how the drug builds up between doses.",
    weight: "Weight (kg)",
    perKg: "Dose (mg/kg/dose)",
    every: "Interval (h)",
    max: "Max dose per intake (mg)",
    result: "Dose per intake",
    daily: "Total per day",
    capped: "Limited by the maximum dose",
    note: "Educational demo. Always check the label and local protocol before prescribing.",
    cta: "Sign up and use the full calculator",
  },
  es: {
    kicker: "Pruébalo ahora, sin registro",
    title: "Una dosis pediátrica en segundos",
    sub: "Ajusta peso, dosis por kilo e intervalo. La curva muestra cómo se acumula el fármaco entre dosis.",
    weight: "Peso (kg)",
    perKg: "Dosis (mg/kg/dosis)",
    every: "Intervalo (h)",
    max: "Dosis máxima por toma (mg)",
    result: "Dosis por toma",
    daily: "Total por día",
    capped: "Limitada por la dosis máxima",
    note: "Demostración educativa. Revisa siempre el prospecto y el protocolo local antes de prescribir.",
    cta: "Crear cuenta y usar la calculadora completa",
  },
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

export function DoseTrySection({ locale }: { locale: LandingLocale }) {
  const t = COPY[locale];
  const [weight, setWeight] = useState(18);
  const [perKg, setPerKg] = useState(15);
  const [every, setEvery] = useState(6);
  const [max, setMax] = useState(500);

  const calc = useMemo(() => {
    const raw = weight * perKg;
    const dose = Math.min(raw, max);
    const perDay = dose * (24 / every);
    return { dose, perDay, capped: raw > max };
  }, [weight, perKg, every, max]);

  const handleSpot = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const field = (label: string, value: number, set: (n: number) => void, min: number, maxV: number, step: number) => (
    <label className="lp-dose-field">
      <span>{label}</span>
      <div className="lp-dose-inputs">
        <input type="range" min={min} max={maxV} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
        <input
          type="number"
          min={min}
          max={maxV}
          step={step}
          value={value}
          onChange={(e) => set(clamp(Number(e.target.value), min, maxV))}
        />
      </div>
    </label>
  );

  return (
    <section className="lp-section lp-dose-section" id="calculadora">
      <Reveal>
        <div className="lp-section-head">
          <div>
            <p className="lp-kicker">{t.kicker}</p>
            <h2 className="lp-section-title">{t.title}</h2>
          </div>
          <p className="lp-section-sub">{t.sub}</p>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="lp-dose-card" onMouseMove={handleSpot}>
          <div className="lp-dose-form">
            {field(t.weight, weight, setWeight, 3, 90, 0.5)}
            {field(t.perKg, perKg, setPerKg, 1, 60, 1)}
            {field(t.every, every, setEvery, 4, 24, 1)}
            {field(t.max, max, setMax, 50, 2000, 50)}
          </div>

          <div className="lp-dose-out">
            <div className="lp-dose-kpis">
              <div>
                <small>{t.result}</small>
                <strong>
                  {fmt(calc.dose)} <em>mg</em>
                </strong>
                {calc.capped && <span className="lp-dose-cap">{t.capped}</span>}
              </div>
              <div>
                <small>{t.daily}</small>
                <strong>
                  {fmt(calc.perDay)} <em>mg</em>
                </strong>
              </div>
            </div>
            <PkCurve tau={every} doses={Math.max(3, Math.min(7, Math.round(30 / every)))} height={130} className="lp-dose-curve" />
            <p className="lp-dose-note">
              <Calculator size={13} aria-hidden="true" /> {t.note}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="lp-dose-cta">
          <Link className="lp-btn lp-btn-primary" to="/signup">
            <span>{t.cta}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
