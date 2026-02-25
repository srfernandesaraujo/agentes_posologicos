import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bot, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (conversation: { title: string; content: string }) => void;
  excludeAgentId?: string;
}

interface SessionWithMessages {
  id: string;
  agent_id: string;
  created_at: string;
  messages: { role: string; content: string; created_at: string }[];
}

export function ConversationPicker({ open, onClose, onSelect, excludeAgentId }: ConversationPickerProps) {
  const { user } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Fetch all sessions with their messages grouped by agent
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["all-chat-sessions-picker", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`id, agent_id, created_at, messages(role, content, created_at)`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SessionWithMessages[];
    },
    enabled: !!user && open,
  });

  // Fetch agent names for built-in agents
  const agentIds = [...new Set(sessions.map((s) => s.agent_id))];

  const { data: builtInAgents = [] } = useQuery({
    queryKey: ["agents-names-picker", agentIds],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, name, icon").in("id", agentIds);
      return data || [];
    },
    enabled: agentIds.length > 0 && open,
  });

  const { data: customAgents = [] } = useQuery({
    queryKey: ["custom-agents-names-picker", agentIds],
    queryFn: async () => {
      const { data } = await supabase.from("custom_agents").select("id, name").in("id", agentIds);
      return data || [];
    },
    enabled: agentIds.length > 0 && open,
  });

  const getAgentName = (agentId: string) => {
    const builtIn = builtInAgents.find((a) => a.id === agentId);
    if (builtIn) return builtIn.name;
    const custom = customAgents.find((a) => a.id === agentId);
    if (custom) return custom.name;
    return "Agente desconhecido";
  };

  const isCustomAgent = (agentId: string) => customAgents.some((a) => a.id === agentId);

  // Filter out sessions from the current agent and empty sessions
  const filteredSessions = sessions.filter(
    (s) => s.agent_id !== excludeAgentId && s.messages && s.messages.length > 0
  );

  const getSessionTitle = (session: SessionWithMessages) => {
    const sorted = [...session.messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const firstUser = sorted.find((m) => m.role === "user");
    if (firstUser) {
      return firstUser.content.length > 60
        ? firstUser.content.substring(0, 60) + "..."
        : firstUser.content;
    }
    return "Conversa sem título";
  };

  const formatConversationAsText = (session: SessionWithMessages) => {
    const agentName = getAgentName(session.agent_id);
    const sorted = [...session.messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const lines = sorted.map((m) => {
      const label = m.role === "user" ? "Usuário" : agentName;
      return `${label}: ${m.content}`;
    });
    return `--- Conversa com ${agentName} (${new Date(session.created_at).toLocaleDateString("pt-BR")}) ---\n\n${lines.join("\n\n")}`;
  };

  const handleConfirm = () => {
    if (!selectedSessionId) return;
    const session = filteredSessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    const agentName = getAgentName(session.agent_id);
    const title = `Conversa: ${agentName} - ${new Date(session.created_at).toLocaleDateString("pt-BR")}`;
    const content = formatConversationAsText(session);
    onSelect({ title, content });
    setSelectedSessionId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelectedSessionId(null); onClose(); } }}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[hsl(174,62%,47%)]" />
            Anexar conversa
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Selecione uma conversa de outro agente para anexar como contexto.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(174,62%,47%)] border-t-transparent" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-white/30">
              <MessageSquare className="mx-auto mb-2 h-8 w-8" />
              Nenhuma conversa disponível
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-3 transition-colors flex items-start gap-3",
                    session.id === selectedSessionId
                      ? "bg-[hsl(174,62%,47%)]/15 border border-[hsl(174,62%,47%)]/30"
                      : "hover:bg-white/[0.05] border border-transparent"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
                    isCustomAgent(session.agent_id) ? "bg-[hsl(14,90%,58%)]/20" : "bg-[hsl(174,62%,47%)]/20"
                  )}>
                    <Bot className={cn(
                      "h-4 w-4",
                      isCustomAgent(session.agent_id) ? "text-[hsl(14,90%,58%)]" : "text-[hsl(174,62%,47%)]"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/70">{getAgentName(session.agent_id)}</p>
                    <p className="text-xs text-white/40 truncate mt-0.5">{getSessionTitle(session)}</p>
                    <p className="text-[10px] text-white/25 mt-1">
                      {new Date(session.created_at).toLocaleDateString("pt-BR")} · {session.messages.length} msgs
                    </p>
                  </div>
                  {session.id === selectedSessionId && (
                    <Check className="h-4 w-4 text-[hsl(174,62%,47%)] shrink-0 mt-1" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-3 pt-2 border-t border-white/10">
          <Button
            variant="outline"
            onClick={() => { setSelectedSessionId(null); onClose(); }}
            className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSessionId}
            className="flex-1 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white border-0"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Anexar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
