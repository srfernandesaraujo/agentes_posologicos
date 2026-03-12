import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Bot, Check, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AgentConversationsPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (agents: { title: string; content: string }[]) => void;
  excludeAgentId?: string;
}

interface AgentWithSessions {
  id: string;
  name: string;
  isCustom: boolean;
  sessionCount: number;
  messageCount: number;
  sessions: {
    id: string;
    created_at: string;
    messages: { role: string; content: string; created_at: string }[];
  }[];
}

export function AgentConversationsPicker({ open, onClose, onSelect, excludeAgentId }: AgentConversationsPickerProps) {
  const { user } = useAuth();
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Fetch all sessions with messages
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["all-sessions-agent-picker", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, agent_id, created_at, messages(role, content, created_at)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && open,
  });

  const agentIds = [...new Set(sessions.map((s: any) => s.agent_id))];

  const { data: builtInAgents = [] } = useQuery({
    queryKey: ["agents-names-agent-picker", agentIds],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, name, icon").in("id", agentIds);
      return data || [];
    },
    enabled: agentIds.length > 0 && open,
  });

  const { data: customAgents = [] } = useQuery({
    queryKey: ["custom-agents-names-agent-picker", agentIds],
    queryFn: async () => {
      const { data } = await supabase.from("custom_agents").select("id, name").in("id", agentIds);
      return data || [];
    },
    enabled: agentIds.length > 0 && open,
  });

  // Group sessions by agent
  const agentsMap = new Map<string, AgentWithSessions>();
  for (const session of sessions as any[]) {
    if (session.agent_id === excludeAgentId) continue;
    if (!session.messages || session.messages.length === 0) continue;

    if (!agentsMap.has(session.agent_id)) {
      const builtIn = builtInAgents.find((a) => a.id === session.agent_id);
      const custom = customAgents.find((a) => a.id === session.agent_id);
      agentsMap.set(session.agent_id, {
        id: session.agent_id,
        name: builtIn?.name || custom?.name || "Agente desconhecido",
        isCustom: !!custom,
        sessionCount: 0,
        messageCount: 0,
        sessions: [],
      });
    }

    const agent = agentsMap.get(session.agent_id)!;
    agent.sessionCount += 1;
    agent.messageCount += session.messages.length;
    agent.sessions.push({
      id: session.id,
      created_at: session.created_at,
      messages: session.messages,
    });
  }

  const agents = Array.from(agentsMap.values())
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatAgentConversations = (agent: AgentWithSessions): string => {
    const parts: string[] = [`=== Todas as conversas com ${agent.name} (${agent.sessionCount} sessões, ${agent.messageCount} mensagens) ===`];

    for (const session of agent.sessions) {
      const sorted = [...session.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      parts.push(`\n--- Sessão de ${new Date(session.created_at).toLocaleDateString("pt-BR")} ---`);
      for (const m of sorted) {
        const label = m.role === "user" ? "Usuário" : agent.name;
        parts.push(`${label}: ${m.content}`);
      }
    }

    return parts.join("\n\n");
  };

  const handleConfirm = () => {
    const results: { title: string; content: string }[] = [];
    for (const agentId of selectedAgentIds) {
      const agent = agentsMap.get(agentId);
      if (!agent) continue;
      results.push({
        title: `🤖 ${agent.name} (${agent.sessionCount} conversas)`,
        content: formatAgentConversations(agent),
      });
    }
    onSelect(results);
    setSelectedAgentIds(new Set());
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelectedAgentIds(new Set()); setSearch(""); onClose(); } }}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(174,62%,47%)]" />
            Anexar agente completo
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Selecione um ou mais agentes para anexar todas as suas conversas como contexto.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar agente..."
            className="pl-9 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(174,62%,47%)] border-t-transparent" />
            </div>
          ) : agents.length === 0 ? (
            <div className="py-12 text-center text-sm text-white/30">
              <Bot className="mx-auto mb-2 h-8 w-8" />
              Nenhum agente com conversas disponível
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-3 transition-colors flex items-start gap-3",
                    selectedAgentIds.has(agent.id)
                      ? "bg-[hsl(174,62%,47%)]/15 border border-[hsl(174,62%,47%)]/30"
                      : "hover:bg-white/[0.05] border border-transparent"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
                    agent.isCustom ? "bg-[hsl(14,90%,58%)]/20" : "bg-[hsl(174,62%,47%)]/20"
                  )}>
                    <Bot className={cn(
                      "h-4 w-4",
                      agent.isCustom ? "text-[hsl(14,90%,58%)]" : "text-[hsl(174,62%,47%)]"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90">{agent.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {agent.sessionCount} {agent.sessionCount === 1 ? "conversa" : "conversas"} · {agent.messageCount} mensagens
                    </p>
                  </div>
                  {selectedAgentIds.has(agent.id) && (
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
            onClick={() => { setSelectedAgentIds(new Set()); setSearch(""); onClose(); }}
            className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedAgentIds.size === 0}
            className="flex-1 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white border-0"
          >
            <Users className="h-4 w-4 mr-2" />
            Anexar {selectedAgentIds.size > 0 ? `(${selectedAgentIds.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
