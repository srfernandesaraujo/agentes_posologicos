import { useState } from "react";
import { useMarketplaceAgents, useAgentReviews, useSubmitReview, MarketplaceAgent } from "@/hooks/useMarketplace";
import { Search, Bot, Star, ArrowRight, Store, MessageSquare, User, Coins } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function StarRating({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${interactive ? "cursor-pointer" : ""} ${
            i <= rating ? "fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" : "text-white/20"
          }`}
          onClick={() => interactive && onRate?.(i)}
        />
      ))}
    </div>
  );
}

function AgentDetailDialog({ agent, open, onClose }: { agent: MarketplaceAgent | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: reviews = [] } = useAgentReviews(agent?.id);
  const submitReview = useSubmitReview();
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");

  if (!agent) return null;

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
      <DialogContent className="max-w-lg border-white/10 bg-[hsl(220,25%,10%)] text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Bot className="h-5 w-5" />
            </div>
            {agent.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-white/60">{agent.description}</p>

        <div className="flex items-center gap-4 text-sm text-white/50">
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {agent.creator_name}
          </div>
          <div className="flex items-center gap-1">
            <StarRating rating={Math.round(agent.avg_rating)} />
            <span>({agent.review_count})</span>
          </div>
        </div>

        <Button onClick={() => { onClose(); navigate(`/chat/custom-${agent.id}`); }} className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <ArrowRight className="h-4 w-4" />
          Usar este Agente
        </Button>

        {/* Reviews section */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="mb-3 font-semibold text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Avaliações ({reviews.length})
          </h3>

          {/* Submit review */}
          {!myExistingReview && user?.id !== agent.user_id && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-sm text-white/70">Avalie este agente:</p>
              <StarRating rating={myRating} onRate={setMyRating} interactive />
              <Textarea
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                placeholder="Deixe um comentário (opcional)..."
                rows={2}
                className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
              />
              <Button onClick={handleSubmitReview} disabled={submitReview.isPending} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Enviar Avaliação
              </Button>
            </div>
          )}

          {myExistingReview && (
            <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <p className="text-xs text-accent mb-1">Sua avaliação:</p>
              <StarRating rating={myExistingReview.rating} />
              {myExistingReview.comment && <p className="mt-1 text-sm text-white/60">{myExistingReview.comment}</p>}
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-white/30">Nenhuma avaliação ainda. Seja o primeiro!</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {reviews.filter(r => r.user_id !== user?.id).map((review) => (
                <div key={review.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white/80">{review.reviewer_name}</span>
                    <StarRating rating={review.rating} />
                  </div>
                  {review.comment && <p className="text-sm text-white/50">{review.comment}</p>}
                  <p className="mt-1 text-xs text-white/20">
                    {new Date(review.created_at).toLocaleDateString("pt-BR")}
                  </p>
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
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const navigate = useNavigate();

  const filtered = agents.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <Store className="h-8 w-8 text-accent" />
          <h1 className="font-display text-3xl font-bold text-white">Marketplace</h1>
        </div>
        <p className="text-white/50">Descubra agentes criados pela comunidade e compartilhe os seus</p>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input placeholder="Buscar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <Store className="mb-4 h-12 w-12" />
          <p>Nenhum agente no marketplace ainda.</p>
          <p className="text-sm mt-1">Publique o seu para começar!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="group cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-accent/40 hover:-translate-y-1 animate-fade-in"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs text-white/50">
                  <Star className={`h-3.5 w-3.5 ${agent.avg_rating > 0 ? "fill-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" : "text-white/20"}`} />
                  <span>{agent.avg_rating > 0 ? agent.avg_rating.toFixed(1) : "—"}</span>
                  <span className="text-white/30">({agent.review_count})</span>
                </div>
              </div>

              <h3 className="mb-1 font-display text-lg font-semibold leading-tight text-white">{agent.name}</h3>
              <p className="mb-1 text-xs text-white/30">por {agent.creator_name}</p>
              <div className="mb-3 flex items-center gap-1 text-xs text-white/40">
                <Coins className="h-3 w-3 text-[hsl(38,92%,50%)]" />
                0.5 crédito/uso
              </div>
              <p className="mb-5 text-sm text-white/40 line-clamp-3">{agent.description}</p>

              <Button
                onClick={(e) => { e.stopPropagation(); navigate(`/chat/custom-${agent.id}`); }}
                className="w-full gap-2 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                variant="outline"
              >
                Usar Agente
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AgentDetailDialog agent={selectedAgent} open={!!selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  );
}
