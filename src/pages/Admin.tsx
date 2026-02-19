import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Shield, Users, Bot, Coins, Search, Plus, Minus, ToggleLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export default function Admin() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");

  // Fetch all agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Toggle agent active
  const toggleAgent = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("agents").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      toast.success("Agente atualizado");
    },
  });

  // Grant credits
  const grantCredits = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const { error } = await supabase.from("credits_ledger").insert({
        user_id: userId,
        amount,
        type: "bonus",
        description: `Bônus admin: ${amount} créditos`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Créditos concedidos!");
    },
  });

  if (adminLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/agentes" replace />;
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      !userSearch ||
      p.display_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      p.user_id.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="container py-8">
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(14,90%,58%)]">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Painel Admin</h1>
        </div>
        <p className="text-white/50">Gerencie agentes, usuários e créditos</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {[
          { label: "Agentes", value: agents.length, icon: Bot, color: "hsl(174,62%,47%)" },
          { label: "Usuários", value: profiles.length, icon: Users, color: "hsl(199,89%,48%)" },
          { label: "Agentes Ativos", value: agents.filter((a) => a.active).length, icon: ToggleLeft, color: "hsl(152,60%,42%)" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              <span className="text-sm text-white/50">{stat.label}</span>
            </div>
            <p className="font-display text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Agents Management */}
      <div className="mb-8">
        <h2 className="font-display text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-[hsl(174,62%,47%)]" />
          Gerenciar Agentes
        </h2>
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                <p className="text-xs text-white/40">{agent.category} · {agent.credit_cost} crédito(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">{agent.active ? "Ativo" : "Inativo"}</span>
                <Switch
                  checked={agent.active}
                  onCheckedChange={(checked) => toggleAgent.mutate({ id: agent.id, active: checked })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Users Management */}
      <div>
        <h2 className="font-display text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-[hsl(199,89%,48%)]" />
          Usuários
        </h2>
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Buscar por nome..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="pl-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
          />
        </div>
        <div className="space-y-2">
          {filteredProfiles.map((profile) => (
            <div key={profile.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile.display_name || "Sem nome"}</p>
                <p className="text-xs text-white/30 truncate">{profile.user_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white gap-1"
                  onClick={() => grantCredits.mutate({ userId: profile.user_id, amount: 10 })}
                >
                  <Plus className="h-3 w-3" />
                  <Coins className="h-3 w-3" />
                  10
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white gap-1"
                  onClick={() => grantCredits.mutate({ userId: profile.user_id, amount: 50 })}
                >
                  <Plus className="h-3 w-3" />
                  <Coins className="h-3 w-3" />
                  50
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
