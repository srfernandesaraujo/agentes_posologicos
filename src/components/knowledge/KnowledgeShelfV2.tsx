import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Globe, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainEyebrow } from "@/components/ds/DomainEyebrow";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { Spotlight } from "@/components/ds/Spotlight";
import type { KnowledgeBase } from "@/hooks/useKnowledgeBases";

interface Src { knowledge_base_id: string; type: string; status: string }

const TYPE_LABEL: Record<string, string> = { text: "texto", file: "arquivo", url: "link", pdf: "PDF", website: "site", youtube: "vídeo", doc: "documento" };
const TYPE_TONE = ["var(--dom-acervo)", "var(--dom-clinica)", "var(--dom-equipes)", "var(--dom-ensino)", "var(--dom-ajuda)"];

interface Props {
  bases: KnowledgeBase[];
  onNew: () => void;
  onOpen: (id: string) => void;
  renderMenu: (kb: KnowledgeBase) => ReactNode;
}

/** Biblioteca do novo visual: cada conteúdo mostra quantas fontes tem, de que tipos e se algo ainda está processando. */
export function KnowledgeShelfV2({ bases, onNew, onOpen, renderMenu }: Props) {
  const { user } = useAuth();
  const { data: sources = [] } = useQuery({
    queryKey: ["knowledge-sources-overview", user?.id],
    enabled: !!user && bases.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("knowledge_sources" as any).select("knowledge_base_id, type, status").eq("user_id", user!.id).limit(5000);
      return (data || []) as unknown as Src[];
    },
  });

  const by = useMemo(() => {
    const m = new Map<string, Src[]>();
    sources.forEach((s) => m.set(s.knowledge_base_id, [...(m.get(s.knowledge_base_id) || []), s]));
    return m;
  }, [sources]);
  const types = useMemo(() => [...new Set(sources.map((s) => s.type))], [sources]);
  const toneOf = (t: string) => TYPE_TONE[Math.max(0, types.indexOf(t)) % TYPE_TONE.length];
  const pubs = bases.filter((b) => b.is_public).length;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <DomainEyebrow domain="acervo" section="Conteúdos" />
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">Sua biblioteca</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize o que seus agentes consultam: textos, arquivos e links.</p>
        <dl className="mt-5 grid max-w-xl grid-cols-3 gap-3">
          {[{ n: bases.length, l: "conteúdos" }, { n: sources.length, l: "fontes" }, { n: pubs, l: "públicos" }].map((s) => (
            <div key={s.l} className="rounded-2xl border border-border bg-card p-4">
              <dd className="font-display text-3xl font-extrabold text-foreground"><CountUp value={s.n} /></dd>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{s.l}</dt>
            </div>
          ))}
        </dl>
      </div>

      <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
        <RevealItem>
          <Spotlight tone="var(--dom-acervo)" className="h-full rounded-2xl border border-dashed border-[hsl(var(--dom-acervo)/0.5)] bg-[hsl(var(--dom-acervo)/0.05)]">
            <button onClick={onNew} className="flex h-full min-h-[168px] w-full flex-col items-start justify-between p-5 text-left">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--dom-acervo)/0.18)] text-[hsl(var(--dom-acervo))]"><Plus className="h-5 w-5" /></span>
              <span className="font-display text-base font-bold text-foreground">Novo conteúdo</span>
            </button>
          </Spotlight>
        </RevealItem>

        {bases.map((kb) => {
          const list = by.get(kb.id) || [];
          const counts = new Map<string, number>();
          list.forEach((s) => counts.set(s.type, (counts.get(s.type) || 0) + 1));
          const busy = list.filter((s) => /pend|process|queue/i.test(s.status)).length;
          const failed = list.filter((s) => /err|fail/i.test(s.status)).length;
          return (
            <RevealItem key={kb.id}>
              <Spotlight tone="var(--dom-acervo)" className="group relative h-full rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{renderMenu(kb)}</div>
                <button onClick={() => onOpen(kb.id)} className="flex h-full min-h-[168px] w-full flex-col p-5 text-left">
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--dom-acervo)/0.16)] text-[hsl(var(--dom-acervo))] transition duration-300 group-hover:scale-110"><Database className="h-5 w-5" /></span>
                    <span className="min-w-0 truncate font-display text-base font-bold text-foreground">{kb.name}</span>
                    {kb.is_public && <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Público" />}
                  </span>
                  <span className="mt-2 line-clamp-2 min-h-[2.6em] text-[13px] leading-snug text-muted-foreground">{kb.description || "Sem descrição"}</span>

                  <span className="mt-auto block pt-3">
                    {list.length > 0 ? (
                      <>
                        <span className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          {[...counts.entries()].map(([t, n]) => <i key={t} className="block h-full" style={{ width: `${(n / list.length) * 100}%`, background: `hsl(${toneOf(t)})` }} />)}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-muted-foreground">
                          <b className="text-foreground">{list.length} {list.length === 1 ? "fonte" : "fontes"}</b>
                          {[...counts.entries()].map(([t, n]) => <span key={t} className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${toneOf(t)})` }} />{n} {TYPE_LABEL[t] ?? t}</span>)}
                          {busy > 0 && <span className="text-[hsl(var(--warning))]">{busy} processando</span>}
                          {failed > 0 && <span className="text-[hsl(var(--destructive-vivid))]">{failed} com erro</span>}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">nenhuma fonte ainda · {new Date(kb.created_at).toLocaleDateString("pt-BR")}</span>
                    )}
                  </span>
                </button>
              </Spotlight>
            </RevealItem>
          );
        })}
      </Reveal>
    </div>
  );
}
