import { NavLink, Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { Bot, MessageSquare, Settings, CreditCard, User, LayoutGrid, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";

function SidebarLink({ to, icon: Icon, label, count }: { to: string; icon: any; label: string; count?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-white"
            : "text-white/50 hover:bg-white/5 hover:text-white/70"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">
          {count.toString().padStart(2, "0")}
        </span>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const { data: customAgents = [] } = useCustomAgents();
  const { data: knowledgeBases = [] } = useKnowledgeBases();

  const { data: conversationCount = 0 } = useQuery({
    queryKey: ["conversation-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("chat_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      <AppHeader />
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-white/10 bg-[hsl(220,25%,5%)] p-4 md:block overflow-y-auto">
          <nav className="space-y-1">
            <SidebarLink to="/agentes" icon={LayoutGrid} label="Agentes" />
            <SidebarLink to="/meus-agentes" icon={Bot} label="Meus Agentes" count={customAgents.length} />
            <SidebarLink to="/conteudos" icon={Database} label="Conteúdos" count={knowledgeBases.length} />
            <SidebarLink to="/conversas" icon={MessageSquare} label="Conversas" count={conversationCount} />
          </nav>
          <div className="mt-8 space-y-1">
            <SidebarLink to="/configuracoes" icon={Settings} label="Configurações" />
            <SidebarLink to="/creditos" icon={CreditCard} label="Créditos" />
            <SidebarLink to="/conta" icon={User} label="Minha Conta" />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
