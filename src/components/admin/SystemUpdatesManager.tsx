import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit2, Trash2, Rocket, Lightbulb, Wrench, Clock, CheckCircle2, AlertCircle,
  ArrowUpCircle, ArrowRightCircle, ArrowDownCircle, Search,
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
  released: { label: "Lançado", icon: CheckCircle2, color: "hsl(152,60%,42%)" },
  in_progress: { label: "Em Desenvolvimento", icon: Clock, color: "hsl(199,89%,48%)" },
  planned: { label: "Planejado", icon: Lightbulb, color: "hsl(38,92%,50%)" },
  idea: { label: "Ideia", icon: AlertCircle, color: "hsl(280,60%,55%)" },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any }> = {
  feature: { label: "Funcionalidade", icon: Rocket },
  improvement: { label: "Melhoria", icon: Wrench },
  bugfix: { label: "Correção", icon: AlertCircle },
  infrastructure: { label: "Infraestrutura", icon: ArrowUpCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  high: { label: "Alta", icon: ArrowUpCircle, color: "hsl(14,90%,58%)" },
  medium: { label: "Média", icon: ArrowRightCircle, color: "hsl(38,92%,50%)" },
  low: { label: "Baixa", icon: ArrowDownCircle, color: "hsl(174,62%,47%)" },
};

export function SystemUpdatesManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUpdate | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const filtered = updates.filter((u) => {
    if (filterStatus !== "all" && u.status !== filterStatus) return false;
    if (search && !u.title.toLowerCase().includes(search.toLowerCase()) && !u.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by status for timeline view
  const grouped = {
    idea: filtered.filter((u) => u.status === "idea"),
    planned: filtered.filter((u) => u.status === "planned"),
    in_progress: filtered.filter((u) => u.status === "in_progress"),
    released: filtered.filter((u) => u.status === "released"),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              placeholder="Buscar atualização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] border-white/10 bg-white/[0.05] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white">
          <Plus className="h-4 w-4" /> Nova Atualização
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = updates.filter((u) => u.status === key).length;
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                filterStatus === key ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                <span className="text-xs text-white/50">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-8">
          {(["in_progress", "planned", "idea", "released"] as const).map((statusKey) => {
            const items = grouped[statusKey];
            if (items.length === 0) return null;
            const cfg = STATUS_CONFIG[statusKey];
            const Icon = cfg.icon;
            return (
              <div key={statusKey}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                  <h3 className="text-lg font-semibold text-white">{cfg.label}</h3>
                  <Badge variant="secondary" className="bg-white/10 text-white/60">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((u) => {
                    const catCfg = CATEGORY_CONFIG[u.category] || CATEGORY_CONFIG.feature;
                    const priCfg = PRIORITY_CONFIG[u.priority] || PRIORITY_CONFIG.medium;
                    const CatIcon = catCfg.icon;
                    const PriIcon = priCfg.icon;
                    return (
                      <div
                        key={u.id}
                        className="group flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
                      >
                        <div
                          className="mt-1 h-3 w-3 rounded-full shrink-0 ring-4 ring-white/5"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-semibold text-white">{u.title}</h4>
                            <Badge variant="outline" className="text-xs border-white/10 text-white/50 gap-1">
                              <CatIcon className="h-3 w-3" /> {catCfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-white/10 gap-1" style={{ color: priCfg.color, borderColor: priCfg.color + "40" }}>
                              <PriIcon className="h-3 w-3" /> {priCfg.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-white/50 line-clamp-2">{u.description}</p>
                          {u.release_date && (
                            <p className="text-xs text-white/30 mt-1">
                              {format(new Date(u.release_date), "dd MMM yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10" onClick={() => openEdit(u)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => deleteMutation.mutate(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Atualização" : "Nova Atualização"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Título</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="border-white/10 bg-white/[0.05] text-white" placeholder="Ex: Sistema de Chat Avançado" />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Descrição</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="border-white/10 bg-white/[0.05] text-white min-h-[80px]" placeholder="Descreva a atualização..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-white/60 mb-1 block">Categoria</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1 block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Data de lançamento</label>
              <Input type="datetime-local" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="border-white/10 bg-white/[0.05] text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="border-white/10 text-white/60 hover:bg-white/10 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={!title.trim() || upsertMutation.isPending} className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white">
              {upsertMutation.isPending ? "Salvando..." : editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
