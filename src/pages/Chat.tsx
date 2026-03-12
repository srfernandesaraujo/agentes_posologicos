import { useState, useRef, useEffect, createRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartBlock } from "@/components/chat/ChartRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";
import { useCustomAgent } from "@/hooks/useCustomAgents";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Coins, Bot, User, Paperclip, X, FileText, AlertTriangle, MessageSquare, File, Settings2, MoreVertical, Trash2, Download, Pencil, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { exportConversationPdf } from "@/lib/exportConversationPdf";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InputTemplates } from "@/components/chat/InputTemplates";
import { ConversationPicker } from "@/components/chat/ConversationPicker";
import { AgentConversationsPicker } from "@/components/chat/AgentConversationsPicker";
import { MessageActions } from "@/components/chat/MessageActions";
import { ResponseFeedback } from "@/components/chat/ResponseFeedback";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ResearchInterestsManager } from "@/components/pubmed/ResearchInterestsManager";


const CUSTOM_AGENT_INTERACTION_COST = 0.5;

// Sanitize malformed markdown tables — handles concatenated rows, inline separators, missing spacing
function sanitizeMarkdownTables(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];

  const splitCells = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !/^:?-{2,}:?$/.test(c));

  const isTableHeader = (line: string) => line.includes("|") && splitCells(line).length >= 2;
  const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim());

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1] ?? "";

    // Detect table start (header + separator)
    if (isTableHeader(current) && isTableSeparator(next)) {
      const headerCells = splitCells(current);
      const colCount = Math.max(2, headerCells.length);

      // Ensure blank line before table
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");

      out.push(`| ${headerCells.slice(0, colCount).join(" | ")} |`);
      out.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

      i += 2;

      // Consume data rows while lines still look like table-ish content
      for (; i < lines.length; i++) {
        const rowLine = lines[i];
        const trimmed = rowLine.trim();

        if (!trimmed) break;
        if (!trimmed.includes("|")) {
          i -= 1;
          break;
        }

        // Handle concatenated rows with double pipes: ... | ... || ... | ...
        const normalized = rowLine.replace(/\|\s*\|+/g, "||");
        const rowSegments = normalized.includes("||")
          ? normalized
              .split("||")
              .map((s) => s.trim())
              .filter(Boolean)
          : [normalized.trim()];

        let wroteAny = false;

        for (const segment of rowSegments) {
          const cells = splitCells(segment);
          if (cells.length === 0) continue;

          // If still too many cells, chunk by header column count
          for (let c = 0; c < cells.length; c += colCount) {
            const chunk = cells.slice(c, c + colCount);
            while (chunk.length < colCount) chunk.push("");
            if (chunk.some((v) => v !== "")) {
              out.push(`| ${chunk.join(" | ")} |`);
              wroteAny = true;
            }
          }
        }

        if (!wroteAny) {
          i -= 1;
          break;
        }
      }

      // Ensure blank line after table
      if (out[out.length - 1]?.trim() !== "") out.push("");
      continue;
    }

    out.push(current);
  }

  return out.join("\n");
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
    <ul className="list-disc list-outside space-y-1 text-sm text-white/70 ml-5 mb-2" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-outside space-y-1 text-sm text-white/70 ml-5 mb-2" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-sm text-white/70 leading-relaxed [&>p]:inline [&>p]:mb-0" {...props}>{children}</li>
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
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>{sanitizeMarkdownTables(part.content)}</ReactMarkdown>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { hasUnlimitedAccess } = useUnlimitedAccess();
  const hasFreeAccess = isAdmin || hasUnlimitedAccess;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachedConversations, setAttachedConversations] = useState<{ title: string; content: string }[]>([]);
  const [showConversationPicker, setShowConversationPicker] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");
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

  const [showNoCreditsDialog, setShowNoCreditsDialog] = useState(false);

  useEffect(() => {
    if (!agentLoading && builtInAgent && !isCustom && !hasFreeAccess && balance < builtInAgent.credit_cost) {
      setShowNoCreditsDialog(true);
    }
  }, [builtInAgent, balance, agentLoading, hasFreeAccess, isCustom]);

  const createNewSession = async () => {
    if (!user || !actualAgentId) return null;
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
    const sessionFromUrl = searchParams.get("session");
    if (sessionFromUrl) {
      setSessionId(sessionFromUrl);
      setSearchParams({}, { replace: true });
    }
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

  const displayMessages = messages;

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
      "application/rtf",
      "text/rtf",
      "text/xml",
      "application/xml",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "text/plain",
      "text/csv",
    ];
    const valid = files.filter((f) => {
      if (allowed.includes(f.type) || f.type.startsWith("image/")) return true;
      // Accept by extension for types browsers may not recognize
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext && ["rtf", "xml"].includes(ext)) return true;
      return false;
    });
    if (valid.length < files.length) {
      toast.error("Alguns arquivos não são suportados e foram ignorados.");
    }
    // Limit: max 10MB per file, max 3 files
    const sizeFiltered = valid.filter(f => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`Arquivo ${f.name} excede 10MB e foi ignorado.`);
        return false;
      }
      return true;
    });
    setAttachedFiles((prev) => {
      const combined = [...prev, ...sizeFiltered];
      if (combined.length > 3) {
        toast.error("Máximo de 3 arquivos por mensagem.");
        return combined.slice(0, 3);
      }
      return combined;
    });
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

      // Build files array as base64 for the edge function
      const filesPayload: { name: string; type: string; base64: string }[] = [];
      let textFileContext = "";
      if (attachedFiles.length > 0) {
        for (const f of attachedFiles) {
          const ext = f.name.split('.').pop()?.toLowerCase();
          const isTextBased = f.type === "text/csv" || f.type === "text/plain" || ext === "csv" || ext === "txt";
          const isSpreadsheet = f.type.includes("spreadsheet") || f.type.includes("excel") || ext === "xlsx" || ext === "xls";
          
          if (isTextBased) {
            // Read text files directly as context
            const content = await f.text();
            textFileContext += `\n\n[Arquivo: ${f.name}]\n${content.substring(0, 15000)}`;
          } else if (isSpreadsheet) {
            textFileContext += `\n\n[Arquivo Excel anexado: ${f.name} (${(f.size / 1024).toFixed(1)}KB) - Converta para CSV para melhor processamento]`;
          } else {
            // Convert to base64 for multimodal processing (PDF, DOCX, images, RTF, XML)
            try {
              const base64 = await fileToBase64(f);
              filesPayload.push({ name: f.name, type: f.type || `application/${ext}`, base64 });
            } catch (err) {
              console.error(`Failed to convert ${f.name} to base64:`, err);
              textFileContext += `\n\n[Erro ao processar arquivo: ${f.name}]`;
            }
          }
        }
      }

      // Add attached conversations as context
      let conversationContext = "";
      if (attachedConversations.length > 0) {
        conversationContext = "\n\n" + attachedConversations.map(c => c.content).join("\n\n");
      }

      const fullInput = text + textFileContext + conversationContext;

      // Build conversation history from current displayed messages
      const conversationHistory = displayMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Create session if needed (both built-in and custom agents)
      let sid = sessionId;
      if (!sid) {
        sid = await createNewSession();
        if (!sid) throw new Error("Erro ao criar sessão");
      }

      if (isCustom && !hasFreeAccess && balance < CUSTOM_AGENT_INTERACTION_COST) {
        throw new Error("Créditos insuficientes!");
      }

      const attachmentLabels = [
        ...attachedFiles.map(f => `📎 ${f.name}`),
        ...attachedConversations.map(c => `💬 ${c.title}`),
      ];
      const userContent = text + (attachmentLabels.length > 0 ? `\n\n${attachmentLabels.join(", ")}` : "");

      await supabase
        .from("messages")
        .insert({ session_id: sid, role: "user", content: userContent });

      const cost = isCustom ? CUSTOM_AGENT_INTERACTION_COST : (builtInAgent?.credit_cost || 1);
      
      const { data, error: fnError } = await supabase.functions.invoke("agent-chat", {
        body: { 
          agentId: actualAgentId, 
          input: fullInput, 
          conversationHistory,
          creditCost: hasFreeAccess ? 0 : cost,
          ...(filesPayload.length > 0 ? { files: filesPayload } : {}),
        },
      });

      if (fnError) {
        // supabase-js may put the parsed body in data even on error
        let errorMsg = "Erro ao consultar o agente";
        if (data?.error) {
          errorMsg = data.error;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            errorMsg = parsed.error || errorMsg;
          } catch { /* ignore */ }
        } else if (fnError.message && !fnError.message.includes("non-2xx")) {
          errorMsg = fnError.message;
        }
        throw new Error(errorMsg);
      }

      const assistantContent = data?.output || "Sem resposta do agente.";

      await supabase
        .from("messages")
        .insert({ session_id: sid, role: "assistant", content: assistantContent });
    },
    onSuccess: () => {
      setInput("");
      setAttachedFiles([]);
      setAttachedConversations([]);
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", actualAgentId] });
      refetchCredits();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar mensagem");
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0 && attachedConversations.length === 0) return;
    if (!hasFreeAccess) {
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
    setInput("");
    setAttachedFiles([]);
    setAttachedConversations([]);
  };

  const handleSelectSession = (sid: string) => {
    setSessionId(sid);
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    await supabase.from("messages").delete().eq("session_id", sessionId);
    await supabase.from("chat_sessions").delete().eq("id", sessionId);
    setShowDeleteDialog(false);
    handleNewConversation();
    queryClient.invalidateQueries({ queryKey: ["chat-sessions", actualAgentId] });
    toast.success("Conversa excluída com sucesso");
  };

  const handleExportPdf = () => {
    if (!sessionId || displayMessages.length === 0) {
      toast.error("Nenhuma mensagem para exportar");
      return;
    }
    exportConversationPdf(agent?.name || "Agente", displayMessages);
    toast.success("PDF exportado com sucesso");
  };

  const handleRenameSession = async () => {
    if (!sessionId || !renameValue.trim()) return;
    await supabase.from("chat_sessions").update({ title: renameValue.trim() }).eq("id", sessionId);
    setShowRenameDialog(false);
    queryClient.invalidateQueries({ queryKey: ["chat-sessions", actualAgentId] });
    toast.success("Título atualizado");
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
    <>
    {/* No credits dialog */}
    <Dialog open={showNoCreditsDialog} onOpenChange={setShowNoCreditsDialog}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-[hsl(38,92%,50%)]" />
            Créditos insuficientes
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Você precisa de pelo menos {agent.credit_cost} crédito(s) para usar este agente. Seu saldo atual é {balance}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => { setShowNoCreditsDialog(false); navigate("/agentes"); }} className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10">
            Voltar
          </Button>
          <Button onClick={() => { setShowNoCreditsDialog(false); navigate("/creditos"); }} className="flex-1 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0">
            <Coins className="h-4 w-4 mr-2" />
            Comprar Créditos
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete confirmation dialog */}
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Excluir conversa</DialogTitle>
          <DialogDescription className="text-white/50">
            Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="border-white/20 bg-transparent text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={handleDeleteSession} className="bg-red-600 hover:bg-red-700 text-white border-0">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Rename dialog */}
    <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Renomear conversa</DialogTitle>
          <DialogDescription className="text-white/50">
            Digite o novo título para esta conversa.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="Novo título..."
          className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
          onKeyDown={(e) => e.key === "Enter" && handleRenameSession()}
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowRenameDialog(false)} className="border-white/20 bg-transparent text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={handleRenameSession} disabled={!renameValue.trim()} className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white border-0">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <ChatSidebar
        agentId={actualAgentId!}
        agentName={agent?.name || "Agente"}
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
            <div className="flex items-center gap-2">
              {!isCustom && builtInAgent?.slug === "especialista-pubmed" && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-[hsl(174,62%,47%)] hover:bg-white/10 text-xs">
                      <Settings2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Interesses de Pesquisa</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="border-white/10 bg-[hsl(220,25%,10%)] w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="text-white">Configurações do PubMed</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <ResearchInterestsManager />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <div className="flex items-center gap-1 text-sm text-white/50">
                <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
                {isCustom ? `${CUSTOM_AGENT_INTERACTION_COST}` : agent.credit_cost} crédito/uso
              </div>
              {sessionId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white/60 hover:bg-white/10 hover:text-white">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                    <DropdownMenuItem onClick={() => { setRenameValue(""); setShowRenameDialog(true); }} className="text-white/80 focus:bg-white/10 focus:text-white">
                      <Pencil className="mr-2 h-4 w-4" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPdf} className="text-white/80 focus:bg-white/10 focus:text-white">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-400 focus:bg-red-500/10 focus:text-red-400">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir conversa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
                  {hasFreeAccess
                    ? "Acesso ilimitado."
                    : `Cada interação custará ${isCustom ? CUSTOM_AGENT_INTERACTION_COST : agent.credit_cost} crédito(s).`}
                </p>
                <p className="mt-2 text-xs text-white/20">
                  💡 Dica: Salve inputs frequentes como templates usando o ícone de bookmark
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
                        <>
                          <ChatMessageContent content={msg.content} />
                          <ResponseFeedback
                            messageId={msg.id}
                            agentId={rawAgentId || ""}
                            sessionId={sessionId}
                          />
                        </>
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

        {/* Attached files & conversations preview */}
        {(attachedFiles.length > 0 || attachedConversations.length > 0) && (
          <div className="border-t border-white/10 bg-[hsl(220,25%,8%)]/60 px-4 py-2">
            <div className="mx-auto max-w-3xl flex gap-2 flex-wrap">
              {attachedFiles.map((file, i) => (
                <div
                  key={`file-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/70"
                >
                  <FileText className="h-3.5 w-3.5 text-[hsl(174,62%,47%)]" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-white/40 hover:text-white/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {attachedConversations.map((conv, i) => (
                <div
                  key={`conv-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(174,62%,47%)]/20 bg-[hsl(174,62%,47%)]/10 px-3 py-1.5 text-xs text-white/70"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[hsl(174,62%,47%)]" />
                  <span className="max-w-[160px] truncate">{conv.title}</span>
                  <button onClick={() => setAttachedConversations(prev => prev.filter((_, idx) => idx !== i))} className="text-white/40 hover:text-white/80">
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.rtf,.xml"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-white/40 hover:text-white hover:bg-white/10"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-48 p-1 border-white/10 bg-[hsl(220,25%,10%)]">
                <button
                  onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Arquivos
                </button>
                <button
                  onClick={() => { setShowConversationPicker(true); setAttachMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Conversas
                </button>
              </PopoverContent>
            </Popover>
            <InputTemplates
              agentId={rawAgentId || ""}
              currentInput={input}
              onSelectTemplate={(content) => setInput(content)}
            />
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
              disabled={(!input.trim() && attachedFiles.length === 0 && attachedConversations.length === 0) || sendMutation.isPending}
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

    {/* Conversation Picker */}
    <ConversationPicker
      open={showConversationPicker}
      onClose={() => setShowConversationPicker(false)}
      onSelect={(conv) => setAttachedConversations(prev => [...prev, conv])}
      excludeAgentId={actualAgentId}
    />
    </>
  );
}
