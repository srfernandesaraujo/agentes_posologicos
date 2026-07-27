import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Send, Loader2, Clock, MessageCircle, Coins, Crown, Bot, DoorOpen, KeyRound, Activity, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: "open" | "in_progress" | "closed";
  priority: string;
  last_message_at: string;
  last_message_from: "user" | "admin";
  created_at: string;
}

interface TicketMessage {
  id: string;
  sender_role: "user" | "admin";
  message: string;
  created_at: string;
}

interface Diagnostics {
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_unlimited: boolean;
  plan_tier: string;
  credits_balance: number;
  custom_agents_count: number;
  virtual_rooms_count: number;
  api_keys: { provider: string; expires_at: string | null }[];
  recent_ai_usage: { provider: string; model: string; prompt_type: string; tokens_input: number; tokens_output: number; estimated_cost_usd: number; created_at: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral", tecnico: "Técnico", cobranca: "Cobrança", bug: "Bug", sugestao: "Sugestão",
};
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: "Aberto", className: "bg-blue-500/20 text-blue-300" },
  in_progress: { label: "Em andamento", className: "bg-amber-500/20 text-amber-300" },
  closed: { label: "Resolvido", className: "bg-green-500/20 text-green-300" },
};
const TIER_LABELS: Record<string, string> = {
  none: "Sem assinatura", basico: "Básico", pro: "Pro", institucional: "Institucional",
};

export function SupportTicketsPanel({ initialTicketId }: { initialTicketId?: string | null }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "closed">("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [autoOpenedInitial, setAutoOpenedInitial] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Ticket[];
    },
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (autoOpenedInitial || !initialTicketId || tickets.length === 0) return;
    const match = tickets.find((t) => t.id === initialTicketId);
    if (match) {
      setSelected(match);
      setAutoOpenedInitial(true);
    }
  }, [initialTicketId, tickets, autoOpenedInitial]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.display_name; });
      return map;
    },
  });

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const pendingCount = tickets.filter((t) => t.last_message_from === "user" && t.status !== "closed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold text-white flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-[hsl(174,62%,47%)]" />
          Suporte Técnico
          {pendingCount > 0 && (
            <span className="rounded-full bg-[hsl(14,90%,58%)]/20 text-[hsl(14,90%,58%)] px-2 py-0.5 text-xs font-semibold">
              {pendingCount} aguardando resposta
            </span>
          )}
        </h2>
        <div className="flex gap-1.5">
          {(["all", "open", "in_progress", "closed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white/70"
              )}
            >
              {f === "all" ? "Todos" : STATUS_LABELS[f].label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/30 py-8 text-center">Nenhum chamado {filter !== "all" ? `com status "${STATUS_LABELS[filter]?.label}"` : ""} encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const st = STATUS_LABELS[t.status];
            const needsAttention = t.last_message_from === "user" && t.status !== "closed";
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="w-full text-left flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {needsAttention && <span className="h-2 w-2 rounded-full bg-[hsl(14,90%,58%)] shrink-0" />}
                    <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {profileMap[t.user_id] || t.user_id.slice(0, 8)} · {CATEGORY_LABELS[t.category] || t.category}
                  </p>
                </div>
                <span className="text-xs text-white/30 flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" /> {new Date(t.last_message_at).toLocaleString("pt-BR")}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${st.className}`}>{st.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <AdminTicketDialog
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] })}
        />
      )}
    </div>
  );
}

function AdminTicketDialog({ ticket, onClose, onUpdated }: { ticket: Ticket; onClose: () => void; onUpdated: () => void }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["admin-ticket-messages", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages" as any)
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as TicketMessage[];
    },
    refetchInterval: 10_000,
  });

  const { data: diag, isLoading: diagLoading } = useQuery({
    queryKey: ["admin-user-diagnostics", ticket.user_id],
    queryFn: async () => invokeFunction<Diagnostics>("admin-user-diagnostics", { userId: ticket.user_id }),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await invokeFunction("support-ticket", { action: "reply", ticketId: ticket.id, message: reply.trim() });
      setReply("");
      await refetch();
      onUpdated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar resposta");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as Ticket["status"]);
    try {
      await invokeFunction("support-ticket", { action: "update-status", ticketId: ticket.id, status: newStatus });
      toast.success("Status atualizado");
      onUpdated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status");
      setStatus(ticket.status);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-3xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="truncate">{ticket.subject}</DialogTitle>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40 h-8 border-white/10 bg-white/[0.05] text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="closed">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[240px_1fr] flex-1 min-h-0">
          {/* Diagnostics panel */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 overflow-y-auto">
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Diagnóstico
            </h4>
            {diagLoading || !diag ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/30" />
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-1.5 text-white/70">
                  <Mail className="h-3.5 w-3.5 text-white/30" /> <span className="truncate">{diag.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-[hsl(38,92%,50%)]" />
                  <span className="text-white/70">
                    {diag.is_admin ? "Admin" : diag.is_unlimited ? "Ilimitado" : TIER_LABELS[diag.plan_tier] || diag.plan_tier}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-[hsl(14,90%,58%)]" />
                  <span className="text-white/70">{diag.credits_balance} créditos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-white/30" />
                  <span className="text-white/70">{diag.custom_agents_count} agentes próprios</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DoorOpen className="h-3.5 w-3.5 text-white/30" />
                  <span className="text-white/70">{diag.virtual_rooms_count} salas virtuais</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <KeyRound className="h-3.5 w-3.5 text-white/30" />
                    <span className="text-white/50">Chaves configuradas</span>
                  </div>
                  {diag.api_keys.length === 0 ? (
                    <p className="text-white/30 pl-5">Nenhuma</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 pl-5">
                      {diag.api_keys.map((k, i) => (
                        <span key={i} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/60">{k.provider}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-white/10 text-white/40 space-y-1">
                  <p>Cadastro: {new Date(diag.created_at).toLocaleDateString("pt-BR")}</p>
                  {diag.last_sign_in_at && <p>Último acesso: {new Date(diag.last_sign_in_at).toLocaleDateString("pt-BR")}</p>}
                </div>
                {diag.recent_ai_usage.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-white/50 mb-1">Uso recente de IA</p>
                    {diag.recent_ai_usage.slice(0, 5).map((u, i) => (
                      <p key={i} className="text-[10px] text-white/40 truncate">
                        {u.provider}/{u.model} — {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Thread */}
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 ${m.sender_role === "admin" ? "bg-[hsl(174,62%,47%)]/20 text-white" : "bg-white/[0.06] text-white"}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-white/40">
                      <MessageCircle className="h-3 w-3" />
                      {m.sender_role === "admin" ? "Você (suporte)" : "Cliente"} · {new Date(m.created_at).toLocaleString("pt-BR")}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2 pt-3 mt-2 border-t border-white/10">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder ao cliente..."
                rows={2}
                maxLength={5000}
                className="border-white/10 bg-white/[0.05] text-white resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              />
              <Button onClick={handleReply} disabled={sending || !reply.trim()} className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
