import { useState, useMemo } from "react";
import { useAgents, CATEGORIES, CATEGORY_COLORS } from "@/hooks/useAgents";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { usePurchasedAgents, useMarketplaceAgents } from "@/hooks/useMarketplace";
import { AgentCard } from "@/components/agents/AgentCard";
import { Bot, Search, ArrowRight, ShoppingBag, ChevronDown, ChevronRight, Sparkles, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const CATEGORY_ICONS: Record<string, string> = {
  "Prática Clínica e Farmácia": "🏥",
  "EdTech e Professores 4.0": "🎓",
  "Pesquisa Acadêmica e Dados": "🔬",
  "Produção de Conteúdo e Nicho Tech": "📱",
};

export default function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();
  const { data: purchasedSet = new Set<string>() } = usePurchasedAgents();
  const { data: marketplaceAgents = [] } = useMarketplaceAgents();
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c, true]))
  );
  const navigate = useNavigate();
  const { t } = useLanguage();

  const lowerSearch = search.toLowerCase();

  const purchasedAgents = marketplaceAgents.filter(
    (a) =>
      purchasedSet.has(a.id) &&
      !customAgents.some((c) => c.id === a.id) &&
      (!search || a.name.toLowerCase().includes(lowerSearch) || a.description.toLowerCase().includes(lowerSearch))
  );

  const publishedCustom = customAgents.filter(
    (a) =>
      a.status === "published" &&
      (!search || a.name.toLowerCase().includes(lowerSearch) || a.description.toLowerCase().includes(lowerSearch))
  );

  const superAgent = useMemo(() => agents.find((a) => a.slug === "super-agente"), [agents]);

  const agentsByCategory = useMemo(() => {
    const map: Record<string, typeof agents> = {};
    for (const cat of CATEGORIES) {
      const catAgents = agents.filter((a) => {
        if (a.slug === "super-agente") return false;
        const matchesSearch =
          !search || a.name.toLowerCase().includes(lowerSearch) || a.description.toLowerCase().includes(lowerSearch);
        return a.category === cat && matchesSearch;
      });
      if (catAgents.length > 0) map[cat] = catAgents;
    }
    return map;
  }, [agents, search, lowerSearch]);

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const hasMyAgents = publishedCustom.length > 0 || purchasedAgents.length > 0;
  const totalResults =
    Object.values(agentsByCategory).reduce((s, a) => s + a.length, 0) +
    publishedCustom.length +
    purchasedAgents.length;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-foreground">{t("agents.title")}</h1>
        <p className="text-muted-foreground">{t("agents.desc")}</p>
      </div>

      {/* Search + quick stats */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("agents.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {search && (
          <p className="text-sm text-muted-foreground">
            {totalResults} resultado{totalResults !== 1 ? "s" : ""} encontrado{totalResults !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Super Agent Featured Card */}
      {superAgent && !search && (
        <div
          className="mb-8 group cursor-pointer rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
          onClick={() => navigate(`/chat/${superAgent.id}`)}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
              <Compass className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display text-xl font-bold text-card-foreground">{superAgent.name}</h2>
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">GRÁTIS</span>
              </div>
              <p className="text-sm text-muted-foreground">{superAgent.description}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      )}

      {/* Quick category jump */}
      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = agentsByCategory[cat]?.length || 0;
          return (
            <button
              key={cat}
              onClick={() => {
                const el = document.getElementById(`cat-${cat}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
                if (!expandedCats[cat]) toggleCat(cat);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span>{CATEGORY_ICONS[cat]}</span>
              <span className="hidden sm:inline">{cat}</span>
              <span className="sm:hidden">{cat.split(" ")[0]}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      {/* My Agents section (custom + purchased) */}
      {hasMyAgents && (
        <Collapsible defaultOpen className="mb-8">
          <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="flex-1 text-left font-display text-lg font-semibold text-card-foreground">
              Meus Agentes
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {publishedCustom.length + purchasedAgents.length}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:rotate-[-90deg]" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publishedCustom.map((agent) => (
                <div
                  key={agent.id}
                  className="group rounded-xl border border-[hsl(14,90%,58%)]/30 bg-card p-5 transition-all hover:border-[hsl(14,90%,58%)]/50 hover:-translate-y-1 cursor-pointer"
                  onClick={() => navigate(`/chat/custom-${agent.id}`)}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(14,90%,58%)]/20 text-[hsl(14,90%,58%)]">
                      <Bot className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-[hsl(14,90%,58%)]/10 border border-[hsl(14,90%,58%)]/30 px-2 py-0.5 text-xs font-medium text-[hsl(14,90%,58%)]">
                      {t("agents.customBadge")}
                    </span>
                  </div>
                  <h3 className="mb-1 font-display text-base font-semibold leading-tight text-card-foreground">{agent.name}</h3>
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{agent.description || t("agents.noDesc")}</p>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-card-foreground hover:bg-accent transition-colors">
                    {t("agents.startChat")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              ))}
              {purchasedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="group rounded-xl border border-[hsl(152,60%,42%)]/30 bg-card p-5 transition-all hover:border-[hsl(152,60%,42%)]/50 hover:-translate-y-1 cursor-pointer"
                  onClick={() => navigate(`/chat/custom-${agent.id}`)}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(152,60%,42%)]/20 text-[hsl(152,60%,42%)]">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-[hsl(152,60%,42%)]/10 border border-[hsl(152,60%,42%)]/30 px-2 py-0.5 text-xs font-medium text-[hsl(152,60%,42%)]">
                      Marketplace
                    </span>
                  </div>
                  <h3 className="mb-1 font-display text-base font-semibold leading-tight text-card-foreground">{agent.name}</h3>
                  <p className="mb-0.5 text-xs text-muted-foreground">por {agent.creator_name}</p>
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{agent.description || "Sem descrição"}</p>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-card-foreground hover:bg-accent transition-colors">
                    {t("agents.startChat")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Native agents grouped by category */}
      {CATEGORIES.map((cat) => {
        const catAgents = agentsByCategory[cat];
        if (!catAgents) return null;
        const isOpen = expandedCats[cat] !== false;
        const color = CATEGORY_COLORS[cat] || "bg-primary";

        return (
          <div key={cat} id={`cat-${cat}`} className="mb-6 scroll-mt-4">
            <button
              onClick={() => toggleCat(cat)}
              className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
            >
              <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
              <div className={`h-2 w-2 rounded-full ${color}`} />
              <h2 className="flex-1 text-left font-display text-lg font-semibold text-card-foreground">
                {cat}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {catAgents.length} agente{catAgents.length !== 1 ? "s" : ""}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {isOpen && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {catAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {totalResults === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bot className="mb-4 h-12 w-12" />
          <p>{t("agents.noResults")}</p>
        </div>
      )}
    </div>
  );
}
