import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Edit2, Trash2, Rocket, Lightbulb, Wrench, Clock, CheckCircle2, AlertCircle,
  ArrowUpCircle, ArrowRightCircle, ArrowDownCircle, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemUpdate {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  released: { label: "Lançado", icon: CheckCircle2, color: "hsl(var(--success))" },
  in_progress: { label: "Em Desenvolvimento", icon: Clock, color: "hsl(var(--primary))" },
  planned: { label: "Planejado", icon: Lightbulb, color: "hsl(var(--warning))" },
  idea: { label: "Ideia", icon: AlertCircle, color: "hsl(var(--cat-pesquisa))" },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any }> = {
  feature: { label: "Funcionalidade", icon: Rocket },
  improvement: { label: "Melhoria", icon: Wrench },
  bugfix: { label: "Correção", icon: AlertCircle },
  infrastructure: { label: "Infraestrutura", icon: ArrowUpCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  high: { label: "Alta", icon: ArrowUpCircle, color: "hsl(var(--destructive))" },
  medium: { label: "Média", icon: ArrowRightCircle, color: "hsl(var(--warning))" },
  low: { label: "Baixa", icon: ArrowDownCircle, color: "hsl(var(--accent))" },
};

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export function SystemUpdatesManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUpdate | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("feature");
  const [status, setStatus] = useState("planned");
  const [priority, setPriority] = useState("medium");
  const [releaseDate, setReleaseDate] = useState("");

  const { data: updates = [], isLoading } = useQuery({
    queryKey: ["system-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_updates" as any)
        .select("*")
        .order("release_date", { ascending: false, nullsFirst: true });
      if (error) throw error;
      return data as unknown as SystemUpdate[];
    },
  });

  const changelogItems = updates.filter((u) => u.status === "released");
  const roadmapItems = updates.filter((u) => u.status !== "released");

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title,
        description,
        category,
        status,
        priority,
        release_date: releaseDate ? new Date(releaseDate).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from("system_updates" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_updates" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-updates"] });
      toast.success(editing ? "Atualização editada!" : "Atualização registrada!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_updates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-updates"] });
      toast.success("Atualização removida!");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const concludeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_updates" as any)
        .update({
          status: "released",
          release_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-updates"] });
      toast.success("Atualização concluída e adicionada ao changelog!");
    },
    onError: () => toast.error("Erro ao concluir"),
  });

  const handleGenerateRoadmap = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-roadmap");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["system-updates"] });
      toast.success(`${data?.count || 0} sugestões de roadmap geradas!`);
    } catch (e: any) {
      toast.error("Erro ao gerar roadmap: " + (e.message || "erro desconhecido"));
    } finally {
      setGenerating(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCategory("feature");
    setStatus("planned");
    setPriority("medium");
    setReleaseDate("");
    setDialogOpen(true);
  };

  const openEdit = (u: SystemUpdate) => {
    setEditing(u);
    setTitle(u.title);
    setDescription(u.description);
    setCategory(u.category);
    setStatus(u.status);
    setPriority(u.priority);
    setReleaseDate(u.release_date ? new Date(u.release_date).toISOString().slice(0, 16) : "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const renderCard = (u: SystemUpdate, showConclude: boolean) => {
    const priCfg = PRIORITY_CONFIG[u.priority] || PRIORITY_CONFIG.medium;
    const statusCfg = STATUS_CONFIG[u.status] || STATUS_CONFIG.planned;

    return (
      <div
        key={u.id}
        className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all"
        style={{ borderLeftWidth: "4px", borderLeftColor: statusCfg.color }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">{u.title}</h4>
            <Badge className={`text-xs font-medium border ${PRIORITY_BADGE_CLASSES[u.priority] || PRIORITY_BADGE_CLASSES.medium}`}>
              {priCfg.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 ml-6">{u.description}</p>
          {u.release_date && u.status === "released" && (
            <p className="text-xs text-muted-foreground/70 mt-1 ml-6">
              {format(new Date(u.release_date), "dd MMM yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showConclude && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => concludeMutation.mutate(u.id)}
              disabled={concludeMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
          )}
          {!showConclude && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openEdit(u)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => deleteMutation.mutate(u.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Pipeline de Atualizações</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Histórico de funcionalidades e planejamento futuro do sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateRoadmap}
            disabled={generating}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar Roadmap IA"}
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Entrada
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="changelog" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="changelog" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Changelog ({changelogItems.length})
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5">
            <Lightbulb className="h-4 w-4" />
            Roadmap ({roadmapItems.length})
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="changelog" className="space-y-3 mt-4">
              {changelogItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhuma atualização lançada ainda.</p>
              ) : (
                changelogItems.map((u) => renderCard(u, false))
              )}
            </TabsContent>

            <TabsContent value="roadmap" className="space-y-3 mt-4">
              {roadmapItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhum item no roadmap. Clique em "Gerar Roadmap IA" para sugestões.</p>
              ) : (
                roadmapItems.map((u) => renderCard(u, true))
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Atualização" : "Nova Atualização"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Título</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Sistema de Chat Avançado" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Descrição</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" placeholder="Descreva a atualização..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Data de lançamento</label>
              <Input type="datetime-local" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={!title.trim() || upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvando..." : editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
