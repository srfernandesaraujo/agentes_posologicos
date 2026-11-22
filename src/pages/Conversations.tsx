import { useState, useMemo } from "react";
import { DomainEyebrow } from "@/components/ds/DomainEyebrow";
import { useNewUI } from "@/contexts/NewUIContext";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { ActivityHeatmap } from "@/components/ds/ActivityHeatmap";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgents } from "@/hooks/useAgents";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { MessageSquare, Search, Filter, Trash2, FileDown, MoreVertical, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { exportConversationPdf } from "@/lib/exportConversationPdf";
import { toast } from "sonner";
import { AddToProjectMenu } from "@/components/projects/AddToProjectMenu";

export default function Conversations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enabled: v2 } = useNewUI();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const { data: nativeAgents = [] } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["all-conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          id,
          agent_id,
          created_at,
          status,
          title,
          messages(content, role, created_at)
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Desde que o Chat virou "sala pessoal", as conversas novas vivem em virtual_rooms (chat_sessions está congelado).
  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ["all-conversations-rooms", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_rooms")
        .select("id, agent_id, name, created_at, updated_at, room_messages(count)")
        .eq("user_id", user!.id)
        .eq("room_type", "personal")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    nativeAgents.forEach((a) => {
      map.set(a.slug, a.name);
      map.set(a.id, a.name);
    });
    customAgents.forEach((a: any) => map.set(a.id, a.name));
    return map;
  }, [nativeAgents, customAgents]);

  const getAgentName = (agentId: string) => agentNameMap.get(agentId) || "Agente";

  const getSessionTitle = (session: any) => {
    if (session.title) return session.title;
    const firstUserMsg = session.messages?.find((m: any) => m.role === "user");
    if (firstUserMsg) {
      return firstUserMsg.content.length > 50
        ? firstUserMsg.content.substring(0, 50) + "..."
        : firstUserMsg.content;
    }
    return "Conversa sem título";
  };

  // Lista única: salas pessoais (atuais) + sessões antigas, da mais recente para a mais antiga.
  const sessionsWithMessages = useMemo(() => {
    const legacy = sessions
      .filter((s: any) => s.messages && s.messages.length > 0)
      .map((s: any) => ({ ...s, kind: "session", count: s.messages.length, sortAt: s.created_at }));
    const fromRooms = rooms
      .filter((r: any) => r.agent_id && (r.room_messages?.[0]?.count ?? 0) > 0)
      .map((r: any) => ({ id: r.id, agent_id: r.agent_id, created_at: r.updated_at, title: r.name, kind: "room", count: r.room_messages[0].count, messages: null, sortAt: r.updated_at }));
    return [...fromRooms, ...legacy].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  }, [sessions, rooms]);
  const openSession = (s: any) => navigate(s.kind === "room" ? `/chat/${s.agent_id}?room=${s.id}` : `/chat/${s.agent_id}?session=${s.id}`);

  const agents = Array.from(
    new Map(
      sessionsWithMessages.map((s: any) => [s.agent_id, getAgentName(s.agent_id)])
    ).entries()
  );

  const filtered = sessionsWithMessages.filter((s: any) => {
    if (agentFilter !== "all" && s.agent_id !== agentFilter) return false;
    if (search) {
      const title = getSessionTitle(s);
      const agentName = getAgentName(s.agent_id);
      const q = search.toLowerCase();
      return title.toLowerCase().includes(q) || agentName.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async (sessionId: string) => {
    try {
      if (rooms.some((r: any) => r.id === sessionId)) {
        await supabase.from("room_messages").delete().eq("room_id", sessionId);
        await supabase.from("virtual_rooms").delete().eq("id", sessionId);
        queryClient.invalidateQueries({ queryKey: ["all-conversations-rooms", user?.id] });
        queryClient.invalidateQueries({ queryKey: ["home-personal-rooms", user?.id] });
      } else {
        await supabase.from("messages").delete().eq("session_id", sessionId);
        await supabase.from("chat_sessions").delete().eq("id", sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ["all-conversations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversation-count", user?.id] });
      toast.success("Conversa excluída");
    } catch {
      toast.error("Erro ao excluir conversa");
    }
    setDeleteSessionId(null);
  };

  const handleExport = async (session: any) => {
    if (session.kind === "room") {
      const { data } = await supabase.from("room_messages").select("content, role, created_at").eq("room_id", session.id).order("created_at", { ascending: true });
      if (!data || data.length === 0) { toast.error("Conversa sem mensagens"); return; }
      exportConversationPdf(getAgentName(session.agent_id), data as any);
      toast.success("PDF exportado com sucesso");
      return;
    }
    if (!session.messages || session.messages.length === 0) {
      toast.error("Conversa sem mensagens");
      return;
    }
    const sorted = [...session.messages].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    exportConversationPdf(getAgentName(session.agent_id), sorted);
    toast.success("PDF exportado com sucesso");
  };

  const startEditing = (session: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(getSessionTitle(session));
  };

  const saveTitle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      if (rooms.some((r: any) => r.id === editingId)) {
        await supabase.from("virtual_rooms").update({ name: editTitle.trim() }).eq("id", editingId);
        queryClient.invalidateQueries({ queryKey: ["all-conversations-rooms", user?.id] });
      } else {
        await supabase
          .from("chat_sessions")
          .update({ title: editTitle.trim() } as any)
          .eq("id", editingId);
        queryClient.invalidateQueries({ queryKey: ["all-conversations", user?.id] });
      }
      toast.success("Título atualizado");
    } catch {
      toast.error("Erro ao atualizar título");
    }
    setEditingId(null);
  };

  // agrupa por quando a conversa aconteceu (usado no novo visual)
  const grouped = (() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const day = 86_400_000;
    const buckets: { label: string; items: any[] }[] = [
      { label: "Hoje", items: [] }, { label: "Ontem", items: [] }, { label: "Últimos 7 dias", items: [] }, { label: "Mais antigas", items: [] },
    ];
    filtered.forEach((sess: any) => {
      const age = startOfToday.getTime() - new Date(sess.created_at).setHours(0, 0, 0, 0);
      buckets[age <= 0 ? 0 : age <= day ? 1 : age <= 7 * day ? 2 : 3].items.push(sess);
    });
    return buckets.filter((b) => b.items.length > 0);
  })();
  const totalMessages = sessionsWithMessages.reduce((n: number, sess: any) => n + (sess.count || 0), 0);

  const renderRow = (session: any) => (
            <div
              key={session.id}
              className={v2 ? "group relative flex items-center overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--dom-clinica)/0.5)] hover:shadow-lg" : "group flex items-center rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"}
            >
              {editingId === session.id ? (
                <div className="flex-1 flex items-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-9 text-sm border-white/20 bg-white/10 text-white"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" onClick={saveTitle} className="h-8 w-8 text-green-400 hover:text-green-300 shrink-0">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="h-8 w-8 text-white/40 hover:text-white shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => openSession(session)}
                    className="flex-1 text-left p-4 min-w-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-primary">
                        {getAgentName(session.agent_id)}
                      </span>
                      <span className="text-xs text-white/30">
                        {new Date(session.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 truncate">
                      {getSessionTitle(session)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-white/30">
                        {session.count} mensagens
                      </span>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 sm:opacity-0 sm:group-hover:opacity-100 text-white/40 hover:text-white hover:bg-white/10 shrink-0 mr-3"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-white/10 bg-[hsl(220,25%,12%)] text-white min-w-[140px]">
                      <DropdownMenuItem onClick={(e) => startEditing(session, e)} className="gap-2 text-xs cursor-pointer hover:bg-white/10">
                        <Pencil className="h-3.5 w-3.5" />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(session)} className="gap-2 text-xs cursor-pointer hover:bg-white/10">
                        <FileDown className="h-3.5 w-3.5" />
                        Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteSessionId(session.id)} className="gap-2 text-xs cursor-pointer text-red-400 hover:bg-red-500/10 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {session.kind !== "room" && (
                    <div className="mr-2">
                      <AddToProjectMenu itemType="conversation" itemId={session.id} size="icon" />
                    </div>
                  )}
                </>
              )}
            </div>
  );

  if (isLoading || loadingRooms) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      {v2 ? (
        <div className="mb-6">
          <DomainEyebrow domain="clinica" section="Conversas" />
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">Sua linha do tempo</h1>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              { n: sessionsWithMessages.length, l: "conversas" },
              { n: agents.length, l: "agentes consultados" },
              { n: totalMessages, l: "mensagens" },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl border border-border bg-card p-4">
                <dd className="font-display text-3xl font-extrabold text-foreground"><CountUp value={x.n} /></dd>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{x.l}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-3 rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Atividade, 18 semanas</p>
            <ActivityHeatmap dates={sessionsWithMessages.map((sess: any) => sess.created_at)} weeks={18} tone="var(--dom-clinica)" />
          </div>
        </div>
      ) : (
      <div className="mb-8 animate-slide-up">
<DomainEyebrow domain="clinica" section="Conversas" />
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Conversas</h1>
        <p className="text-white/50">Acompanhe todas as interações</p>
      </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-48 border-white/10 bg-white/[0.05] text-white">
            <Filter className="mr-2 h-4 w-4 text-white/40" />
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agents.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name as string}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <MessageSquare className="mb-4 h-12 w-12" />
          <p>Nenhuma conversa encontrada</p>
        </div>
      ) : (
        v2 ? (
          <Reveal key={`${agentFilter}-${search}`} stagger={0.04} className="space-y-6">
            {grouped.map((g) => (
              <RevealItem key={g.label}>
                <h2 className="mb-2 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {g.label}<span className="h-px flex-1 bg-border" /><span>{g.items.length}</span>
                </h2>
                <div className="space-y-2">{g.items.map(renderRow)}</div>
              </RevealItem>
            ))}
          </Reveal>
        ) : (
        <div className="space-y-2">
          {filtered.map(renderRow)}
        </div>
        )
      )}

      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão apagadas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSessionId && handleDelete(deleteSessionId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
