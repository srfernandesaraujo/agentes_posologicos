import { useState } from "react";
import { useMarketplaceAgents, useAgentReviews, useSubmitReview, usePurchasedAgents, usePurchaseAgent, MarketplaceAgent } from "@/hooks/useMarketplace";
import { Search, Bot, Star, Store, MessageSquare, User, Coins, ShoppingCart, Check, TrendingUp, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";

const PURCHASE_COST = 5;
const SELLER_EARNING = 3;

const CATEGORIES = [
  { key: "all", label: "Todos", icon: "🔥" },
  { key: "clinica", label: "Prática Clínica", icon: "🏥" },
  { key: "edtech", label: "EdTech", icon: "🎓" },
  { key: "pesquisa", label: "Pesquisa", icon: "🔬" },
  { key: "conteudo", label: "Conteúdo", icon: "📱" },
  { key: "outros", label: "Outros", icon: "🤖" },
];

function StarRating({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${interactive ? "cursor-pointer" : ""} ${
            i <= rating ? "fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" : "text-muted-foreground/30"
          }`}
          onClick={() => interactive && onRate?.(i)}
        />
      ))}
    </div>
  );
}

function AgentDetailDialog({ agent, open, onClose, isPurchased, onPurchase, purchaseLoading }: {
  agent: MarketplaceAgent | null;
  open: boolean;
  onClose: () => void;
  isPurchased: boolean;
  onPurchase: () => void;
  purchaseLoading: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: reviews = [] } = useAgentReviews(agent?.id);
  const submitReview = useSubmitReview();
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");

  if (!agent) return null;

  const isOwner = user?.id === agent.user_id;
  const myExistingReview = reviews.find((r) => r.user_id === user?.id);

  const handleSubmitReview = async () => {
    if (myRating === 0) { toast.error("Selecione uma nota"); return; }
    try {
      await submitReview.mutateAsync({ agentId: agent.id, rating: myRating, comment: myComment || undefined });
      toast.success("Avaliação enviada!");
      setMyRating(0);
      setMyComment("");
    } catch {
      toast.error("Erro ao enviar avaliação");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-border bg-card text-card-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="block">{agent.name}</span>
              <span className="block text-sm font-normal text-muted-foreground">por {agent.creator_name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{agent.description}</p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <StarRating rating={Math.round(agent.avg_rating)} />
            <span className="ml-1">{agent.avg_rating > 0 ? agent.avg_rating.toFixed(1) : "—"}</span>
            <span>({agent.review_count})</span>
          </div>
        </div>

        {/* Purchase / Use section */}
        <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[hsl(var(--warning))]" />
              <span className="text-lg font-bold">{PURCHASE_COST} créditos</span>
            </div>
            {isPurchased && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Adquirido
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ao adquirir, o agente ficará disponível na sua galeria. {SELLER_EARNING} créditos vão para o criador.
          </p>

          {isOwner ? (
            <Button onClick={() => { onClose(); navigate(`/chat/custom-${agent.id}`); }} className="w-full gap-2">
              <Bot className="h-4 w-4" /> Usar meu Agente
            </Button>
          ) : isPurchased ? (
            <Button onClick={() => { onClose(); navigate(`/chat/custom-${agent.id}`); }} className="w-full gap-2">
              <Bot className="h-4 w-4" /> Abrir Agente
            </Button>
          ) : (
            <Button onClick={onPurchase} disabled={purchaseLoading} className="w-full gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white">
              {purchaseLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              Adquirir por {PURCHASE_COST} créditos
            </Button>
          )}
        </div>

        {/* Reviews */}
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Avaliações ({reviews.length})
          </h3>

          {!myExistingReview && !isOwner && user && (
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Avalie este agente:</p>
              <StarRating rating={myRating} onRate={setMyRating} interactive />
              <Textarea value={myComment} onChange={(e) => setMyComment(e.target.value)} placeholder="Deixe um comentário (opcional)..." rows={2} className="border-border bg-background" />
              <Button onClick={handleSubmitReview} disabled={submitReview.isPending} size="sm">Enviar Avaliação</Button>
            </div>
          )}

          {myExistingReview && (
            <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <p className="text-xs text-accent mb-1">Sua avaliação:</p>
              <StarRating rating={myExistingReview.rating} />
              {myExistingReview.comment && <p className="mt-1 text-sm text-muted-foreground">{myExistingReview.comment}</p>}
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground/50">Nenhuma avaliação ainda. Seja o primeiro!</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {reviews.filter(r => r.user_id !== user?.id).map((review) => (
                <div key={review.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{review.reviewer_name}</span>
                    <StarRating rating={review.rating} />
                  </div>
                  {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                  <p className="mt-1 text-xs text-muted-foreground/50">{new Date(review.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Marketplace() {
  const { data: agents = [], isLoading } = useMarketplaceAgents();
  const { data: purchasedSet = new Set<string>() } = usePurchasedAgents();
  const purchaseAgent = usePurchaseAgent();
  const { user } = useAuth();
  const { balance } = useCredits();
  const { isAdmin } = useIsAdmin();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const navigate = useNavigate();

  const filtered = agents.filter((a) => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    // Simple category matching based on keywords in description
    if (category === "all") return matchSearch;
    return matchSearch; // For now all agents show in all categories since agents don't have a category field
  });

  const topAgents = [...agents].sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count).slice(0, 6);
  const featuredAgent = topAgents[0];

  const handlePurchase = async (agent: MarketplaceAgent) => {
    if (!user) { toast.error("Faça login para adquirir agentes"); return; }
    if (!isAdmin && balance < PURCHASE_COST) {
      toast.error("Créditos insuficientes", {
        description: `Você precisa de ${PURCHASE_COST} créditos. Saldo: ${balance}`,
        action: { label: "Comprar", onClick: () => navigate("/creditos") },
      });
      return;
    }
    try {
      await purchaseAgent.mutateAsync({ agent });
      toast.success("Agente adquirido com sucesso!", { description: "Ele já está disponível na sua galeria de agentes." });
    } catch (err: any) {
      toast.error(err.message || "Erro ao adquirir agente");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6">
      {/* Header */}
      <div className="mb-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-1">
          <Store className="h-7 w-7 text-primary" />
          <h1 className="font-display text-3xl font-bold">Marketplace</h1>
        </div>
        <p className="text-muted-foreground">Descubra e adquira agentes criados pela comunidade</p>
      </div>

      {/* Search */}
      <div className="mb-5 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Category chips — App Store style */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              category === cat.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured Agent — Hero Banner (if exists) */}
      {featuredAgent && !search && (
        <div
          onClick={() => setSelectedAgent(featuredAgent)}
          className="mb-8 cursor-pointer overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-accent/5 to-card p-6 md:p-8 transition-all hover:shadow-lg animate-fade-in"
        >
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-lg">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-[hsl(var(--warning))]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--warning))]">Destaque</span>
              </div>
              <h2 className="font-display text-xl md:text-2xl font-bold mb-1">{featuredAgent.name}</h2>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{featuredAgent.description}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {featuredAgent.creator_name}</span>
                <span className="flex items-center gap-1">
                  <Star className={`h-3.5 w-3.5 ${featuredAgent.avg_rating > 0 ? "fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" : ""}`} />
                  {featuredAgent.avg_rating > 0 ? featuredAgent.avg_rating.toFixed(1) : "Novo"}
                </span>
                <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /> {PURCHASE_COST} créditos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Agents — Numbered List (App Store style) */}
      {!search && topAgents.length > 1 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Agentes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topAgents.map((agent, idx) => {
              const owned = agent.user_id === user?.id;
              const purchased = purchasedSet.has(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-center">{idx + 1}</span>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-primary">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate text-card-foreground">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{agent.creator_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Star className={`h-3 w-3 ${agent.avg_rating > 0 ? "fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" : "text-muted-foreground/30"}`} />
                      <span className="text-xs text-muted-foreground">{agent.avg_rating > 0 ? agent.avg_rating.toFixed(1) : "—"}</span>
                    </div>
                  </div>
                  {(owned || purchased) && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {owned ? "Seu" : "Adquirido"}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* All Agents Grid */}
      <div>
        <h2 className="mb-4 font-display text-lg font-bold">
          {search ? `Resultados para "${search}"` : "Todos os Agentes"}
        </h2>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Store className="mb-4 h-12 w-12" />
            <p>Nenhum agente encontrado.</p>
            <p className="text-sm mt-1">Publique o seu para começar!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => {
              const owned = agent.user_id === user?.id;
              const purchased = purchasedSet.has(agent.id);
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-in"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(owned || purchased) && (
                        <Badge variant="outline" className="text-[10px]">
                          {owned ? "Seu" : <><Check className="h-2.5 w-2.5 mr-0.5" />Adquirido</>}
                        </Badge>
                      )}
                      <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className={`h-3.5 w-3.5 ${agent.avg_rating > 0 ? "fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" : "text-muted-foreground/30"}`} />
                        <span>{agent.avg_rating > 0 ? agent.avg_rating.toFixed(1) : "—"}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="mb-1 font-display text-base font-semibold leading-tight text-card-foreground">{agent.name}</h3>
                  <p className="mb-1 text-xs text-muted-foreground">por {agent.creator_name}</p>
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{agent.description || "Sem descrição"}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--warning))]">
                      <Coins className="h-3.5 w-3.5" />
                      {PURCHASE_COST} créditos
                    </div>
                    {!owned && !purchased ? (
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handlePurchase(agent); }}
                        disabled={purchaseAgent.isPending}
                        className="h-8 gap-1 text-xs bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white"
                      >
                        <ShoppingCart className="h-3 w-3" /> Adquirir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/chat/custom-${agent.id}`); }}
                        className="h-8 gap-1 text-xs"
                      >
                        <Bot className="h-3 w-3" /> Usar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AgentDetailDialog
        agent={selectedAgent}
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        isPurchased={selectedAgent ? purchasedSet.has(selectedAgent.id) : false}
        onPurchase={() => selectedAgent && handlePurchase(selectedAgent)}
        purchaseLoading={purchaseAgent.isPending}
      />
    </div>
  );
}
