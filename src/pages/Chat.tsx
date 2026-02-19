import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Coins, Bot, User } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function Chat() {
  const { agentId } = useParams<{ agentId: string }>();
  const { user } = useAuth();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  useEffect(() => {
    if (!agentLoading && agent && !isAdmin && balance < agent.credit_cost) {
      toast.error("Créditos insuficientes!");
      navigate("/creditos");
    }
  }, [agent, balance, agentLoading, isAdmin]);

  useEffect(() => {
    if (!user || !agentId) return;
    (async () => {
      const { data: existing } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_id", agentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setSessionId(existing.id);
      } else {
        const { data: newSession } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id, agent_id: agentId })
          .select("id")
          .single();
        if (newSession) setSessionId(newSession.id);
      }
    })();
  }, [user, agentId]);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at");
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!sessionId,
    refetchInterval: false,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!sessionId || !user || !agent) throw new Error("Sessão não encontrada");

      await supabase
        .from("messages")
        .insert({ session_id: sessionId, role: "user", content: text });

      // Debit credits only for non-admin users
      if (!isAdmin) {
        await supabase
          .from("credits_ledger")
          .insert({
            user_id: user.id,
            amount: -agent.credit_cost,
            type: "usage",
            description: `Uso: ${agent.name}`,
          });
      }

      const { data, error: fnError } = await supabase.functions.invoke("agent-chat", {
        body: { agentId, input: text },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao consultar o agente");

      const assistantContent = data?.output || "Sem resposta do agente.";

      await supabase
        .from("messages")
        .insert({ session_id: sessionId, role: "assistant", content: assistantContent });
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
      refetchCredits();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar mensagem");
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (!isAdmin && balance < (agent?.credit_cost || 1)) {
      toast.error("Créditos insuficientes!");
      navigate("/creditos");
      return;
    }
    sendMutation.mutate(text);
  };

  if (agentLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container py-12 text-center">
        <p className="text-white/50">Agente não encontrado</p>
      </div>
    );
  }

  const AgentIcon = getIcon(agent.icon);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Chat header */}
      <div className="border-b border-white/10 bg-[hsl(220,25%,8%)]/80 backdrop-blur-xl px-4 py-3">
        <div className="container flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/agentes")} className="text-white/60 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <AgentIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold truncate text-white">{agent.name}</h2>
            <p className="text-xs text-white/40 truncate">{agent.category}</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-white/50">
            <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
            {agent.credit_cost} crédito/uso
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="container max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-3 animate-fade-in">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary">
                <AgentIcon className="h-5 w-5 text-white" />
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white/[0.05] border border-white/10 px-5 py-4 text-sm text-white/80">
                <p>
                  Olá! Sou o <strong className="text-white">{agent.name}</strong>. {agent.description}
                </p>
                <p className="mt-3">
                  <strong className="text-white">Como posso ajudá-lo hoje?</strong>{" "}
                  {isAdmin
                    ? "Você tem acesso ilimitado como administrador."
                    : `Cada interação custará ${agent.credit_cost} crédito${agent.credit_cost > 1 ? "s" : ""}.`}
                </p>
                <p className="mt-2 text-xs text-white/30">
                  {new Date().toLocaleTimeString("pt-BR")}
                </p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "gradient-primary text-white rounded-br-md whitespace-pre-wrap"
                    : "bg-white/[0.05] border border-white/10 text-white/80 rounded-bl-md prose prose-invert prose-sm max-w-none"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <User className="h-4 w-4 text-white/60" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-white/10 bg-[hsl(220,25%,8%)]/80 backdrop-blur-xl px-4 py-4">
        <div className="container max-w-3xl flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva sua solicitação..."
            className="min-h-[52px] max-h-32 resize-none border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="shrink-0 gap-2 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0"
          >
            {sendMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Gerar
          </Button>
        </div>
      </div>
    </div>
  );
}
