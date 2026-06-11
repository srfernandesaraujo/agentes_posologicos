import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Workflow, Search, Star, Coins, Loader2, GitFork, ShoppingCart, Check, MessageSquare, Store } from "lucide-react";
import { toast } from "sonner";

const INSTALL_COST = 5;
const AUTHOR_ROYALTY = 2;

const CATEGORIES = [
  { key: "all", label: "Todos" },
  { key: "alta-hospitalar", label: "Protocolo de Alta" },
  { key: "osce", label: "Avaliação OSCE" },
  { key: "revisao", label: "Revisão Sistemática" },
  { key: "clinica", label: "Prática Clínica" },
  { key: "edtech", label: "EdTech" },
  { key: "pesquisa", label: "Pesquisa" },
  { key: "conteudo", label: "Conteúdo" },
  { key: "outros", label: "Outros" },
];

interface MarketFlow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string | null;
  execution_mode: string;
  installs_count: number;
  created_at: string;
  creator_name?: string;
  avg_rating?: number;
  review_count?: number;
}

function StarRating({ rating, onRate, interactive = false }: { rating: number; onRate?: (n: number) => void; interactive?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${interactive ? "cursor-pointer" : ""} ${i <= rating ? "fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" : "text-muted-foreground/30"}`} onClick={() => interactive && onRate?.(i)} />
      ))}
    </div>
  );
}

function useMarketplaceFlows() {
  return useQuery({
    queryKey: ["marketplace-flows"],
    queryFn: async () => {
      const { data: flows, error } = await (supabase as any).rpc("get_marketplace_flows");
      if (error) throw error;
      const list = (flows || []) as MarketFlow[];
      const ids = list.map((f) => f.id);
      const userIds = [...new Set(list.map((f) => f.user_id))];
      const [{ data: profiles }, { data: reviews }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("user_id, display_name").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("flow_reviews" as any).select("flow_id, rating").in("flow_id", ids) : Promise.resolve({ data: [] as any[] }),
      ]);
      const names: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { names[p.user_id] = p.display_name || "Usuário"; });
      const stats: Record<string, { sum: number; count: number }> = {};
      ((reviews || []) as any[]).forEach((r: any) => {
        stats[r.flow_id] = stats[r.flow_id] || { sum: 0, count: 0 };
        stats[r.flow_id].sum += r.rating; stats[r.flow_id].count += 1;
      });
      return list.map((f) => ({
        ...f,
        creator_name: names[f.user_id] || "Usuário",
        avg_rating: stats[f.id] ? stats[f.id].sum / stats[f.id].count : 0,
        review_count: stats[f.id]?.count || 0,
      }));
    },
  });
}

function useInstalledFlows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["installed-flows", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("flow_installs" as any).select("source_flow_id, installed_flow_id").eq("buyer_id", user!.id);
      if (error) throw error;
      return new Map((data as any[]).map((d) => [d.source_flow_id, d.installed_flow_id]));
    },
    enabled: !!user,
  });
}

function FlowDetailDialog({ flow, open, onClose, installedFlowId, onInstall, installing }: {
  flow: MarketFlow | null; open: boolean; onClose: () => void;
  installedFlowId?: string; onInstall: () => void; installing: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["flow-reviews", flow?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("flow_reviews" as any).select("*").eq("flow_id", flow!.id).order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data as any[]).map((r: any) => r.user_id))];
      const { data: profs } = userIds.length ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds) : { data: [] as any[] };
      const names: Record<string, string> = {};
      (profs || []).forEach((p: any) => { names[p.user_id] = p.display_name || "Usuário"; });
      return (data as any[]).map((r: any) => ({ ...r, reviewer_name: names[r.user_id] || "Usuário" }));
    },
    enabled: !!flow?.id && open,
  });

  const myExisting = (reviews as any[]).find((r: any) => r.user_id === user?.id);

  const submitReview = async () => {
    if (!flow || myRating === 0) { toast.error("Selecione uma nota"); return; }
    const { error } = await supabase.from("flow_reviews" as any).upsert({ flow_id: flow.id, user_id: user!.id, rating: myRating, comment: myComment || null }, { onConflict: "flow_id,user_id" });
    if (error) return toast.error("Erro ao enviar avaliação");
    toast.success("Avaliação enviada!");
    setMyRating(0); setMyComment("");
    qc.invalidateQueries({ queryKey: ["flow-reviews", flow.id] });
    qc.invalidateQueries({ queryKey: ["marketplace-flows"] });
  };

  if (!flow) return null;
  const isOwner = user?.id === flow.user_id;
  const isInstalled = !!installedFlowId;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-border bg-card text-card-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="block">{flow.name}</span>
              <span className="block text-sm font-normal text-muted-foreground">por {flow.creator_name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{flow.description || "Sem descrição."}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {flow.category && <Badge variant="outline">{flow.category}</Badge>}
          <Badge variant="secondary">{flow.execution_mode === "parallel" ? "Paralelo" : "Sequencial"}</Badge>
          <span className="flex items-center gap-1"><GitFork className="h-3 w-3" /> {flow.installs_count} instalações</span>
          <div className="flex items-center gap-1">
            <StarRating rating={Math.round(flow.avg_rating || 0)} />
            <span>{(flow.avg_rating || 0) > 0 ? (flow.avg_rating || 0).toFixed(1) : "—"} ({flow.review_count})</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[hsl(var(--warning))]" />
              <span className="text-lg font-bold">{INSTALL_COST} créditos</span>
            </div>
            {isInstalled && <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Instalado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{AUTHOR_ROYALTY} créditos vão como royalty ao autor.</p>
          {isOwner ? (
            <Button onClick={() => { onClose(); navigate(`/fluxos/${flow.id}`); }} className="w-full gap-2"><Workflow className="h-4 w-4" /> Abrir meu fluxo</Button>
          ) : isInstalled ? (
            <Button onClick={() => { onClose(); navigate(`/fluxos/${installedFlowId}`); }} className="w-full gap-2"><Workflow className="h-4 w-4" /> Abrir cópia instalada</Button>
          ) : (
            <Button onClick={onInstall} disabled={installing} className="w-full gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white">
              {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Instalar por {INSTALL_COST} créditos
            </Button>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Avaliações ({reviews.length})</h3>
          {!myExisting && !isOwner && user && (
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Avalie este fluxo:</p>
              <StarRating rating={myRating} onRate={setMyRating} interactive />
              <Textarea value={myComment} onChange={(e) => setMyComment(e.target.value)} placeholder="Comentário (opcional)..." rows={2} className="border-border bg-background" />
              <Button onClick={submitReview} size="sm">Enviar Avaliação</Button>
            </div>
          )}
          {(reviews as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground/50">Nenhuma avaliação ainda.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(reviews as any[]).map((r: any) => (
                <div key={r.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{r.reviewer_name}</span>
                    <StarRating rating={r.rating} />
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MarketplaceFlows() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance } = useCredits();
  const qc = useQueryClient();
  const { data: flows = [], isLoading } = useMarketplaceFlows();
  const { data: installedMap } = useInstalledFlows();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<MarketFlow | null>(null);

  const installFlow = useMutation({
    mutationFn: async (flowId: string) => {
      const { data, error } = await supabase.functions.invoke("install-flow", { body: { flowId } });
      if (error) throw new Error(error.message || "Erro ao instalar");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success("Fluxo instalado!");
      qc.invalidateQueries({ queryKey: ["installed-flows"] });
      qc.invalidateQueries({ queryKey: ["credits"] });
      qc.invalidateQueries({ queryKey: ["marketplace-flows"] });
      qc.invalidateQueries({ queryKey: ["agent-flows"] });
      setSelected(null);
      if (data?.installed_flow_id) navigate(`/fluxos/${data.installed_flow_id}`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao instalar fluxo"),
  });

  const filtered = flows.filter((f) => {
    const ms = !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.description || "").toLowerCase().includes(search.toLowerCase());
    const mc = category === "all" || f.category === category;
    return ms && mc;
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> Marketplace de Fluxos</h1>
          <p className="text-sm text-muted-foreground">Instale fluxos completos criados pela comunidade. {INSTALL_COST} créditos por instalação.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1"><Coins className="h-3 w-3" /> {balance} créditos</Badge>
          <Button variant="outline" onClick={() => navigate("/marketplace")}>Marketplace de Agentes</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fluxos..." className="pl-9" />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${category === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nenhum fluxo publicado ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            const installedId = installedMap?.get(f.id);
            return (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
                    <Workflow className="h-5 w-5 text-white" />
                  </div>
                  {installedId && <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Instalado</Badge>}
                </div>
                <h3 className="font-semibold mb-1 line-clamp-1">{f.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{f.description || "Sem descrição."}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{f.creator_name}</span>
                  <span className="flex items-center gap-1"><GitFork className="h-3 w-3" /> {f.installs_count}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <FlowDetailDialog
        flow={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        installedFlowId={selected ? installedMap?.get(selected.id) : undefined}
        onInstall={() => selected && installFlow.mutate(selected.id)}
        installing={installFlow.isPending}
      />
    </div>
  );
}