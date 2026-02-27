import { useState } from "react";
import { useAgents, CATEGORIES } from "@/hooks/useAgents";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { usePurchasedAgents, useMarketplaceAgents } from "@/hooks/useMarketplace";
import { AgentCard } from "@/components/agents/AgentCard";
import { Bot, Search, ArrowRight, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();
  const { data: purchasedSet = new Set<string>() } = usePurchasedAgents();
  const { data: marketplaceAgents = [] } = useMarketplaceAgents();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Agents purchased from marketplace (not owned by user)
  const purchasedAgents = marketplaceAgents.filter(
    (a) => purchasedSet.has(a.id) && !customAgents.some((c) => c.id === a.id)
  ).filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = agents.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCat || a.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  const publishedCustom = customAgents.filter(
    (a) => a.status === "published" && (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">{t("agents.title")}</h1>
        <p className="text-white/50">{t("agents.desc")}</p>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input placeholder={t("agents.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setSelectedCat(null)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!selectedCat ? "gradient-primary text-white" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"}`}>
          {t("agents.all")}
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${selectedCat === cat ? "gradient-primary text-white" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Purchased agents from marketplace */}
      {purchasedAgents.length > 0 && !selectedCat && (
        <div className="mb-8">
          <h2 className="mb-4 font-display text-lg font-semibold text-white/80 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[hsl(152,60%,42%)]" />
            Agentes Adquiridos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {purchasedAgents.map((agent) => (
              <div key={agent.id} className="group rounded-xl border border-[hsl(152,60%,42%)]/30 bg-white/[0.03] p-6 transition-all hover:border-[hsl(152,60%,42%)]/50 hover:-translate-y-1 cursor-pointer" onClick={() => navigate(`/chat/custom-${agent.id}`)}>
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(152,60%,42%)]/20 text-[hsl(152,60%,42%)]">
                    <Bot className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-[hsl(152,60%,42%)]/10 border border-[hsl(152,60%,42%)]/30 px-2.5 py-1 text-xs font-medium text-[hsl(152,60%,42%)]">
                    Marketplace
                  </span>
                </div>
                <h3 className="mb-1 font-display text-lg font-semibold leading-tight text-white">{agent.name}</h3>
                <p className="mb-1 text-xs text-white/30">por {agent.creator_name}</p>
                <p className="mb-5 text-sm text-white/40 line-clamp-3">{agent.description || "Sem descrição"}</p>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                  {t("agents.startChat")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {publishedCustom.length > 0 && !selectedCat && (
        <div className="mb-8">
          <h2 className="mb-4 font-display text-lg font-semibold text-white/80">{t("agents.custom")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publishedCustom.map((agent) => (
              <div key={agent.id} className="group rounded-xl border border-[hsl(14,90%,58%)]/30 bg-white/[0.03] p-6 transition-all hover:border-[hsl(14,90%,58%)]/50 hover:-translate-y-1 cursor-pointer" onClick={() => navigate(`/chat/custom-${agent.id}`)}>
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(14,90%,58%)]/20 text-[hsl(14,90%,58%)]">
                    <Bot className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-[hsl(14,90%,58%)]/10 border border-[hsl(14,90%,58%)]/30 px-2.5 py-1 text-xs font-medium text-[hsl(14,90%,58%)]">
                    {t("agents.customBadge")}
                  </span>
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold leading-tight text-white">{agent.name}</h3>
                <p className="mb-5 text-sm text-white/40 line-clamp-3">{agent.description || t("agents.noDesc")}</p>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                  {t("agents.startChat")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <Bot className="mb-4 h-12 w-12" />
          <p>{t("agents.noResults")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
