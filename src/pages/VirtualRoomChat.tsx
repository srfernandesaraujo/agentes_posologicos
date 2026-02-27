import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Bot, User, Loader2, Pill, Users, Radio } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface RoomMessage {
  id: string;
  room_id: string;
  sender_name: string;
  sender_email: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function VirtualRoomChat() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // Load room by PIN
  const { data: room, isLoading: roomLoading, error: roomError } = useQuery({
    queryKey: ["virtual-room-pin", pin],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("virtual_rooms")
        .select("*")
        .eq("pin", pin!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!pin,
  });

  const roomExpired = room?.room_expires_at && new Date(room.room_expires_at) < new Date();
  const agentExpired = room?.agent_expires_at && new Date(room.agent_expires_at) < new Date();

  // Load existing messages for this participant only
  useEffect(() => {
    if (!room?.id || !nameConfirmed || !participantEmail) return;
    const loadMessages = async () => {
      const { data, error } = await (supabase as any)
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .eq("sender_email", participantEmail)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setMessages(data);
      }
    };
    loadMessages();
  }, [room?.id, nameConfirmed, participantEmail]);

  // Subscribe to Realtime for new messages (only this participant's)
  useEffect(() => {
    if (!room?.id || !nameConfirmed || !participantEmail) return;

    const channel = supabase
      .channel(`room-messages-${room.id}-${participantEmail}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload: any) => {
          const newMsg = payload.new as RoomMessage;
          // Only show messages belonging to this participant
          if (newMsg.sender_email !== participantEmail) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, nameConfirmed, participantEmail]);

  // Presence tracking for participant count
  useEffect(() => {
    if (!room?.id || !nameConfirmed) return;

    const presenceChannel = supabase.channel(`room-presence-${room.id}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setParticipantCount(count);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ name: participantName });
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [room?.id, nameConfirmed, participantName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !room?.agent_id || loading) return;
    if (agentExpired) return;

    const text = input.trim();
    setInput("");
    setLoading(true);

    try {
      // Insert user message to DB (will be broadcast via Realtime)
      await (supabase as any).from("room_messages").insert({
        room_id: room.id,
        sender_name: participantName || "Anônimo",
        sender_email: participantEmail || "",
        role: "user",
        content: text,
      });

      // Build conversation history from last 20 messages
      const recentMessages = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.role === "user" ? `[${m.sender_name}]: ${m.content}` : m.content,
      }));

      // Call agent
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          agentId: room.agent_id,
          input: `[${participantName}]: ${text}`,
          isCustomAgent: true,
          isVirtualRoom: true,
          conversationHistory: recentMessages,
        },
      });

      if (error) throw error;

      // Insert assistant response to DB (tagged with same email)
      await (supabase as any).from("room_messages").insert({
        room_id: room.id,
        sender_name: "Assistente",
        sender_email: participantEmail,
        role: "assistant",
        content: data?.output || "Sem resposta.",
      });
    } catch {
      await (supabase as any).from("room_messages").insert({
        room_id: room.id,
        sender_name: "Sistema",
        sender_email: participantEmail,
        role: "assistant",
        content: "Erro ao processar a mensagem. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (roomLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(220,25%,5%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  // Room not found or expired
  if (roomError || !room || roomExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,25%,5%)] text-white gap-4">
        <p className="text-white/50">{roomExpired ? "Esta sala virtual foi encerrada." : "Sala não encontrada ou inativa."}</p>
        <Button onClick={() => navigate("/")} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          Voltar ao início
        </Button>
      </div>
    );
  }

  // Name entry screen
  if (!nameConfirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,25%,5%)] text-white gap-6 px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold">{room.name}</h1>
            <p className="mt-2 text-sm text-white/40">Sala Colaborativa • Paciente Virtual</p>
            {room.description && (
              <p className="mt-2 text-sm text-white/50">{room.description}</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/70">Seu nome (visível para todos)</label>
            <Input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="Ex: João Silva"
              className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/70">Seu e-mail</label>
            <Input
              type="email"
              value={participantEmail}
              onChange={(e) => setParticipantEmail(e.target.value)}
              placeholder="Ex: joao@email.com"
              className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && participantName.trim() && participantEmail.trim()) {
                  setNameConfirmed(true);
                }
              }}
            />
          </div>

          <Button
            onClick={() => setNameConfirmed(true)}
            disabled={!participantName.trim() || !participantEmail.trim()}
            className="w-full bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,42%)] text-white border-0"
          >
            Entrar na Sala
          </Button>

          <button
            onClick={() => navigate("/")}
            className="block w-full text-center text-sm text-white/30 hover:text-white/50 transition-colors"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,25%,5%)]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Pill className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-sm font-bold text-white truncate">{room.name}</h1>
            <p className="text-xs text-white/40">Sala Colaborativa • {participantName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
              <Radio className="h-3 w-3 text-green-400 animate-pulse" />
              <span className="text-xs text-white/60">Ao vivo</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
              <Users className="h-3 w-3 text-[hsl(174,62%,47%)]" />
              <span className="text-xs text-white/60">{participantCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
            <Bot className="h-12 w-12" />
            <p className="text-center">Envie uma mensagem para começar.<br />Todos na sala verão as perguntas e respostas em tempo real.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="max-w-[80%]">
              {msg.role === "user" && (
                <p className={`text-[11px] mb-1 text-right ${msg.sender_name === participantName ? "text-[hsl(14,90%,58%)]" : "text-[hsl(174,62%,47%)]"}`}>
                  {msg.sender_name === participantName ? "Você" : msg.sender_name}
                </p>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? msg.sender_name === participantName
                    ? "bg-[hsl(14,90%,58%)] text-white"
                    : "bg-[hsl(199,89%,48%)]/20 border border-[hsl(199,89%,48%)]/30 text-white/90"
                  : "bg-white/[0.05] border border-white/10 text-white/90"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
            {msg.role === "user" && (
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                msg.sender_name === participantName ? "bg-[hsl(14,90%,58%)]/20" : "bg-[hsl(199,89%,48%)]/20"
              }`}>
                <User className={`h-4 w-4 ${msg.sender_name === participantName ? "text-[hsl(14,90%,58%)]" : "text-[hsl(199,89%,48%)]"}`} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-white/50" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Agent expired notice */}
      {agentExpired && (
        <div className="border-t border-white/10 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
          O agente vinculado a esta sala expirou. Entre em contato com o professor.
        </div>
      )}

      {/* Input */}
      {!agentExpired && (
        <div className="border-t border-white/10 p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Digite sua mensagem..."
              rows={1}
              className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 resize-none min-h-[44px]"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
