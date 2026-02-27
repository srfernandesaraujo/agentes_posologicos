import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useKnowledgeBases, useKnowledgeSources, KnowledgeSource } from "@/hooks/useKnowledgeBases";
import { useAgentKnowledgeBases } from "@/hooks/useAgentKnowledgeBases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, Upload, Globe, Search, ChevronRight, ChevronLeft, 
  Trash2, File, X, FolderOpen, Plus, RefreshCw 
} from "lucide-react";
import { toast } from "sonner";

interface DocumentManagerProps {
  agentId: string;
}

export function DocumentManager({ agentId }: DocumentManagerProps) {
  const { user } = useAuth();
  const { data: knowledgeBases = [], createKB } = useKnowledgeBases();
  const { data: agentKBs = [], linkKB } = useAgentKnowledgeBases(agentId);

  // Find or create the agent's default KB
  const linkedKBIds = agentKBs.map((l) => l.knowledge_base_id);
  const firstLinkedKBId = linkedKBIds[0];

  const { data: allSources = [], createSource, deleteSource } = useKnowledgeSources(firstLinkedKBId);

  // All sources across all linked KBs
  const [selectedKBId, setSelectedKBId] = useState<string | null>(null);
  const activeKBId = selectedKBId || firstLinkedKBId;

  const { data: activeSources = [] } = useKnowledgeSources(activeKBId);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [searchLeft, setSearchLeft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all sources from all user's KBs (left panel)
  // We'll show all sources from all KBs the user owns
  const [globalSources, setGlobalSources] = useState<KnowledgeSource[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const loadGlobalSources = useCallback(async () => {
    if (!user) return;
    setLoadingGlobal(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_sources" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setGlobalSources(data as unknown as KnowledgeSource[]);
    } catch {
      // silent
    } finally {
      setLoadingGlobal(false);
    }
  }, [user]);

  // Load on mount
  useState(() => {
    loadGlobalSources();
  });

  // Ensure agent has at least one KB
  const ensureKB = async (): Promise<string> => {
    if (firstLinkedKBId) return firstLinkedKBId;
    // Create a default KB for this agent
    const kb = await createKB.mutateAsync({
      name: `Documentos do Agente`,
      description: "Base de conhecimento criada automaticamente",
    });
    await linkKB.mutateAsync(kb.id);
    return kb.id;
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const kbId = await ensureKB();
      const filePath = `${user.id}/${kbId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-files")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      let content = "";
      const lowerName = file.name.toLowerCase();
      if (file.type.startsWith("text/") || lowerName.endsWith(".csv") || lowerName.endsWith(".json") || lowerName.endsWith(".txt")) {
        content = await file.text();
      } else if (lowerName.endsWith(".pdf")) {
        content = `[PDF: ${file.name} (${(file.size / 1024).toFixed(1)}KB) - Arquivo armazenado para processamento]`;
      } else if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) {
        content = `[Word: ${file.name} (${(file.size / 1024).toFixed(1)}KB) - Arquivo armazenado para processamento]`;
      } else if (lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx")) {
        try {
          const XLSX = await import("xlsx");
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const sheets: string[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            sheets.push(`--- ${sheetName} ---\n${csv}`);
          });
          content = sheets.join("\n\n");
        } catch {
          content = `[Excel: ${file.name} (${(file.size / 1024).toFixed(1)}KB)]`;
        }
      } else {
        content = `[Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)}KB)]`;
      }

      await createSource.mutateAsync({
        knowledge_base_id: kbId,
        name: file.name,
        type: "file",
        content,
        file_path: filePath,
      });

      toast.success(`"${file.name}" enviado!`);
      loadGlobalSources();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    if (!user) return;
    try {
      const kbId = await ensureKB();
      await createSource.mutateAsync({
        knowledge_base_id: kbId,
        name: urlInput,
        type: "webpage",
        content: "",
        url: urlInput,
      });
      toast.success("URL adicionada!");
      setUrlInput("");
      loadGlobalSources();
    } catch {
      toast.error("Erro ao adicionar URL");
    }
  };

  const moveToAgent = async (source: KnowledgeSource) => {
    if (!user) return;
    try {
      const kbId = await ensureKB();
      // If already in a linked KB, skip
      if (linkedKBIds.includes(source.knowledge_base_id)) {
        toast.info("Este documento já está vinculado ao agente.");
        return;
      }
      // Copy source to agent's KB
      await createSource.mutateAsync({
        knowledge_base_id: kbId,
        name: source.name,
        type: source.type,
        content: source.content,
        url: source.url || undefined,
        file_path: source.file_path || undefined,
      });
      toast.success(`"${source.name}" vinculado ao agente!`);
      loadGlobalSources();
    } catch {
      toast.error("Erro ao vincular documento");
    }
  };

  const removeFromAgent = async (source: KnowledgeSource) => {
    try {
      await deleteSource.mutateAsync(source.id);
      toast.success(`"${source.name}" removido!`);
      loadGlobalSources();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  // Right panel: sources in agent's linked KBs
  const agentSources = globalSources.filter((s) => linkedKBIds.includes(s.knowledge_base_id));
  const agentSourceIds = new Set(agentSources.map((s) => s.id));

  // Names already in the agent's KBs (to prevent duplicates by name)
  const agentSourceNames = new Set(agentSources.map((s) => s.name.toLowerCase()));

  // Left panel: only sources NOT already in the agent's KBs (no duplicates)
  const filteredLeft = globalSources.filter((s) => {
    if (agentSourceIds.has(s.id)) return false;
    if (linkedKBIds.includes(s.knowledge_base_id)) return false;
    if (agentSourceNames.has(s.name.toLowerCase())) return false;
    if (searchLeft && !s.name.toLowerCase().includes(searchLeft.toLowerCase())) return false;
    return true;
  });

  const getFileIcon = (source: KnowledgeSource) => {
    if (source.type === "webpage" || source.type === "website") return <Globe className="h-4 w-4 text-blue-400 shrink-0" />;
    const name = source.name.toLowerCase();
    if (name.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-400 shrink-0" />;
    if (name.endsWith(".doc") || name.endsWith(".docx")) return <FileText className="h-4 w-4 text-blue-400 shrink-0" />;
    if (name.endsWith(".csv") || name.endsWith(".xls") || name.endsWith(".xlsx")) return <FileText className="h-4 w-4 text-green-400 shrink-0" />;
    return <File className="h-4 w-4 text-white/40 shrink-0" />;
  };

  

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 min-h-[400px]">
        {/* LEFT PANEL - All Documents */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-white/50" />
                Meus Documentos
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white" onClick={loadGlobalSources} disabled={loadingGlobal}>
                <RefreshCw className={`h-3 w-3 ${loadingGlobal ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/30" />
              <Input
                value={searchLeft}
                onChange={(e) => setSearchLeft(e.target.value)}
                placeholder="Buscar documento..."
                className="h-7 pl-8 text-xs border-white/10 bg-white/[0.05] text-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-white/5">
            {filteredLeft.length === 0 ? (
              <p className="p-4 text-xs text-white/30 text-center">Nenhum documento encontrado</p>
            ) : (
              filteredLeft.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors group"
                >
                  {getFileIcon(source)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 truncate">{source.name}</p>
                    <p className="text-[10px] text-white/30">
                      {knowledgeBases.find((kb) => kb.id === source.knowledge_base_id)?.name || "—"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white hover:bg-white/10 shrink-0"
                    onClick={() => moveToAgent(source)}
                    title="Vincular ao agente"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER - Transfer indicator */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="flex flex-col items-center gap-1 text-white/20">
            <ChevronRight className="h-5 w-5" />
            <ChevronLeft className="h-5 w-5" />
          </div>
        </div>

        {/* RIGHT PANEL - Agent's Documents */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Documentos do Agente</h3>
            <p className="text-[10px] text-white/30 mt-0.5">{agentSources.length} documento(s) vinculado(s)</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-white/5">
            {agentSources.length === 0 ? (
              <p className="p-4 text-xs text-white/30 text-center">Nenhum documento vinculado.<br />Arraste arquivos abaixo ou mova da lista à esquerda.</p>
            ) : (
              agentSources.map((source) => (
                <div key={source.id} className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors group">
                  {getFileIcon(source)}
                  <p className="flex-1 text-xs text-white/80 truncate min-w-0">{source.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    onClick={() => removeFromAgent(source)}
                    title="Remover do agente"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* UPLOAD AREA */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-[hsl(174,62%,47%)] bg-[hsl(174,62%,47%)]/10"
            : "border-white/20 hover:border-white/40 bg-white/[0.02]"
        }`}
      >
        <Upload className={`mx-auto h-8 w-8 mb-2 ${dragOver ? "text-[hsl(174,62%,47%)]" : "text-white/30"}`} />
        <p className="text-sm font-medium text-white/70">
          {uploading ? "Enviando..." : "Clique para enviar ou arraste e solte"}
        </p>
        <p className="text-xs text-white/30 mt-1">
          Suporta: PDF, Word, Excel, CSV, TXT, JSON e mais
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.pptx,.md"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* URL INPUT */}
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://exemplo.com"
          className="border-white/10 bg-white/[0.05] text-white text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
        />
        <Button
          onClick={handleFetchUrl}
          variant="default"
          className="shrink-0"
          disabled={!urlInput.trim()}
        >
          <Globe className="h-4 w-4 mr-1" />
          Adicionar URL
        </Button>
      </div>
    </div>
  );
}
