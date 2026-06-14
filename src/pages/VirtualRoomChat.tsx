import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Bot, User, Loader2, Pill, Users, Radio, HelpCircle, Megaphone } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Direct REST helper to bypass SDK auth issues for anonymous users
async function roomMessagesRest(method: "GET" | "POST", params?: Record<string, string>, body?: any) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/room_messages`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  if (method === "POST") headers["Prefer"] = "return=representation";
  if (method === "GET") url.searchParams.set("order", "created_at.asc");

  const resp = await fetch(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!resp.ok) {
    console.error("[VirtualRoom] REST error:", resp.status, await resp.text());
    return { data: null, error: { message: `REST ${resp.status}` } };
  }
  const data = await resp.json();
  return { data, error: null };
}

interface RoomMessage {
  id: string;
  room_id: string;
  sender_name: string;
  sender_email?: string | null;
  participant_token?: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  is_broadcast?: boolean;
  is_question?: boolean;
  is_anonymous?: boolean;
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

  // Per-session anonymous identity. Kept locally so the server never sees the email
  // of anonymous participants. Persisted per-pin so a reload keeps the same history.
  const participantToken = (() => {
    if (!pin) return "";
    const key = `vroom-token-${pin}`;
    let t = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!t) {
      t = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `t-${Date.now()}-${Math.random()}`;
      if (typeof window !== "undefined") localStorage.setItem(key, t);
    }
    return t;
  })();

  // Load room by PIN
  const { data: room, isLoading: roomLoading, error: roomError } = useQuery({
    queryKey: ["virtual-room-pin", pin],
    queryFn: async () => {
      console.log("[VirtualRoom] Fetching room by PIN:", pin);
      const { data, error } = await supabase.rpc("get_room_by_pin", { p_pin: pin! });
      console.log("[VirtualRoom] RPC result:", { data, error });
      if (error) throw error;
      if (!data || (data as any[]).length === 0) throw new Error("Room not found");
      const roomData = (data as any[])[0];
      console.log("[VirtualRoom] Room data:", roomData);
      return roomData;
    },
    enabled: !!pin,
  });

  const roomExpired = room?.room_expires_at && new Date(room.room_expires_at) < new Date();
  const agentExpired = room?.agent_expires_at && new Date(room.agent_expires_at) < new Date();
  const liveMode = !!room?.live_mode;

  // Load existing messages for this participant only via SECURITY DEFINER RPC.
  // The RPC returns only this participant's messages plus broadcast messages —
  // it never exposes other participants' emails.
  useEffect(() => {
    if (!room?.id || !nameConfirmed || !participantToken) return;
    const loadMessages = async () => {
      const { data, error } = await supabase.rpc("get_my_room_messages", {
        _room_id: room.id,
        _token: participantToken,
      });
      if (error) {
        console.error("[VirtualRoom] load messages error", error);
        return;
      }
      const rows = (data || []) as RoomMessage[];
      setMessages(liveMode ? rows.filter((m) => m.is_broadcast) : rows);
    };
    loadMessages();
  }, [room?.id, nameConfirmed, participantToken, liveMode]);

  // Subscribe to Realtime for new messages (only this participant's)
  useEffect(() => {
    if (!room?.id || !nameConfirmed || !participantEmail) return;

    const channel = supabase
      .channel(`room-messages-${room.id}-${participantToken}`)
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
          // In live mode, students only see broadcast messages
          if (liveMode) {
            if (!newMsg.is_broadcast) return;
          } else {
            // Normal mode: only show this participant's messages (matched by token)
            if (newMsg.participant_token !== participantToken) return;
          }
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
  }, [room?.id, nameConfirmed, participantToken, liveMode]);

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
    if (!input.trim() || loading) return;
    if (!liveMode && !room?.agent_id) return;
    if (agentExpired) return;

    const text = input.trim();
    setInput("");
    setLoading(true);

    // LIVE MODE: students submit anonymous questions only (no AI call)
    if (liveMode) {
      try {
        const { error: qErr } = await roomMessagesRest("POST", undefined, {
          room_id: room!.id,
          sender_name: "Anônimo",
          role: "user",
          content: text,
          is_question: true,
          is_anonymous: true,
          participant_token: participantToken,
        });
        if (qErr) {
          toast.error("Não foi possível enviar sua dúvida. Tente novamente.");
          setInput(text);
        } else {
          toast.success("Dúvida enviada anonimamente ao professor.");
        }
      } catch (e) {
        console.error("[VirtualRoom] anon question error", e);
        toast.error("Erro ao enviar dúvida.");
        setInput(text);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // Insert user message to DB (will be broadcast via Realtime)
      const { error: insertError } = await roomMessagesRest("POST", undefined, {
        room_id: room.id,
        sender_name: participantName || "Anônimo",
        role: "user",
        content: text,
        participant_token: participantToken,
      });
      console.log("[VirtualRoom] User message insert result:", { insertError });

      // Build conversation history from last 20 messages
      const recentMessages = messages.slice(-10).map((m) => ({
        role: m.role,
        // agent-chat rejects history items >10k chars
        content: ((m.role === "user" ? `[${m.sender_name}]: ${m.content}` : m.content) || "").slice(0, 8000),
      }));

      // Call agent via direct fetch (bypass SDK auth header for anonymous users)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      console.log("[VirtualRoom] Calling agent-chat...", { agentId: room.agent_id, roomId: room.id });
      
      const response = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          agentId: room.agent_id,
          input: `[${participantName}]: ${text}`,
          isCustomAgent: true,
          isVirtualRoom: true,
          roomId: room.id,
          participantToken,
          conversationHistory: recentMessages,
        }),
      });

      console.log("[VirtualRoom] agent-chat response status:", response.status);
      const data = await response.json();
      console.log("[VirtualRoom] agent-chat response data:", data);

      if (!response.ok) throw new Error(data?.error || "Agent error");

      // Insert assistant response to DB (tagged with same participant token)
      const { error: assistantInsertError } = await roomMessagesRest("POST", undefined, {
        room_id: room.id,
        sender_name: "Assistente",
        role: "assistant",
        content: data?.output || "Sem resposta.",
        participant_token: participantToken,
      });
      console.log("[VirtualRoom] Assistant message insert result:", { assistantInsertError });
    } catch (err: any) {
      console.error("[VirtualRoom] Error in handleSend:", err);
      const errorMsg: RoomMessage = {
        id: crypto.randomUUID(),
        room_id: room.id,
        sender_name: "Sistema",
        role: "assistant",
        content: "Erro ao processar a mensagem. Tente novamente.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      
      await roomMessagesRest("POST", undefined, {
        room_id: room.id,
        sender_name: "Sistema",
        role: "assistant",
        content: "Erro ao processar a mensagem. Tente novamente.",
        participant_token: participantToken,
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
        <Button onClick={() => navigate("/")} variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
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
            <p className="mt-2 text-sm text-white/40">Sala Colaborativa • Sala Virtual</p>
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
            {liveMode ? (
              <div className="flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1">
                <Megaphone className="h-3 w-3 text-red-400 animate-pulse" />
                <span className="text-xs font-medium text-red-200">Aula ao Vivo</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                <Radio className="h-3 w-3 text-green-400 animate-pulse" />
                <span className="text-xs text-white/60">Ao vivo</span>
              </div>
            )}
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
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
          {liveMode && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-white/50">
              <HelpCircle className="h-3 w-3" />
              Modo Aula ao Vivo — sua dúvida será enviada de forma anônima ao professor.
            </p>
          )}
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
              placeholder={liveMode ? "Escreva sua dúvida anônima..." : "Digite sua mensagem..."}
              rows={1}
              className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 resize-none min-h-[44px]"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white shrink-0"
            >
              {liveMode ? <HelpCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
