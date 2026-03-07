import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Plus, PanelLeftClose, PanelLeft, Trash2, FileDown, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { exportConversationPdf } from "@/lib/exportConversationPdf";
import { toast } from "sonner";
import { useState } from "react";

interface ChatSidebarProps {
  agentId: string;
  agentName?: string;
  isCustom: boolean;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function ChatSidebar({
  agentId,
  agentName = "Agente",
  isCustom,
  currentSessionId,
  onSelectSession,
  onNewConversation,
  collapsed,
  onToggle,
}: ChatSidebarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["chat-sessions", agentId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          id,
          created_at,
          status,
          messages(content, role, created_at)
        `)
        .eq("user_id", user!.id)
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getSessionTitle = (session: any) => {
    const firstUserMsg = session.messages?.find((m: any) => m.role === "user");
    if (firstUserMsg) {
      return firstUserMsg.content.length > 40
        ? firstUserMsg.content.substring(0, 40) + "..."
        : firstUserMsg.content;
    }
    return "Nova conversa";
  };

  const handleDelete = async (sessionId: string) => {
    try {
      await supabase.from("messages").delete().eq("session_id", sessionId);
      await supabase.from("chat_sessions").delete().eq("id", sessionId);
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", agentId, user?.id] });
      if (currentSessionId === sessionId) {
        onNewConversation();
      }
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
    exportConversationPdf(agentName, sorted);
    toast.success("PDF exportado com sucesso");
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 border-r border-white/10 bg-[hsl(220,25%,6%)]">
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-white/50 hover:bg-white/10 hover:text-white mb-2">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNewConversation} className="text-[hsl(174,62%,47%)] hover:bg-white/10">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-64 flex-col border-r border-white/10 bg-[hsl(220,25%,6%)]">
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
          <Button
            onClick={onNewConversation}
            size="sm"
            className="flex-1 gap-2 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white border-0 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova conversa
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggle} className="ml-2 text-white/50 hover:bg-white/10 hover:text-white shrink-0 h-8 w-8">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-white/30">
                <MessageSquare className="mx-auto mb-2 h-5 w-5" />
                Nenhuma conversa ainda
              </div>
            ) : (
              sessions.map((session: any) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center rounded-lg transition-colors",
                    session.id === currentSessionId
                      ? "bg-white/10"
                      : "hover:bg-white/[0.05]"
                  )}
                >
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "flex-1 text-left px-3 py-2.5 text-xs min-w-0",
                      session.id === currentSessionId
                        ? "text-white"
                        : "text-white/50 hover:text-white/70"
                    )}
                  >
                    <p className="truncate font-medium">{getSessionTitle(session)}</p>
                    <p className="mt-0.5 text-[10px] text-white/30">
                      {new Date(session.created_at).toLocaleDateString("pt-BR")} · {session.messages?.length || 0} msgs
                    </p>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white hover:bg-white/10 shrink-0 mr-1"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-white/10 bg-[hsl(220,25%,12%)] text-white min-w-[140px]">
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
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

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
    </>
  );
}
