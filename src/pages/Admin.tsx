import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Shield, Users, Bot, Coins, Search, Plus, ToggleLeft, DoorOpen, Clock, Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export default function Admin() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");

  // Virtual rooms admin
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [roomAgentId, setRoomAgentId] = useState("none");
  const [agentHours, setAgentHours] = useState("24");
  const [roomHours, setRoomHours] = useState("");
  const [roomActive, setRoomActive] = useState(true);

  // Fetch all agents
  const { data: agents = [] } = useQuery({
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

  // Fetch ALL virtual rooms (admin sees all)
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

  // Fetch all custom agents (admin sees all for linking)
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

  // Update virtual room (admin)
  const updateRoomAdmin = useMutation({
    mutationFn: async () => {
      if (!editingRoom) return;
      const updateData: any = {
        is_active: roomActive,
      };

      if (roomAgentId !== "none" && roomAgentId !== (editingRoom.agent_id || "none")) {
        updateData.agent_id = roomAgentId;
        const hours = parseInt(agentHours) || 24;
        updateData.agent_expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      } else if (roomAgentId === "none") {
        updateData.agent_id = null;
        updateData.agent_expires_at = null;
      }

      if (roomHours) {
        const hours = parseInt(roomHours);
        if (hours > 0) {
          updateData.room_expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }
      }

      const { error } = await supabase
        .from("virtual_rooms" as any)
        .update(updateData)
        .eq("id", editingRoom.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-virtual-rooms"] });
      setRoomDialogOpen(false);
      setEditingRoom(null);
      toast.success("Sala atualizada pelo admin!");
    },
    onError: () => toast.error("Erro ao atualizar sala"),
  });

  const openRoomEdit = (room: any) => {
    setEditingRoom(room);
    setRoomAgentId(room.agent_id || "none");
    setAgentHours("24");
    setRoomHours("");
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
        <p className="text-white/50">Gerencie agentes, usuários, créditos e salas virtuais</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        {[
          { label: "Agentes", value: agents.length, icon: Bot, color: "hsl(174,62%,47%)" },
          { label: "Usuários", value: profiles.length, icon: Users, color: "hsl(199,89%,48%)" },
          { label: "Agentes Ativos", value: agents.filter((a) => a.active).length, icon: ToggleLeft, color: "hsl(152,60%,42%)" },
          { label: "Salas Virtuais", value: allRooms.length, icon: DoorOpen, color: "hsl(14,90%,58%)" },
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

      {/* Virtual Rooms Admin */}
      <div className="mb-8">
        <h2 className="font-display text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <DoorOpen className="h-5 w-5 text-[hsl(14,90%,58%)]" />
          Salas Virtuais (Admin)
        </h2>
        <p className="text-sm text-white/40 mb-4">
          Gerencie todas as salas virtuais: vincule agentes, defina tempo de atividade e abertura das salas.
        </p>
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
                    {room.room_expires_at && (
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${roomExpired ? "text-red-400" : "text-blue-400"}`}>
                        <Clock className="h-3 w-3" /> Sala {roomExpired ? "encerrada" : "aberta até"} {new Date(room.room_expires_at).toLocaleString("pt-BR")}
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

      {/* Admin Room Edit Dialog */}
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
                    <Clock className="h-3.5 w-3.5" /> Tempo de atividade do agente (horas)
                  </label>
                  <Input
                    type="number"
                    value={agentHours}
                    onChange={(e) => setAgentHours(e.target.value)}
                    min="1"
                    className="border-white/10 bg-white/[0.05] text-white"
                    placeholder="24"
                  />
                  <p className="mt-1 text-xs text-white/30">Defina por quantas horas o agente permanecerá ativo nesta sala</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Tempo de abertura da sala (horas)
                </label>
                <Input
                  type="number"
                  value={roomHours}
                  onChange={(e) => setRoomHours(e.target.value)}
                  min="1"
                  className="border-white/10 bg-white/[0.05] text-white"
                  placeholder="Deixe vazio para não definir"
                />
                <p className="mt-1 text-xs text-white/30">Defina por quanto tempo a sala permanecerá aberta (deixe vazio para permanente)</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Sala ativa</span>
                <Switch checked={roomActive} onCheckedChange={setRoomActive} />
              </div>

              <Button
                onClick={() => updateRoomAdmin.mutate()}
                disabled={updateRoomAdmin.isPending}
                className="w-full bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white"
              >
                Salvar Alterações (Admin)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
