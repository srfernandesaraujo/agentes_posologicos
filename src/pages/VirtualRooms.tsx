import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Copy, DoorOpen } from "lucide-react";
import { toast } from "sonner";

interface VirtualRoom {
  id: string;
  user_id: string;
  name: string;
  description: string;
  pin: string;
  agent_id: string | null;
  is_active: boolean;
  created_at: string;
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function VirtualRooms() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: customAgents = [] } = useCustomAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<VirtualRoom | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState<string>("none");
  const [isActive, setIsActive] = useState(true);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["virtual-rooms", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_rooms" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as VirtualRoom[];
    },
    enabled: !!user,
  });

  const createRoom = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("virtual_rooms" as any)
        .insert({
          user_id: user!.id,
          name,
          description,
          pin: generatePin(),
          agent_id: agentId === "none" ? null : agentId,
          is_active: isActive,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virtual-rooms"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Sala criada!");
    },
    onError: () => toast.error("Erro ao criar sala"),
  });

  const updateRoom = useMutation({
    mutationFn: async () => {
      if (!editingRoom) return;
      const { error } = await supabase
        .from("virtual_rooms" as any)
        .update({
          name,
          description,
          agent_id: agentId === "none" ? null : agentId,
          is_active: isActive,
        } as any)
        .eq("id", editingRoom.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virtual-rooms"] });
      resetForm();
      setDialogOpen(false);
      setEditingRoom(null);
      toast.success("Sala atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar sala"),
  });

  const deleteRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("virtual_rooms" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virtual-rooms"] });
      toast.success("Sala excluída!");
    },
    onError: () => toast.error("Erro ao excluir sala"),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setAgentId("none");
    setIsActive(true);
  };

  const openEdit = (room: VirtualRoom) => {
    setEditingRoom(room);
    setName(room.name);
    setDescription(room.description);
    setAgentId(room.agent_id || "none");
    setIsActive(room.is_active);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingRoom(null);
    resetForm();
    setDialogOpen(true);
  };

  const publishedAgents = customAgents.filter((a: any) => a.status === "published");

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Salas Virtuais</h1>
          <p className="text-sm text-white/40">Gerencie salas para pacientes virtuais acessarem via PIN</p>
        </div>
        <Button onClick={openCreate} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white gap-2">
          <Plus className="h-4 w-4" /> Nova Sala
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <DoorOpen className="mb-4 h-12 w-12" />
          <p>Nenhuma sala virtual criada</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => {
            const linkedAgent = customAgents.find((a: any) => a.id === room.agent_id);
            return (
              <div key={room.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white truncate">{room.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${room.is_active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                      {room.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  {room.description && <p className="text-sm text-white/50 mb-2 truncate">{room.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      PIN: <span className="font-mono font-bold text-[hsl(14,90%,58%)]">{room.pin}</span>
                      <button onClick={() => { navigator.clipboard.writeText(room.pin); toast.success("PIN copiado!"); }}>
                        <Copy className="h-3 w-3" />
                      </button>
                    </span>
                    {linkedAgent && <span>Agente: {linkedAgent.name}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(room)} className="text-white/40 hover:text-white hover:bg-white/10">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm("Excluir esta sala?")) deleteRoom.mutate(room.id); }}
                    className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Editar Sala" : "Nova Sala Virtual"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Nome da Sala</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-white/[0.05] text-white" placeholder="Ex: Sala de Simulação - Turma A" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Descrição</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="border-white/10 bg-white/[0.05] text-white" placeholder="Breve descrição da sala..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Agente Vinculado</label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                  <SelectItem value="none">Nenhum</SelectItem>
                  {publishedAgents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Sala ativa</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button
              onClick={() => editingRoom ? updateRoom.mutate() : createRoom.mutate()}
              disabled={!name.trim() || createRoom.isPending || updateRoom.isPending}
              className="w-full bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white"
            >
              {editingRoom ? "Salvar Alterações" : "Criar Sala"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
