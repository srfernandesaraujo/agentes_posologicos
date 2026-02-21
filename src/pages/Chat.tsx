import { useState, useRef, useEffect, createRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ChartBlock } from "@/components/chat/ChartRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCustomAgent } from "@/hooks/useCustomAgents";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Coins, Bot, User, Paperclip, X, FileText } from "lucide-react";
import { MessageActions } from "@/components/chat/MessageActions";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import * as XLSX from "xlsx";

const CUSTOM_AGENT_INTERACTION_COST = 0.5;

// Sanitize malformed markdown tables (multiple rows on single line)
function sanitizeMarkdownTables(content: string): string {
  // Split into lines
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if line has multiple table rows concatenated (e.g., "| A | B | | C | D |")
    // Pattern: detect lines with content between pipes that contain internal "| |" patterns
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Count the pipe-separated segments
      const segments = trimmed.split('|').filter(s => s.trim() !== '');
      
      // Try to detect if multiple rows are on the same line
      // Look for pattern: "| val | val | | val | val |" (double pipe with space = row separator)
      const doubleBarPattern = /\|\s*\|\s*(?=[^|])/g;
      if (doubleBarPattern.test(trimmed)) {
        // Split on "| |" pattern to get individual rows
        const rows = trimmed.split(/\|\s*\|/).filter(s => s.trim() !== '');
        
        if (rows.length > 1) {
          // Determine columns from first row
          const firstRowCols = rows[0].split('|').filter(s => s.trim() !== '');
          const numCols = firstRowCols.length;
          
          // Build header row
          result.push('| ' + firstRowCols.map(c => c.trim()).join(' | ') + ' |');
          // Add separator
          result.push('|' + firstRowCols.map(() => '---').join('|') + '|');
          
          // Add data rows
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split('|').filter(s => s.trim() !== '');
            if (cols.length > 0) {
              result.push('| ' + cols.map(c => c.trim()).join(' | ') + ' |');
            }
          }
          continue;
        }
      }
    }
    
    result.push(line);
  }

  // Second pass: ensure table separator exists after header
  const finalLines: string[] = [];
  for (let i = 0; i < result.length; i++) {
    finalLines.push(result[i]);
    const current = result[i].trim();
    const next = result[i + 1]?.trim() || '';
    
    // If current line looks like a table row and next line is also a table row
    // but NOT a separator, check if we need to insert one
    if (current.startsWith('|') && current.endsWith('|') && current.includes('|')) {
      if (next.startsWith('|') && next.endsWith('|') && !next.match(/^\|[\s-]+\|/)) {
        // Check if there's no separator between header and first data row
        // Only insert if this is the first table row (preceded by non-table content)
        const prev = result[i - 1]?.trim() || '';
        if (!prev.startsWith('|')) {
          const cols = current.split('|').filter(s => s.trim() !== '');
          finalLines.push('|' + cols.map(() => '---').join('|') + '|');
        }
      }
    }
  }

  return finalLines.join('\n');
}

let tableRowIndex = 0;

const markdownComponents = {
  table: ({ children, ...props }: any) => {
    tableRowIndex = 0;
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-white/15">
        <table className="w-full text-sm border-collapse" {...props}>{children}</table>
      </div>
    );
  },
  thead: ({ children, ...props }: any) => (
    <thead className="bg-primary/15" {...props}>{children}</thead>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody {...props}>{children}</tbody>
  ),
  tr: ({ children, ...props }: any) => {
    const idx = tableRowIndex++;
    return (
      <tr className={`hover:bg-white/[0.06] transition-colors ${idx > 0 && idx % 2 === 0 ? 'bg-white/[0.03]' : ''}`} {...props}>{children}</tr>
    );
  },
  th: ({ children, ...props }: any) => (
    <th className="border-b border-r border-white/15 last:border-r-0 px-4 py-2.5 text-left text-sm font-semibold text-white/90 whitespace-nowrap" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="border-b border-r border-white/10 last:border-r-0 px-4 py-2.5 text-sm text-white/70 tabular-nums" {...props}>{children}</td>
  ),
  h1: ({ children, ...props }: any) => (
    <h1 className="text-xl font-bold text-white mt-5 mb-2 border-b border-white/10 pb-2" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-lg font-bold text-[hsl(174,62%,47%)] mt-4 mb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-base font-semibold text-white/90 mt-3 mb-1" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }: any) => (
    <h4 className="text-sm font-semibold text-white/80 mt-3 mb-1" {...props}>{children}</h4>
  ),
  p: ({ children, ...props }: any) => (
    <p className="text-sm text-white/70 leading-relaxed mb-2" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-inside space-y-1 text-sm text-white/70 ml-2 mb-2" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-inside space-y-1 text-sm text-white/70 ml-2 mb-2" {...props}>{children}</ol>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold text-white/90" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic text-white/60" {...props}>{children}</em>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-2 border-[hsl(174,62%,47%)] pl-3 my-2 text-white/50 italic" {...props}>{children}</blockquote>
  ),
  hr: (props: any) => (
    <hr className="border-white/10 my-4" {...props} />
  ),
  code: ({ inline, children, ...props }: any) =>
    inline ? (
      <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-[hsl(174,62%,47%)]" {...props}>{children}</code>
    ) : (
      <code className="block bg-white/[0.05] rounded-lg p-3 text-xs text-white/70 overflow-x-auto my-2" {...props}>{children}</code>
    ),
};

function ChatMessageContent({ content }: { content: string }) {
  const parts: Array<{ type: "text" | "chart"; content: string }> = [];
  const regex = /```chart\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "chart", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === "chart" ? (
          <ChartBlock key={i} jsonString={part.content} />
        ) : (
          <ReactMarkdown key={i} components={markdownComponents}>{sanitizeMarkdownTables(part.content)}</ReactMarkdown>
        )
      )}
    </>
  );
}

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

      // Build file context - read text-based files content
      let fileContext = "";
      if (attachedFiles.length > 0) {
        const fileContents: string[] = [];
        for (const f of attachedFiles) {
          if (f.type === "text/csv" || f.type === "text/plain" || f.name.endsWith(".csv") || f.name.endsWith(".txt")) {
            const content = await f.text();
            fileContents.push(`[Arquivo: ${f.name}]\n${content.substring(0, 15000)}`);
          } else if (f.type.includes("spreadsheet") || f.type.includes("excel") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
            try {
              const arrayBuffer = await f.arrayBuffer();
              const workbook = XLSX.read(arrayBuffer, { type: "array" });
              const allSheets: string[] = [];
              for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                allSheets.push(`[Planilha: ${sheetName}]\n${csv.substring(0, 15000)}`);
              }
              fileContents.push(`[Arquivo: ${f.name}]\n${allSheets.join("\n\n")}`);
            } catch {
              fileContents.push(`[Arquivo Excel anexado: ${f.name} - Erro ao ler o arquivo.]`);
            }
          } else {
            fileContents.push(`[Arquivo anexado: ${f.name} (${f.type})]`);
          }
        }
        fileContext = "\n\n" + fileContents.join("\n\n");
      }
      const fullInput = text + fileContext;

      // Build conversation history from current displayed messages
      const conversationHistory = displayMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

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
          body: { agentId: actualAgentId, input: fullInput, conversationHistory },
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
          body: { agentId: actualAgentId, input: fullInput, conversationHistory },
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
            {displayMessages.map((msg) => {
              const contentRef = createRef<HTMLDivElement>();
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isCustom ? "bg-[hsl(14,90%,58%)]/20" : "gradient-primary"}`}>
                      <Bot className={`h-4 w-4 ${isCustom ? "text-[hsl(14,90%,58%)]" : "text-white"}`} />
                    </div>
                  )}
                  <div className={`relative group ${msg.role === "assistant" ? "max-w-[85%]" : ""}`}>
                    {msg.role === "assistant" && (
                      <MessageActions content={msg.content} agentName={agent?.name || "Agente"} messageRef={contentRef} />
                    )}
                    <div
                      ref={msg.role === "assistant" ? contentRef : undefined}
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "gradient-primary text-white rounded-br-md whitespace-pre-wrap max-w-[75%] ml-auto"
                          : "bg-white/[0.05] border border-white/10 text-white/80 rounded-bl-md max-w-none"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <ChatMessageContent content={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <User className="h-4 w-4 text-white/60" />
                    </div>
                  )}
                </div>
              );
            })}
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
