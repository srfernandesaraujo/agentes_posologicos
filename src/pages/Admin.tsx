import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { SUBSCRIPTION_TIERS, TierKey } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Users, Bot, Coins, Search, Plus, ToggleLeft, DoorOpen, Clock, Edit2,
  TrendingUp, CreditCard, BarChart3, Activity, UserPlus, XCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

const PRODUCT_NAMES: Record<string, string> = {};
for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
  PRODUCT_NAMES[tier.product_id] = tier.name;
}

const CHART_COLORS = [
  "hsl(174, 62%, 47%)",
  "hsl(199, 89%, 48%)",
  "hsl(14, 90%, 58%)",
  "hsl(152, 60%, 42%)",
  "hsl(280, 60%, 55%)",
  "hsl(45, 90%, 55%)",
];

export default function Admin() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [roomAgentId, setRoomAgentId] = useState("none");
  const [agentExpiresAt, setAgentExpiresAt] = useState("");
  const [roomExpiresAt, setRoomExpiresAt] = useState("");
  const [roomActive, setRoomActive] = useState(true);

  // Analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-analytics");
      if (error) throw error;
      return data as {
        stripe: {
          activeSubscriptions: number;
          canceledSubscriptions: number;
          subscriptionsByProduct: Record<string, number>;
          mrrCents: number;
          revenueThisMonthCents: number;
        };
        users: { total: number; newThisWeek: number };
        usage: {
          totalCreditsUsed: number;
          totalCreditsPurchased: number;
          totalSessions: number;
          totalCustomAgents: number;
          agentUsage: Record<string, number>;
          dailyUsage: Record<string, number>;
        };
      };
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  // Existing queries
  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: allRooms = [] } = useQuery({
    queryKey: ["admin-virtual-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_rooms" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: isAdmin,
  });

  const { data: allCustomAgents = [] } = useQuery({
    queryKey: ["admin-custom-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_agents" as any)
        .select("*")
        .eq("status", "published")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: isAdmin,
  });

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
    onSuccess: () => toast.success("Créditos concedidos!"),
  });

  const updateRoomAdmin = useMutation({
    mutationFn: async () => {
      if (!editingRoom) return;
      const updateData: any = { is_active: roomActive };
      if (roomAgentId !== "none") {
        updateData.agent_id = roomAgentId;
        updateData.agent_expires_at = agentExpiresAt ? new Date(agentExpiresAt).toISOString() : null;
      } else {
        updateData.agent_id = null;
        updateData.agent_expires_at = null;
      }
      updateData.room_expires_at = roomExpiresAt ? new Date(roomExpiresAt).toISOString() : null;
      const { error } = await supabase.from("virtual_rooms" as any).update(updateData).eq("id", editingRoom.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-virtual-rooms"] });
      setRoomDialogOpen(false);
      setEditingRoom(null);
      toast.success("Sala atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar sala"),
  });

  const openRoomEdit = (room: any) => {
    setEditingRoom(room);
    setRoomAgentId(room.agent_id || "none");
    setAgentExpiresAt(room.agent_expires_at ? new Date(room.agent_expires_at).toISOString().slice(0, 16) : "");
    setRoomExpiresAt(room.room_expires_at ? new Date(room.room_expires_at).toISOString().slice(0, 16) : "");
    setRoomActive(room.is_active);
    setRoomDialogOpen(true);
  };

  if (adminLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/agentes" replace />;

  const filteredProfiles = profiles.filter(
    (p) =>
      !userSearch ||
      p.display_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      p.user_id.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Chart data
  const dailyUsageData = analytics
    ? Object.entries(analytics.usage.dailyUsage)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date: date.slice(5), interações: count }))
    : [];

  const agentUsageData = analytics
    ? Object.entries(analytics.usage.agentUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, uso: count }))
    : [];

  const subsByPlanData = analytics
    ? Object.entries(analytics.stripe.subscriptionsByProduct).map(([prodId, count]) => ({
        name: PRODUCT_NAMES[prodId] || prodId.slice(0, 10),
        value: count,
      }))
    : [];

  const formatBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  return (
    <div className="container py-8">
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(14,90%,58%)]">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Painel Admin</h1>
        </div>
        <p className="text-white/50">Gerencie agentes, usuários, assinaturas e analise métricas de uso</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="bg-white/[0.05] border border-white/10">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="agents" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
            <Bot className="h-4 w-4 mr-1.5" /> Agentes
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
            <Users className="h-4 w-4 mr-1.5" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="rooms" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
            <DoorOpen className="h-4 w-4 mr-1.5" /> Salas
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD TAB */}
        <TabsContent value="dashboard" className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-white/40" />
            </div>
          ) : analytics ? (
            <>
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Receita (30d)", value: formatBRL(analytics.stripe.revenueThisMonthCents), icon: CreditCard, color: "hsl(152,60%,42%)" },
                  { label: "MRR", value: formatBRL(analytics.stripe.mrrCents), icon: TrendingUp, color: "hsl(174,62%,47%)" },
                  { label: "Assinantes Ativos", value: analytics.stripe.activeSubscriptions, icon: Activity, color: "hsl(199,89%,48%)" },
                  { label: "Cancelamentos", value: analytics.stripe.canceledSubscriptions, icon: XCircle, color: "hsl(0,72%,51%)" },
                  { label: "Total de Usuários", value: analytics.users.total, icon: Users, color: "hsl(199,89%,48%)" },
                  { label: "Novos (7 dias)", value: analytics.users.newThisWeek, icon: UserPlus, color: "hsl(152,60%,42%)" },
                  { label: "Créditos Consumidos", value: analytics.usage.totalCreditsUsed.toFixed(1), icon: Coins, color: "hsl(14,90%,58%)" },
                  { label: "Sessões de Chat", value: analytics.usage.totalSessions, icon: BarChart3, color: "hsl(280,60%,55%)" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                      <span className="text-sm text-white/50">{stat.label}</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Daily Usage */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-4 text-sm font-semibold text-white/70">Interações por dia (últimos 30 dias)</h3>
                  {dailyUsageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailyUsageData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(220,25%,10%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}
                        />
                        <Bar dataKey="interações" fill="hsl(174,62%,47%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-white/30 py-10 text-center">Sem dados de uso ainda</p>
                  )}
                </div>

                {/* Agent usage */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-4 text-sm font-semibold text-white/70">Top Agentes por uso</h3>
                  {agentUsageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={agentUsageData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(220,25%,10%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}
                        />
                        <Bar dataKey="uso" fill="hsl(199,89%,48%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-white/30 py-10 text-center">Sem dados de uso ainda</p>
                  )}
                </div>
              </div>

              {/* Subscriptions by plan */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-4 text-sm font-semibold text-white/70">Assinantes por Plano</h3>
                  {subsByPlanData.length > 0 ? (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="50%" height={200}>
                        <PieChart>
                          <Pie data={subsByPlanData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                            {subsByPlanData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(220,25%,10%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {subsByPlanData.map((item, i) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-sm text-white/60">{item.name}</span>
                            <span className="text-sm font-semibold text-white">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/30 py-10 text-center">Nenhum assinante ainda</p>
                  )}
                </div>

                {/* Summary stats */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-4 text-sm font-semibold text-white/70">Resumo Geral</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Agentes Nativos", value: agents.length },
                      { label: "Agentes Personalizados", value: analytics.usage.totalCustomAgents },
                      { label: "Salas Virtuais", value: allRooms.length },
                      { label: "Créditos Comprados/Assinados", value: analytics.usage.totalCreditsPurchased.toFixed(0) },
                      { label: "Taxa de Conversão", value: analytics.stripe.activeSubscriptions > 0 && analytics.users.total > 0 ? `${((analytics.stripe.activeSubscriptions / analytics.users.total) * 100).toFixed(1)}%` : "0%" },
                      { label: "Churn (cancelados/ativos+cancelados)", value: (analytics.stripe.activeSubscriptions + analytics.stripe.canceledSubscriptions) > 0 ? `${((analytics.stripe.canceledSubscriptions / (analytics.stripe.activeSubscriptions + analytics.stripe.canceledSubscriptions)) * 100).toFixed(1)}%` : "0%" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-white/50">{item.label}</span>
                        <span className="text-sm font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* AGENTS TAB */}
        <TabsContent value="agents" className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white flex items-center gap-2">
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
                  <Switch checked={agent.active} onCheckedChange={(checked) => toggleAgent.mutate({ id: agent.id, active: checked })} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(199,89%,48%)]" />
            Usuários
          </h2>
          <div className="relative max-w-md">
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
                    size="sm" variant="outline"
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white gap-1"
                    onClick={() => grantCredits.mutate({ userId: profile.user_id, amount: 10 })}
                  >
                    <Plus className="h-3 w-3" /><Coins className="h-3 w-3" />10
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white gap-1"
                    onClick={() => grantCredits.mutate({ userId: profile.user_id, amount: 50 })}
                  >
                    <Plus className="h-3 w-3" /><Coins className="h-3 w-3" />50
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ROOMS TAB */}
        <TabsContent value="rooms" className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-[hsl(14,90%,58%)]" />
            Salas Virtuais
          </h2>
          {allRooms.length === 0 ? (
            <p className="text-sm text-white/30">Nenhuma sala virtual criada.</p>
          ) : (
            <div className="space-y-2">
              {allRooms.map((room: any) => {
                const agent = allCustomAgents.find((a: any) => a.id === room.agent_id);
                const agentExpired = room.agent_expires_at && new Date(room.agent_expires_at) < new Date();
                const roomExpired = room.room_expires_at && new Date(room.room_expires_at) < new Date();
                const owner = profiles.find((p) => p.user_id === room.user_id);
                return (
                  <div key={room.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{room.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          room.is_active && !roomExpired ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {room.is_active && !roomExpired ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <p className="text-xs text-white/30">
                        Dono: {owner?.display_name || room.user_id.slice(0, 8)} · PIN: {room.pin}
                        {agent && ` · Agente: ${agent.name}`}
                        {agentExpired && " (agente expirado)"}
                      </p>
                      {room.agent_expires_at && !agentExpired && (
                        <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> Agente ativo até {new Date(room.agent_expires_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openRoomEdit(room)} className="text-white/40 hover:text-white hover:bg-white/10">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Room Edit Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Sala (Admin)</DialogTitle>
          </DialogHeader>
          {editingRoom && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                <p className="text-sm font-medium text-white">{editingRoom.name}</p>
                <p className="text-xs text-white/40">PIN: {editingRoom.pin}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Vincular Agente</label>
                <Select value={roomAgentId} onValueChange={setRoomAgentId}>
                  <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {allCustomAgents.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {roomAgentId !== "none" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Agente ativo até
                  </label>
                  <Input type="datetime-local" value={agentExpiresAt} onChange={(e) => setAgentExpiresAt(e.target.value)} className="border-white/10 bg-white/[0.05] text-white [color-scheme:dark]" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Sala aberta até
                </label>
                <Input type="datetime-local" value={roomExpiresAt} onChange={(e) => setRoomExpiresAt(e.target.value)} className="border-white/10 bg-white/[0.05] text-white [color-scheme:dark]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Sala ativa</span>
                <Switch checked={roomActive} onCheckedChange={setRoomActive} />
              </div>
              <Button onClick={() => updateRoomAdmin.mutate()} disabled={updateRoomAdmin.isPending} className="w-full bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
