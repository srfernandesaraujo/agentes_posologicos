import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Archive, Bot, Coins, Plus } from "lucide-react";
import { DomainEyebrow } from "@/components/ds/DomainEyebrow";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { Spotlight } from "@/components/ds/Spotlight";
import type { CustomAgent } from "@/hooks/useCustomAgents";

interface Props {
  agents: CustomAgent[];
  creationCost: number;
  onCreate: () => void;
  onBackup: () => void;
  onOpen: (id: string) => void;
}

/** Estúdio de agentes: resumo no topo, criação em destaque e cartões com status, modelo e última edição. */
export function MyAgentsStudioV2({ agents, creationCost, onCreate, onBackup, onOpen }: Props) {
  const published = agents.filter((a) => a.status === "published").length;
  const drafts = agents.length - published;

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <DomainEyebrow domain="clinica" section="Meus agentes" />
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">Seu estúdio de agentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie, ajuste e publique agentes que trabalham do seu jeito.</p>
        </div>
        <button onClick={onBackup} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground transition hover:border-[hsl(var(--dom-clinica))]">
          <Archive className="h-4 w-4" /> Backup
        </button>
      </div>

      <Reveal stagger={0.06}>
        <RevealItem>
          <dl className="mb-6 grid grid-cols-3 gap-3">
            {[
              { n: agents.length, l: "agentes" },
              { n: published, l: "publicados" },
              { n: drafts, l: "rascunhos" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border bg-card p-4">
                <dd className="font-display text-3xl font-extrabold text-foreground"><CountUp value={s.n} /></dd>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{s.l}</dt>
              </div>
            ))}
          </dl>
        </RevealItem>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RevealItem>
            <Spotlight tone="var(--dom-clinica)" className="h-full rounded-2xl border border-dashed border-[hsl(var(--dom-clinica)/0.5)] bg-[hsl(var(--dom-clinica)/0.05)]">
              <button onClick={onCreate} className="flex h-full min-h-[148px] w-full flex-col items-start justify-between p-5 text-left">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--dom-clinica)/0.18)] text-[hsl(var(--dom-clinica))]"><Plus className="h-5 w-5" /></span>
                <span>
                  <span className="block font-display text-base font-bold text-foreground">Novo agente</span>
                  <span className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground"><Coins className="h-3 w-3" /> {creationCost} créditos</span>
                </span>
              </button>
            </Spotlight>
          </RevealItem>

          {agents.map((a) => (
            <RevealItem key={a.id}>
              <Spotlight tone="var(--dom-clinica)" className="group h-full rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <button onClick={() => onOpen(a.id)} className="flex h-full min-h-[148px] w-full flex-col p-5 text-left">
                  <span className="flex items-start justify-between gap-2">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--dom-clinica)/0.16)] text-[hsl(var(--dom-clinica))] transition duration-300 group-hover:scale-110"><Bot className="h-5 w-5" /></span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                      <i className="h-1.5 w-1.5 rounded-full" style={{ background: a.status === "published" ? "hsl(var(--dom-acervo))" : "hsl(var(--muted-foreground))" }} />
                      {a.status === "published" ? "publicado" : "rascunho"}
                    </span>
                  </span>
                  <span className="mt-3 block truncate font-display text-base font-bold text-foreground">{a.name}</span>
                  <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{a.description || "Sem descrição"}</span>
                  <span className="mt-auto flex items-center justify-between pt-3 font-mono text-[10.5px] text-muted-foreground">
                    <span className="truncate">{a.model}</span>
                    <span className="shrink-0">editado {formatDistanceToNow(new Date(a.updated_at || a.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </span>
                </button>
              </Spotlight>
            </RevealItem>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
