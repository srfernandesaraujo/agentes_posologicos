import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useNewUI } from "@/contexts/NewUIContext";
import { DomainEyebrow } from "@/components/ds/DomainEyebrow";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { Spotlight } from "@/components/ds/Spotlight";
import { Gauge } from "@/components/ds/Gauge";
import { AreaTrend } from "@/components/ds/AreaTrend";
import { PulseAvatar } from "@/components/ds/PulseAvatar";
import { PkCurve } from "@/components/ds/PkCurve";
import { Button } from "@/components/ui/button";

/** Laboratório visual: mostra as peças do novo sistema de movimento em um só lugar, para testar no navegador. */
export default function VisualLab() {
  const { theme, setTheme } = useNewUI();
  const [round, setRound] = useState(0);
  const week = [12, 18, 15, 26, 22, 31, 29, 38, 35, 44];

  return (
    <div className="container max-w-5xl space-y-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <DomainEyebrow domain="ajuda" section="Laboratório visual" />
          <h1 className="font-display text-3xl font-bold text-foreground">Peças do novo visual</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Cada bloco abaixo é uma peça reutilizável que as próximas ondas vão usar nas telas. Use o botão para ver tudo de novo desde o início.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRound((r) => r + 1)}>Reproduzir de novo</Button>
          <Button variant="outline" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Alternar tema">
            {theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
            {theme === "light" ? "Escuro" : "Claro"}
          </Button>
        </div>
      </div>

      <div key={round} className="space-y-8">
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Números que contam e medidores</h2>
          <Reveal className="grid gap-4 sm:grid-cols-3">
            <RevealItem className="rounded-2xl border border-border bg-card p-5">
              <div className="font-display text-4xl font-extrabold text-foreground"><CountUp value={1247} /></div>
              <p className="mt-1 text-xs text-muted-foreground">conversas este mês</p>
            </RevealItem>
            <RevealItem className="rounded-2xl border border-border bg-card p-5">
              <div className="font-display text-4xl font-extrabold text-foreground"><CountUp value={4.12} decimals={2} prefix="US$ " /></div>
              <p className="mt-1 text-xs text-muted-foreground">custo do mês</p>
            </RevealItem>
            <RevealItem className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <Gauge value={0.86} color="hsl(var(--dom-clinica))">
                <span className="font-display text-xl font-bold text-foreground"><CountUp value={86} suffix="%" /></span>
              </Gauge>
              <p className="text-xs text-muted-foreground">das doses calculadas dentro da janela terapêutica</p>
            </RevealItem>
          </Reveal>
        </section>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Tendência e curva</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-2 text-sm font-medium text-foreground">Uso nas últimas 10 semanas</p>
              <AreaTrend values={week} color="hsl(var(--dom-equipes))" className="w-full" label="Uso semanal" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-2 text-sm font-medium text-foreground">Concentração prevista</p>
              <PkCurve draw height={96} className="w-full" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Luz que segue o cursor</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Clínica", "Calculadora de dose", "--dom-clinica"],
              ["Equipes", "Reunião Viva", "--dom-equipes"],
              ["Ensino", "Aula ao vivo", "--dom-ensino"],
            ].map(([d, t, tone]) => (
              <Spotlight key={t} tone={`var(${tone})`} className="rounded-2xl border border-border bg-card p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: `hsl(var(${tone}))` }}>{d}</p>
                <p className="mt-2 font-display text-lg font-bold text-foreground">{t}</p>
                <p className="mt-1 text-xs text-muted-foreground">passe o mouse aqui</p>
              </Spotlight>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Presença dos agentes</h2>
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-card p-5">
            {([
              ["Analista", "working"],
              ["Redator", "working"],
              ["Cardiologista", "waiting"],
              ["Revisor", "done"],
              ["Curador", "idle"],
            ] as const).map(([n, s]) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <PulseAvatar name={n} state={s} size={44} />
                <span className="text-xs text-muted-foreground">{{ working: "trabalhando", waiting: "espera você", done: "concluiu", idle: "parado" }[s]}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Carregando</h2>
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5">
            <div className="pos-shimmer h-5 w-1/3" />
            <div className="pos-shimmer h-4 w-full" />
            <div className="pos-shimmer h-4 w-4/5" />
          </div>
        </section>
      </div>
    </div>
  );
}
