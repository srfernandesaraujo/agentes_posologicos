import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCustomAgent } from "@/hooks/useCustomAgents";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Coins, Bot, User, Paperclip, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

const CUSTOM_AGENT_INTERACTION_COST = 0.5;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function Chat() {
  const { agentId: rawAgentId } = useParams<{ agentId: string }>();
  const { user } = useAuth();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCustom = rawAgentId?.startsWith("custom-");
  const actualAgentId = isCustom ? rawAgentId!.replace("custom-", "") : rawAgentId;

  const { data: builtInAgent, isLoading: builtInLoading } = useQuery({
    queryKey: ["agent", actualAgentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", actualAgentId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!actualAgentId && !isCustom,
  });

  const { data: customAgent, isLoading: customLoading } = useCustomAgent(isCustom ? actualAgentId : undefined);

  const agent = isCustom
    ? customAgent
      ? { id: customAgent.id, name: customAgent.name, description: customAgent.description, category: "Personalizado", icon: "Bot", credit_cost: CUSTOM_AGENT_INTERACTION_COST }
      : null
    : builtInAgent;

  const agentLoading = isCustom ? customLoading : builtInLoading;

  useEffect(() => {
    if (!agentLoading && builtInAgent && !isCustom && !isAdmin && balance < builtInAgent.credit_cost) {
      toast.error("Créditos insuficientes!");
      navigate("/creditos");
    }
  }, [builtInAgent, balance, agentLoading, isAdmin, isCustom]);

  const createNewSession = async () => {
    if (!user || !actualAgentId || isCustom) return null;
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, agent_id: actualAgentId })
      .select("id")
      .single();
    if (newSession) {
      setSessionId(newSession.id);
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", actualAgentId] });
    }
    return newSession?.id || null;
  };

  useEffect(() => {
    if (!user || !actualAgentId) return;
    if (isCustom) { setSessionId(null); return; }
    // Don't auto-load a session — start blank
  }, [user, actualAgentId, isCustom]);

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

  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const displayMessages = isCustom ? localMessages : messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.ms-excel",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "text/plain",
      "text/csv",
    ];
    const valid = files.filter((f) => allowed.includes(f.type) || f.type.startsWith("image/"));
    if (valid.length < files.length) {
      toast.error("Alguns arquivos não são suportados e foram ignorados.");
    }
    setAttachedFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user || !agent) throw new Error("Sessão não encontrada");

      // Build file context
      let fileContext = "";
      if (attachedFiles.length > 0) {
        const fileDescriptions = attachedFiles.map((f) => `[Arquivo anexado: ${f.name} (${f.type})]`);
        fileContext = "\n\n" + fileDescriptions.join("\n");
      }
      const fullInput = text + fileContext;

      if (isCustom) {
        if (!isAdmin && balance < CUSTOM_AGENT_INTERACTION_COST) {
          throw new Error("Créditos insuficientes!");
        }

        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text + (attachedFiles.length > 0 ? `\n\n📎 ${attachedFiles.map(f => f.name).join(", ")}` : ""),
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, userMsg]);

        const { data, error: fnError } = await supabase.functions.invoke("agent-chat", {
          body: { agentId: actualAgentId, input: fullInput },
        });

        if (fnError) throw new Error(fnError.message || "Erro ao consultar o agente");

        if (!isAdmin) {
          await supabase.from("credits_ledger").insert({
            user_id: user.id,
            amount: -CUSTOM_AGENT_INTERACTION_COST,
            type: "usage",
            description: `Uso: ${agent.name} (agente personalizado)`,
          });
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data?.output || "Sem resposta do agente.",
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, assistantMsg]);
      } else {
        // For built-in agents, create session if needed
        let sid = sessionId;
        if (!sid) {
          sid = await createNewSession();
          if (!sid) throw new Error("Erro ao criar sessão");
        }

        const userContent = text + (attachedFiles.length > 0 ? `\n\n📎 ${attachedFiles.map(f => f.name).join(", ")}` : "");

        await supabase
          .from("messages")
          .insert({ session_id: sid, role: "user", content: userContent });

        if (!isAdmin && builtInAgent) {
          await supabase
            .from("credits_ledger")
            .insert({
              user_id: user.id,
              amount: -builtInAgent.credit_cost,
              type: "usage",
              description: `Uso: ${builtInAgent.name}`,
            });
        }

        const { data, error: fnError } = await supabase.functions.invoke("agent-chat", {
          body: { agentId: actualAgentId, input: fullInput },
        });

        if (fnError) throw new Error(fnError.message || "Erro ao consultar o agente");

        const assistantContent = data?.output || "Sem resposta do agente.";

        await supabase
          .from("messages")
          .insert({ session_id: sid, role: "assistant", content: assistantContent });
      }
    },
    onSuccess: () => {
      setInput("");
      setAttachedFiles([]);
      if (!isCustom) {
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["chat-sessions", actualAgentId] });
      }
      refetchCredits();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar mensagem");
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;
    if (!isAdmin) {
      const cost = isCustom ? CUSTOM_AGENT_INTERACTION_COST : (builtInAgent?.credit_cost || 1);
      if (balance < cost) {
        toast.error("Créditos insuficientes!");
        navigate("/creditos");
        return;
      }
    }
    sendMutation.mutate(text || "(Arquivos anexados)");
  };

  const handleNewConversation = () => {
    setSessionId(null);
    setLocalMessages([]);
    setInput("");
    setAttachedFiles([]);
  };

  const handleSelectSession = (sid: string) => {
    setSessionId(sid);
    setLocalMessages([]);
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

  const AgentIcon = getIcon(agent.icon || "Bot");

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <ChatSidebar
        agentId={actualAgentId!}
        isCustom={!!isCustom}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewConversation={handleNewConversation}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Chat header */}
        <div className="border-b border-white/10 bg-[hsl(220,25%,8%)]/80 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/agentes")} className="text-white/60 hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isCustom ? "bg-[hsl(14,90%,58%)]/20" : "gradient-primary"}`}>
              <AgentIcon className={`h-5 w-5 ${isCustom ? "text-[hsl(14,90%,58%)]" : "text-white"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-semibold truncate text-white">{agent.name}</h2>
              <p className="text-xs text-white/40 truncate">{agent.category}</p>
            </div>
            <div className="flex items-center gap-1 text-sm text-white/50">
              <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
              {isCustom ? `${CUSTOM_AGENT_INTERACTION_COST}` : agent.credit_cost} crédito/uso
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {displayMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-4 ${isCustom ? "bg-[hsl(14,90%,58%)]/20" : "gradient-primary"}`}>
                  <AgentIcon className={`h-8 w-8 ${isCustom ? "text-[hsl(14,90%,58%)]" : "text-white"}`} />
                </div>
                <h3 className="text-lg font-display font-semibold text-white mb-2">{agent.name}</h3>
                <p className="text-sm text-white/40 max-w-md">{agent.description}</p>
                <p className="mt-4 text-xs text-white/30">
                  {isAdmin
                    ? "Acesso ilimitado como administrador."
                    : `Cada interação custará ${isCustom ? CUSTOM_AGENT_INTERACTION_COST : agent.credit_cost} crédito(s).`}
                </p>
              </div>
            )}
            {displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isCustom ? "bg-[hsl(14,90%,58%)]/20" : "gradient-primary"}`}>
                    <Bot className={`h-4 w-4 ${isCustom ? "text-[hsl(14,90%,58%)]" : "text-white"}`} />
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

        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="border-t border-white/10 bg-[hsl(220,25%,8%)]/60 px-4 py-2">
            <div className="mx-auto max-w-3xl flex gap-2 flex-wrap">
              {attachedFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/70"
                >
                  <FileText className="h-3.5 w-3.5 text-[hsl(174,62%,47%)]" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-white/40 hover:text-white/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-white/10 bg-[hsl(220,25%,8%)]/80 backdrop-blur-xl px-4 py-4">
          <div className="mx-auto max-w-3xl flex gap-3 items-end">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-white/40 hover:text-white hover:bg-white/10"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
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
              disabled={(!input.trim() && attachedFiles.length === 0) || sendMutation.isPending}
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
    </div>
  );
}
