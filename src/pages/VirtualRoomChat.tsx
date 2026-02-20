import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Bot, User, Loader2, Pill } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function VirtualRoomChat() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: room, isLoading: roomLoading, error: roomError } = useQuery({
    queryKey: ["virtual-room-pin", pin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_rooms" as any)
        .select("*")
        .eq("pin", pin!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!pin,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check if agent or room has expired
  const agentExpired = room?.agent_expires_at && new Date(room.agent_expires_at) < new Date();
  const roomExpired = room?.room_expires_at && new Date(room.room_expires_at) < new Date();

  const handleSend = async () => {
    if (!input.trim() || !room?.agent_id) return;
    if (agentExpired) {
      setMessages((prev) => [...prev, { role: "assistant", content: "O agente vinculado a esta sala expirou. Entre em contato com o professor." }]);
      return;
    }
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          agentId: room.agent_id,
          input: userMsg.content,
          isCustomAgent: true,
          isVirtualRoom: true,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      setMessages((prev) => [...prev, { role: "assistant", content: data.output || "Sem resposta." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao processar a mensagem. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  if (roomLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(220,25%,5%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

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

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,25%,5%)]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
          <Pill className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="font-display text-sm font-bold text-white">{room.name}</h1>
          <p className="text-xs text-white/40">Sala Virtual • Paciente Virtual</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
            <Bot className="h-12 w-12" />
            <p>Envie uma mensagem para começar a interação</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-[hsl(14,90%,58%)] text-white"
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
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <User className="h-4 w-4 text-white/60" />
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

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 resize-none min-h-[44px]"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
