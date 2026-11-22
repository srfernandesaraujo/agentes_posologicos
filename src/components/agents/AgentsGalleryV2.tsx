import { useEffect, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Coins, Search, Settings2, ShoppingBag, Sparkles, X } from "lucide-react";
import { DomainEyebrow } from "@/components/ds/DomainEyebrow";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { Spotlight } from "@/components/ds/Spotlight";
import { getIcon } from "@/lib/icons";
import { CATEGORIES, type Agent } from "@/hooks/useAgents";
import { cn } from "@/lib/utils";

const CAT_VAR: Record<string, string> = {
  "Prática Clínica e Farmácia": "clinica",
  "EdTech e Professores 4.0": "edtech",
  "Pesquisa Acadêmica e Dados": "pesquisa",
  "Produção de Conteúdo e Nicho Tech": "conteudo",
};
const CAT_SHORT: Record<string, string> = {
  "Prática Clínica e Farmácia": "Clínica e Farmácia",
  "EdTech e Professores 4.0": "Ensino",
  "Pesquisa Acadêmica e Dados": "Pesquisa",
  "Produção de Conteúdo e Nicho Tech": "Conteúdo",
};

interface MiniAgent { id: string; name: string; description?: string | null }

interface Props {
  agentsByCategory: Record<string, Agent[]>;
  newestAgents: Agent[];
  publishedCustom: MiniAgent[];
  purchasedAgents: MiniAgent[];
  search: string;
  setSearch: (v: string) => void;
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  totalAll: number;
  isAdmin: boolean;
}

function AgentCard({ agent, isAdmin, featured }: { agent: Agent; isAdmin: boolean; featured?: boolean }) {
  const navigate = useNavigate();
  const Icon = getIcon(agent.icon);
  const v = CAT_VAR[agent.category] || "clinica";
  const go = () => navigate(`/chat/${agent.id}`);
  return (
    <Spotlight
      tone={`var(--cat-${v})`}
      role="link"
      tabIndex={0}
      aria-label={`Conversar com ${agent.name}`}
      onClick={go}
      onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") go(); }}
      className={cn(
        "group cursor-pointer rounded-2xl border border-border bg-card p-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl",
        featured && "w-[270px] shrink-0 sm:w-[300px]"
      )}
      style={{ borderColor: featured ? `hsl(var(--cat-${v}) / 0.4)` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-11 w-11 place-items-center rounded-xl transition duration-300 group-hover:scale-110" style={{ background: `hsl(var(--cat-${v}) / 0.16)`, color: `hsl(var(--cat-${v}))`, boxShadow: `0 0 0 1px hsl(var(--cat-${v}) / 0.25)` }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex items-center gap-1.5">
          {featured && <span className="rounded-full bg-[hsl(var(--dom-inicio))] px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-[hsl(208_46%_6%)]">novo</span>}
          <span className="pos-cost inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"><Coins className="h-3 w-3" />{agent.credit_cost}</span>
        </span>
      </div>
      <h3 className="mt-3 flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
        <span className="truncate">{agent.name}</span>
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/agente/${agent.id}`); }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Editar agente (Admin)"
            aria-label="Editar agente (Admin)"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </h3>
      <p className="mt-1 line-clamp-2 min-h-[2.6em] text-[13px] leading-snug text-muted-foreground" title={agent.description}>{agent.description}</p>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px]" style={{ color: `hsl(var(--cat-${v}))` }}>
        <span className="uppercase tracking-[0.12em]">{CAT_SHORT[agent.category] ?? agent.category}</span>
        <span className="inline-flex items-center gap-1 opacity-0 transition duration-300 group-hover:opacity-100">conversar <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
      </div>
    </Spotlight>
  );
}

function MyAgentCard({ agent, kind }: { agent: MiniAgent; kind: "own" | "bought" }) {
  const navigate = useNavigate();
  const tone = kind === "own" ? "var(--dom-clinica)" : "var(--dom-acervo)";
  const go = () => navigate(`/chat/custom-${agent.id}`);
  return (
    <Spotlight tone={tone} role="link" tabIndex={0} onClick={go} onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") go(); }}
      className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition duration-300 hover:-translate-y-0.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `hsl(${tone} / 0.16)`, color: `hsl(${tone})` }}>
        {kind === "own" ? <Bot className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-bold text-foreground">{agent.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{agent.description || "Sem descrição"}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Spotlight>
  );
}

function SectionTitle({ color, children, count }: { color: string; children: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="h-5 w-1 rounded-full" style={{ background: color }} />
      <h2 className="font-display text-lg font-bold text-foreground">{children}</h2>
      <span className="font-mono text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

/** Catálogo de agentes do novo visual: busca grande, categorias com contagem, cartões com luz e descrição que se abre ao pairar. */
export function AgentsGalleryV2({ agentsByCategory, newestAgents, publishedCustom, purchasedAgents, search, setSearch, activeCategory, setActiveCategory, totalAll, isAdmin }: Props) {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const hasMine = publishedCustom.length + purchasedAgents.length > 0;
  const cats = CATEGORIES.filter((c) => agentsByCategory[c]);
  const shownCats = activeCategory && activeCategory !== "__my__" ? cats.filter((c) => c === activeCategory) : cats;

  // "/" leva o cursor para a busca
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && t && !["INPUT", "TEXTAREA"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chip = (active: boolean, color: string) =>
    cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition", active ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground");
  const chipStyle = (active: boolean, color: string) => (active ? { borderColor: color, background: `color-mix(in srgb, ${color} 14%, transparent)` } : undefined);

  return (
    <div className="container max-w-7xl py-6">
      <div className="mb-6">
        <DomainEyebrow domain="clinica" section="Agentes" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
              <CountUp value={totalAll} /> agentes<span className="text-muted-foreground"> prontos para trabalhar</span>
            </h1>
          </div>
          <div className="relative w-full md:w-[380px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agente por nome ou assunto"
              aria-label="Buscar agente"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-16 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[hsl(var(--dom-clinica))] focus:shadow-[0_0_0_4px_hsl(var(--dom-clinica)/0.15)]"
            />
            {search ? (
              <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">/</kbd>
            )}
          </div>
        </div>
      </div>

      {/* categorias */}
      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide" role="group" aria-label="Filtrar por categoria">
        <button onClick={() => setActiveCategory(null)} aria-pressed={activeCategory === null} className={chip(activeCategory === null, "")} style={chipStyle(activeCategory === null, "hsl(var(--dom-clinica))")}>
          Todos <span className="font-mono text-xs opacity-70">{totalAll}</span>
        </button>
        {hasMine && (
          <button onClick={() => setActiveCategory(activeCategory === "__my__" ? null : "__my__")} aria-pressed={activeCategory === "__my__"} className={chip(activeCategory === "__my__", "")} style={chipStyle(activeCategory === "__my__", "hsl(var(--dom-clinica))")}>
            <Sparkles className="h-3.5 w-3.5" /> Meus <span className="font-mono text-xs opacity-70">{publishedCustom.length + purchasedAgents.length}</span>
          </button>
        )}
        {CATEGORIES.map((c) => {
          const n = agentsByCategory[c]?.length || 0;
          const color = `hsl(var(--cat-${CAT_VAR[c]}))`;
          const active = activeCategory === c;
          if (n === 0 && search) return null;
          return (
            <button key={c} onClick={() => setActiveCategory(active ? null : c)} aria-pressed={active} className={chip(active, color)} style={chipStyle(active, color)}>
              <i className="h-2 w-2 rounded-full" style={{ background: color }} />
              {CAT_SHORT[c]} <span className="font-mono text-xs opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <Reveal key={`${activeCategory ?? "todos"}`} stagger={0.05}>
        {/* orquestrador */}
        {activeCategory === null && !search && (
          <RevealItem>
            <button
              onClick={() => navigate("/orquestrador")}
              className="group relative mb-8 w-full overflow-hidden rounded-2xl border border-[hsl(var(--dom-equipes)/0.4)] bg-gradient-to-r from-[hsl(var(--dom-equipes)/0.16)] via-card to-[hsl(var(--dom-clinica)/0.12)] p-5 text-left transition hover:border-[hsl(var(--dom-equipes))]"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[hsl(var(--dom-equipes))] to-[hsl(var(--dom-clinica))] text-[hsl(208_46%_6%)]"><Sparkles className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-foreground">Agente Orquestrador</span>
                    <span className="rounded-full bg-[hsl(var(--dom-equipes)/0.2)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--dom-equipes))]">novo</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">Diga um objetivo. Vários especialistas trabalham juntos e entregam um dossiê consolidado. 12 créditos.</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
              </div>
            </button>
          </RevealItem>
        )}

        {/* novidades */}
        {newestAgents.length > 0 && activeCategory === null && !search && (
          <RevealItem className="mb-8">
            <SectionTitle color="hsl(var(--dom-inicio))" count={newestAgents.length}>Acabaram de chegar</SectionTitle>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 pt-1 scrollbar-hide">
              {newestAgents.map((a) => <AgentCard key={a.id} agent={a} isAdmin={isAdmin} featured />)}
            </div>
          </RevealItem>
        )}

        {/* meus */}
        {hasMine && (activeCategory === null || activeCategory === "__my__") && (
          <RevealItem className="mb-8">
            <SectionTitle color="hsl(var(--dom-clinica))" count={publishedCustom.length + purchasedAgents.length}>Meus agentes</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publishedCustom.map((a) => <MyAgentCard key={a.id} agent={a} kind="own" />)}
              {purchasedAgents.map((a) => <MyAgentCard key={a.id} agent={a} kind="bought" />)}
            </div>
          </RevealItem>
        )}

        {/* por categoria */}
        {activeCategory !== "__my__" && shownCats.map((c) => (
          <RevealItem key={c} className="mb-8">
            <SectionTitle color={`hsl(var(--cat-${CAT_VAR[c]}))`} count={agentsByCategory[c].length}>{c}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agentsByCategory[c].map((a) => <AgentCard key={a.id} agent={a} isAdmin={isAdmin} />)}
            </div>
          </RevealItem>
        ))}
      </Reveal>

      {totalAll === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bot className="mb-4 h-12 w-12" />
          <p>Nenhum agente encontrado para essa busca.</p>
          {search && <button onClick={() => setSearch("")} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted">Limpar busca</button>}
        </div>
      )}
    </div>
  );
}
