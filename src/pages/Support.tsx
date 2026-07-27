import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFunction } from "@/lib/invokeFunction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Plus, Send, Loader2, CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: "open" | "in_progress" | "closed";
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

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  tecnico: "Técnico",
  cobranca: "Cobrança",
  bug: "Bug",
  sugestao: "Sugestão",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: "Aberto", className: "bg-blue-500/20 text-blue-300" },
  in_progress: { label: "Em andamento", className: "bg-amber-500/20 text-amber-300" },
  closed: { label: "Resolvido", className: "bg-green-500/20 text-green-300" },
};

export default function Support() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("geral");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Ticket[];
    },
    enabled: !!user,
    refetchInterval: 20_000,
  });

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return;
    setCreating(true);
    try {
      await invokeFunction("support-ticket", { action: "create", subject: subject.trim(), category, message: message.trim() });
      toast.success("Chamado aberto! Vamos responder em breve.");
      setCreateOpen(false);
      setSubject("");
      setMessage("");
      setCategory("geral");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir chamado");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="h-5 w-5 text-[hsl(174,62%,47%)]" />
            <h1 className="font-display text-2xl font-bold text-white">Suporte Técnico</h1>
          </div>
          <p className="text-sm text-white/40">Abra um chamado e acompanhe o andamento por aqui</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white gap-2">
          <Plus className="h-4 w-4" /> Novo Chamado
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <LifeBuoy className="mb-4 h-12 w-12" />
          <p>Nenhum chamado aberto ainda</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tickets.map((t) => {
            const st = STATUS_LABELS[t.status];
            const needsAttention = t.last_message_from === "admin" && t.status !== "closed";
            return (
              <button
                key={t.id}
                onClick={() => setOpenTicket(t)}
                className="text-left rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-white truncate">{t.subject}</h3>
                    {needsAttention && <span className="h-2 w-2 rounded-full bg-[hsl(14,90%,58%)] shrink-0" title="Nova resposta" />}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${st.className}`}>{st.label}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                  <span>{CATEGORY_LABELS[t.category] || t.category}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(t.last_message_at).toLocaleString("pt-BR")}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Chamado de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Assunto</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="border-white/10 bg-white/[0.05] text-white" placeholder="Resumo do problema" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Descreva o problema</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={5000} className="border-white/10 bg-white/[0.05] text-white" placeholder="Conte com detalhes o que está acontecendo..." />
            </div>
            <Button onClick={handleCreate} disabled={creating || !subject.trim() || !message.trim()} className="w-full bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Chamado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {openTicket && (
        <TicketThread
          ticket={openTicket}
          onClose={() => setOpenTicket(null)}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ["support-tickets"] })}
        />
      )}
    </div>
  );
}

function TicketThread({ ticket, onClose, onUpdated }: { ticket: Ticket; onClose: () => void; onUpdated: () => void }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["support-ticket-messages", ticket.id],
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

  const st = STATUS_LABELS[ticket.status];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="truncate">{ticket.subject}</DialogTitle>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${st.className}`}>{st.label}</span>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-2.5 ${m.sender_role === "admin" ? "bg-white/[0.06] text-white" : "bg-[hsl(174,62%,47%)]/20 text-white"}`}>
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-white/40">
                  <MessageCircle className="h-3 w-3" />
                  {m.sender_role === "admin" ? "Suporte" : "Você"} · {new Date(m.created_at).toLocaleString("pt-BR")}
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {ticket.status === "closed" ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Este chamado foi encerrado.
          </div>
        ) : (
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva sua resposta..."
              rows={2}
              maxLength={5000}
              className="border-white/10 bg-white/[0.05] text-white resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
            />
            <Button onClick={handleReply} disabled={sending || !reply.trim()} className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
