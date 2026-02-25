import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Plus, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  agentId: string;
  isCustom: boolean;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function ChatSidebar({
  agentId,
  isCustom,
  currentSessionId,
  onSelectSession,
  onNewConversation,
  collapsed,
  onToggle,
}: ChatSidebarProps) {
  const { user } = useAuth();

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

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 border-r border-white/10 bg-[hsl(220,25%,6%)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-white/50 hover:bg-white/10 hover:text-white mb-2"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewConversation}
          className="text-[hsl(174,62%,47%)] hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="ml-2 text-white/50 hover:bg-white/10 hover:text-white shrink-0 h-8 w-8"
        >
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
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2.5 text-xs transition-colors",
                  session.id === currentSessionId
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                )}
              >
                <p className="truncate font-medium">{getSessionTitle(session)}</p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  {new Date(session.created_at).toLocaleDateString("pt-BR")} · {session.messages?.length || 0} msgs
                </p>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
