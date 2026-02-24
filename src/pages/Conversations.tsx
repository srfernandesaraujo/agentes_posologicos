import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Conversations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");

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
          agents(name, icon),
          messages(content, role, created_at)
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const agents = Array.from(
    new Map(
      sessions
        .filter((s: any) => s.agents)
        .map((s: any) => [s.agent_id, s.agents.name])
    ).entries()
  );

  const filtered = sessions.filter((s: any) => {
    if (agentFilter !== "all" && s.agent_id !== agentFilter) return false;
    if (search) {
      const lastMsg = s.messages?.[s.messages.length - 1]?.content || "";
      const agentName = s.agents?.name || "";
      const q = search.toLowerCase();
      return lastMsg.toLowerCase().includes(q) || agentName.toLowerCase().includes(q);
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Conversas</h1>
        <p className="text-white/50">Acompanhe todas as interações</p>
      </div>

      {/* Filters */}
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

      {/* Sessions list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <MessageSquare className="mb-4 h-12 w-12" />
          <p>Nenhuma conversa encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session: any) => {
            const lastMsg = session.messages?.[session.messages.length - 1];
            return (
              <button
                key={session.id}
                onClick={() => navigate(`/chat/${session.agent_id}?session=${session.id}`)}
                className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[hsl(174,62%,47%)]">
                    {session.agents?.name || "Agente desconhecido"}
                  </span>
                  <span className="text-xs text-white/30">
                    {new Date(session.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="text-sm text-white/60 truncate">
                  {lastMsg?.content || "Conversa vazia"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-white/30">
                    {session.messages?.length || 0} mensagens
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
