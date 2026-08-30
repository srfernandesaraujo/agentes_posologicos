import { useState, useMemo, useRef } from "react";
import { useAgents, CATEGORIES, CATEGORY_COLORS } from "@/hooks/useAgents";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { usePurchasedAgents, useMarketplaceAgents } from "@/hooks/useMarketplace";
import { getIcon } from "@/lib/icons";
import { Bot, Search, ArrowRight, ShoppingBag, Sparkles, Coins, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Settings2 } from "lucide-react";

const CATEGORY_ICONS: Record<string, string> = {
  "Prática Clínica e Farmácia": "🏥",
  "EdTech e Professores 4.0": "🎓",
  "Pesquisa Acadêmica e Dados": "🔬",
  "Produção de Conteúdo e Nicho Tech": "📱",
};

const CATEGORY_VAR: Record<string, string> = {
  "Prática Clínica e Farmácia": "clinica",
  "EdTech e Professores 4.0": "edtech",
  "Pesquisa Acadêmica e Dados": "pesquisa",
  "Produção de Conteúdo e Nicho Tech": "conteudo",
};

const FEATURED_NEW_COUNT = 4;

export default function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();
  const { data: purchasedSet = new Set<string>() } = usePurchasedAgents();
  const { data: marketplaceAgents = [] } = useMarketplaceAgents();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isAdmin } = useIsAdmin();
  const contentRef = useRef<HTMLDivElement>(null);

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

  const newestAgents = useMemo(() => {
    return [...agents]
      .filter((a) => a.slug !== "super-agente")
      .filter(
        (a) =>
          !search || a.name.toLowerCase().includes(lowerSearch) || a.description.toLowerCase().includes(lowerSearch)
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, FEATURED_NEW_COUNT);
  }, [agents, search, lowerSearch]);

  const hasMyAgents = publishedCustom.length > 0 || purchasedAgents.length > 0;
  const totalNative = Object.values(agentsByCategory).reduce((s, a) => s + a.length, 0);
  const totalAll = totalNative + publishedCustom.length + purchasedAgents.length;

  const filteredCategories = activeCategory
    ? CATEGORIES.filter((c) => c === activeCategory && agentsByCategory[c])
    : CATEGORIES.filter((c) => agentsByCategory[c]);

  const handleCategoryClick = (cat: string | null) => {
    setActiveCategory(cat === activeCategory ? null : cat);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6">
      {/* Header */}
      <div className="mb-6 animate-slide-up">
        <h1 className="mb-1 font-display text-3xl font-bold text-white">
          {t("agents.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {totalAll} agente{totalAll !== 1 ? "s" : ""} em {Object.keys(agentsByCategory).length + (hasMyAgents ? 1 : 0)} categoria{Object.keys(agentsByCategory).length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Orchestrator highlight */}
      <button
        onClick={() => navigate("/orquestrador")}
        className="mb-6 w-full text-left group relative overflow-hidden rounded-xl border border-[hsl(174,62%,47%)]/30 bg-gradient-to-r from-[hsl(174,62%,47%)]/10 via-[hsl(220,80%,55%)]/10 to-[hsl(14,90%,58%)]/10 p-4 hover:border-[hsl(174,62%,47%)]/60 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(174,62%,47%)] to-[hsl(220,80%,55%)]">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-semibold text-white">Agente Orquestrador</h2>
              <span className="text-[10px] uppercase tracking-wide rounded-full bg-[hsl(14,90%,58%)]/20 text-[hsl(14,90%,68%)] px-2 py-0.5">Novo</span>
            </div>
            <p className="text-xs text-white/60">Diga um objetivo. Vários especialistas trabalham juntos e entregam um dossiê consolidado. 12 créditos.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-white/40 group-hover:translate-x-1 group-hover:text-white transition-all" />
        </div>
      </button>

      {/* Novidades — agentes recém-adicionados */}
      {newestAgents.length > 0 && activeCategory === null && !search && (
        <section className="mb-6 animate-slide-up">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[hsl(14,90%,58%)]" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Novidades</h2>
            <span className="text-xs text-muted-foreground">Acabaram de chegar</span>
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
            {newestAgents.map((agent) => {
              const Icon = getIcon(agent.icon);
              const catVar = CATEGORY_VAR[agent.category] || "clinica";

              return (
                <div
                  key={agent.id}
                  onClick={() => navigate(`/chat/${agent.id}`)}
                  className="group relative w-[260px] shrink-0 cursor-pointer rounded-xl border bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-white/30"
                  style={{ borderColor: `hsl(var(--cat-${catVar}) / 0.35)` }}
                >
                  <span className="absolute -top-2 right-3 rounded-full bg-[hsl(14,90%,58%)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Novo
                  </span>
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: `hsl(var(--cat-${catVar}) / 0.15)`,
                      color: `hsl(var(--cat-${catVar}))`,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="truncate text-sm font-semibold text-white">{agent.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-white/50">{agent.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                      <Coins className="h-3 w-3" />
                      {agent.credit_cost}
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0 space-y-1">
          {/* Search in sidebar */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-sm bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          {/* "Todas" */}
          <button
            onClick={() => handleCategoryClick(null)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
              activeCategory === null
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>Todas</span>
            <span className={`text-xs font-medium ${activeCategory === null ? "text-primary" : "text-muted-foreground"}`}>
              {totalAll}
            </span>
          </button>

          {/* My Agents link */}
          {hasMyAgents && (
            <button
              onClick={() => handleCategoryClick("__my__")}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                activeCategory === "__my__"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Meus Agentes
              </span>
              <span className="text-xs font-medium">{publishedCustom.length + purchasedAgents.length}</span>
            </button>
          )}

          {/* Category links */}
          {CATEGORIES.map((cat) => {
            const count = agentsByCategory[cat]?.length || 0;
            if (count === 0 && search) return null;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  activeCategory === cat
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span className="truncate">{cat.split(" e ")[0]}</span>
                </span>
                <span className="text-xs font-medium">{count}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Content */}
        <div ref={contentRef} className="flex-1 min-w-0">
          {/* Mobile search */}
          <div className="md:hidden mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-foreground placeholder:text-muted-foreground"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          {/* Mobile category pills */}
          <div className="md:hidden mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                activeCategory === null
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              Todas
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  activeCategory === cat
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {CATEGORY_ICONS[cat]} {cat.split(" e ")[0]}
              </button>
            ))}
          </div>




          {/* My Agents Section */}
          {hasMyAgents && (activeCategory === null || activeCategory === "__my__") && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                  Meus Agentes
                </h2>
                <span className="text-xs text-muted-foreground">({publishedCustom.length + purchasedAgents.length})</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {publishedCustom.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => navigate(`/chat/custom-${agent.id}`)}
                    className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer transition-all hover:border-white/20 hover:-translate-y-0.5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
                      <p className="text-xs text-white/40 line-clamp-1">{agent.description || t("agents.noDesc")}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                ))}
                {purchasedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => navigate(`/chat/custom-${agent.id}`)}
                    className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer transition-all hover:border-white/20 hover:-translate-y-0.5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
                      <p className="text-xs text-white/40 line-clamp-1">{agent.description || "Sem descrição"}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Native agents by category */}
          {filteredCategories.map((cat) => {
            const catAgents = agentsByCategory[cat];
            if (!catAgents) return null;

            return (
              <section key={cat} id={`cat-${cat}`} className="mb-8 scroll-mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full" style={{ background: `hsl(var(--cat-${CATEGORY_VAR[cat] || "clinica"}))` }} />
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                    {cat}
                  </h2>
                  <span className="text-xs text-muted-foreground">({catAgents.length})</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catAgents.map((agent) => {
                    const Icon = getIcon(agent.icon);
                    const catVar = CATEGORY_VAR[cat] || "clinica";

                    return (
                      <div
                        key={agent.id}
                        onClick={() => navigate(`/chat/${agent.id}`)}
                        className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 cursor-pointer transition-all hover:border-white/20 hover:-translate-y-0.5"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: `hsl(var(--cat-${catVar}) / 0.15)`,
                            color: `hsl(var(--cat-${catVar}))`,
                          }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/agente/${agent.id}`);
                                }}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                                title="Editar agente (Admin)"
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-white/50 line-clamp-2 mt-0.5">{agent.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-1 text-[10px] text-white/30">
                            <Coins className="h-3 w-3" />
                            {agent.credit_cost}
                          </div>
                          <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Empty state */}
          {totalAll === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bot className="mb-4 h-12 w-12" />
              <p>{t("agents.noResults")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
