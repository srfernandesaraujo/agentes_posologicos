import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DomainEyebrow } from "@/components/ds/DomainEyebrow";
import { CountUp } from "@/components/ds/CountUp";
import { PulseAvatar } from "@/components/ds/PulseAvatar";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { Spotlight } from "@/components/ds/Spotlight";
import type { Squad, SquadTemplateInfo } from "@/hooks/useSquads";
import type { TeamPulse } from "@/hooks/useTeamPulse";
import type { SquadOverview } from "@/hooks/useSquadsOverview";
import { fmtUsd } from "@/components/squads/CostCapField";

interface Props {
  squads: Squad[];
  templates: Map<string, SquadTemplateInfo>;
  pulse?: TeamPulse;
  overview?: SquadOverview;
  onOpen: (id: string) => void;
  onNew: () => void;
}

/** O escritório: cada squad com sua equipe à vista, estado real (trabalhando, esperando você) e o que gastou no mês. */
export function SquadsOfficeV2({ squads, templates, pulse, overview, onOpen, onNew }: Props) {
  const running = pulse?.missions.filter((m) => m.status === "running").length ?? 0;
  const waiting = (pulse?.actions.length ?? 0) + (pulse?.questions.length ?? 0) + (pulse?.missions.filter((m) => m.status === "awaiting_approval").length ?? 0);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <DomainEyebrow domain="equipes" section="Squads" />
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">Seu escritório de agentes</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Equipes de IA com funções fixas. Você descreve a missão, acompanha as entregas e aprova ou pede ajustes. Cada squad é visível só para você.</p>
        </div>
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#A78BFA] to-[#38BDF8] px-4 py-2.5 text-sm font-semibold text-[hsl(208_46%_6%)] transition hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo squad
        </button>
      </div>

      <Reveal stagger={0.06}>
        <RevealItem>
          <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { n: squads.length, l: "squads", tone: "" },
              { n: running, l: "trabalhando agora", tone: running > 0 ? "text-[hsl(var(--dom-acervo))]" : "" },
              { n: waiting, l: "esperando você", tone: waiting > 0 ? "text-[hsl(var(--warning))]" : "" },
              { n: overview?.totalCostMonth ?? 0, l: "gasto de IA no mês", tone: "", usd: true },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border bg-card p-4">
                <dd className={`font-display text-3xl font-extrabold text-foreground ${s.tone}`}>
                  {s.usd ? <CountUp value={s.n} decimals={2} prefix="US$ " /> : <CountUp value={s.n} />}
                </dd>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{s.l}</dt>
              </div>
            ))}
          </dl>
        </RevealItem>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {squads.map((s) => {
            const t = templates.get(s.template_slug);
            const r = pulse?.missions.filter((m) => m.squad_id === s.id && m.status === "running").length ?? 0;
            const w = (pulse?.actions.filter((a) => a.squad_id === s.id).length ?? 0) + (pulse?.questions.filter((q) => q.squad_id === s.id).length ?? 0);
            const team = t?.agents ?? [];
            const last = overview?.lastMission[s.id];
            return (
              <RevealItem key={s.id}>
                <Spotlight tone="var(--dom-equipes)" className="group h-full rounded-2xl border border-border bg-gradient-to-br from-[hsl(var(--dom-equipes)/0.10)] to-card transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <button type="button" onClick={() => onOpen(s.id)} className="flex h-full w-full flex-col gap-4 p-5 text-left">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-display text-lg font-bold text-foreground">{s.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{s.kind === "continuous" ? "Contínuo, com agendamento" : "Por missão"}{t ? ` · ${team.length} agentes` : ""}</span>
                      </span>
                      {r > 0 ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[hsl(var(--success)/0.4)] px-2.5 py-0.5 text-xs text-[hsl(var(--success))]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />Trabalhando</span>
                      ) : w > 0 ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[hsl(var(--warning)/0.45)] px-2.5 py-0.5 text-xs text-[hsl(var(--warning))]"><span className="h-1.5 w-1.5 rounded-full bg-current" />{w} esperando você</span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">Ocioso</span>
                      )}
                    </span>

                    <span className="flex items-center">
                      {team.slice(0, 6).map((a, i) => (
                        <span key={a.slug} title={`${a.name}: ${a.role}`} className="-ml-2 first:ml-0" style={{ zIndex: 10 - i }}>
                          <PulseAvatar name={a.name} state={r > 0 ? "working" : "idle"} size={38} className="border-2 border-card" />
                        </span>
                      ))}
                    </span>

                    <span className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 font-mono text-[11px]">
                      <span><b className="block text-sm text-foreground">{overview?.missionsMonth[s.id] ?? 0}</b><span className="text-muted-foreground">missões no mês</span></span>
                      <span><b className="block text-sm text-foreground">{fmtUsd(overview?.costMonth[s.id] ?? 0)}</b><span className="text-muted-foreground">gasto no mês</span></span>
                      <span><b className="block truncate text-sm text-foreground">{last ? formatDistanceToNow(new Date(last), { locale: ptBR }) : "nunca"}</b><span className="text-muted-foreground">última missão</span></span>
                    </span>
                  </button>
                </Spotlight>
              </RevealItem>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
