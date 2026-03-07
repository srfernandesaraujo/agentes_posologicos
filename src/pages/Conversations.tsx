import { useState, useMemo } from "react";
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

export default function Conversations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const sessionsWithMessages = sessions.filter((s: any) => s.messages && s.messages.length > 0);

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
      await supabase.from("messages").delete().eq("session_id", sessionId);
      await supabase.from("chat_sessions").delete().eq("id", sessionId);
      queryClient.invalidateQueries({ queryKey: ["all-conversations", user?.id] });
      toast.success("Conversa excluída");
    } catch {
      toast.error("Erro ao excluir conversa");
    }
    setDeleteSessionId(null);
  };

  const handleExport = (session: any) => {
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
      await supabase
        .from("chat_sessions")
        .update({ title: editTitle.trim() } as any)
        .eq("id", editingId);
      queryClient.invalidateQueries({ queryKey: ["all-conversations", user?.id] });
      toast.success("Título atualizado");
    } catch {
      toast.error("Erro ao atualizar título");
    }
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Conversas</h1>
        <p className="text-white/50">Acompanhe todas as interações</p>
      </div>

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
        <div className="space-y-2">
          {filtered.map((session: any) => (
            <div
              key={session.id}
              className="group flex items-center rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
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
                    onClick={() => navigate(`/chat/${session.agent_id}?session=${session.id}`)}
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
                        {session.messages?.length || 0} mensagens
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
                </>
              )}
            </div>
          ))}
        </div>
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
