import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useKnowledgeBase, useKnowledgeSources, useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Database, FileText, Globe, Youtube, HelpCircle, Upload, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const SOURCE_TYPES = [
  { id: "text", label: "Texto", description: "Cole algum texto", icon: FileText },
  { id: "qa", label: "Perguntas e Respostas", description: "Melhore as respostas com pares explícitos de Perguntas e Respostas", icon: HelpCircle },
  { id: "file", label: "Arquivo", description: "Pode ser: PDF, CSV, JSON, Texto, PowerPoint, Word, Excel", icon: Upload },
  { id: "webpage", label: "Página Web", description: "Extrair texto de uma única página web", icon: Globe },
  { id: "website", label: "Site Web", description: "Extrair todas as páginas de um site web", icon: Globe },
  { id: "youtube", label: "Youtube", description: "Cole um vídeo, playlist ou canal do YouTube", icon: Youtube },
];

export default function KnowledgeDetail() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId);
  const { data: sources = [], isLoading: srcLoading, createSource, deleteSource } = useKnowledgeSources(kbId);
  const { deleteKB } = useKnowledgeBases();

  const [addingSource, setAddingSource] = useState(false);
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploading, setUploading] = useState(false);

  const handleAddSource = async () => {
    if (!sourceName.trim()) { toast.error("Informe o nome"); return; }
    if (!kbId) return;

    try {
      let content = sourceContent;
      if (sourceType === "qa") {
        content = JSON.stringify({ question: qaQuestion, answer: qaAnswer });
      }

      // For webpage/website/youtube, we store the URL and will process it later
      await createSource.mutateAsync({
        knowledge_base_id: kbId,
        name: sourceName,
        type: sourceType || "text",
        content,
        url: sourceUrl || undefined,
      });

      toast.success("Fonte adicionada!");
      resetForm();
    } catch {
      toast.error("Erro ao adicionar fonte");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !kbId) return;

    setUploading(true);
    try {
      const filePath = `${user.id}/${kbId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Read file content for text-based files
      let content = "";
      const lowerName = file.name.toLowerCase();
      if (file.type.startsWith("text/") || lowerName.endsWith(".csv") || lowerName.endsWith(".json") || lowerName.endsWith(".txt")) {
        content = await file.text();
      } else if (lowerName.endsWith(".pdf")) {
        // For PDF, we store a reference - content will be the file metadata
        content = `[PDF: ${file.name} (${(file.size / 1024).toFixed(1)}KB) - Arquivo armazenado para processamento]`;
      } else if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) {
        content = `[Word: ${file.name} (${(file.size / 1024).toFixed(1)}KB) - Arquivo armazenado para processamento]`;
      } else if (lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx")) {
        // Try to extract text from Excel using xlsx library
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
        name: sourceName || file.name,
        type: "file",
        content,
        file_path: filePath,
      });

      toast.success("Arquivo enviado!");
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setAddingSource(false);
    setSourceType(null);
    setSourceName("");
    setSourceContent("");
    setSourceUrl("");
    setQaQuestion("");
    setQaAnswer("");
  };

  const filteredSources = sources.filter((s) => {
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType !== "all" && s.type !== filterType) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  if (kbLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  // Source type selection screen
  if (addingSource && !sourceType) {
    return (
      <div className="container max-w-2xl py-8">
        <button onClick={() => setAddingSource(false)} className="text-sm text-white/50 hover:text-white mb-2">Cancelar</button>
        <h1 className="font-display text-2xl font-bold text-white mb-8">Nova Fonte</h1>
        <div className="space-y-3">
          {SOURCE_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSourceType(t.id)}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors text-left"
            >
              <t.icon className="h-5 w-5 text-[hsl(14,90%,58%)] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{t.label}</p>
                <p className="text-xs text-white/40">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Source creation form
  if (addingSource && sourceType) {
    return (
      <div className="container max-w-2xl py-8">
        <button onClick={() => setSourceType(null)} className="flex items-center gap-1 text-sm text-white/50 hover:text-white mb-2">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </button>
        <h1 className="font-display text-2xl font-bold text-white mb-8">Nova Fonte</h1>

        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">Nome</label>
            <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Nome da fonte" className="border-white/10 bg-white/[0.05] text-white" />
          </div>

          {sourceType === "text" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Conteúdo</label>
              <Textarea value={sourceContent} onChange={(e) => setSourceContent(e.target.value)} placeholder="Cole seu texto aqui..." rows={8} className="border-white/10 bg-white/[0.05] text-white" />
            </div>
          )}

          {sourceType === "qa" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Pergunta</label>
                <Input value={qaQuestion} onChange={(e) => setQaQuestion(e.target.value)} placeholder="Qual é a pergunta?" className="border-white/10 bg-white/[0.05] text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Resposta</label>
                <Textarea value={qaAnswer} onChange={(e) => setQaAnswer(e.target.value)} placeholder="Qual é a resposta?" rows={4} className="border-white/10 bg-white/[0.05] text-white" />
              </div>
            </>
          )}

          {sourceType === "file" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Arquivo</label>
              <input
                type="file"
                accept=".pdf,.csv,.json,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                onChange={handleFileUpload}
                className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[hsl(14,90%,58%)] file:text-white hover:file:bg-[hsl(14,90%,52%)]"
                disabled={uploading}
              />
              {uploading && <p className="mt-2 text-xs text-white/40">Enviando...</p>}
            </div>
          )}

          {(sourceType === "webpage" || sourceType === "youtube") && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">URL</label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." className="border-white/10 bg-white/[0.05] text-white" />
            </div>
          )}

          {sourceType === "website" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">URL do Sitemap</label>
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/sitemap.xml" className="border-white/10 bg-white/[0.05] text-white" />
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                <p className="text-xs text-white/50">
                  ℹ️ Tentará automaticamente encontrar todas as páginas do site durante 45s máx.
                </p>
              </div>
            </>
          )}

          {sourceType !== "file" && (
            <Button onClick={handleAddSource} disabled={createSource.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
              Adicionar Fonte
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <button onClick={() => navigate("/conteudos")} className="flex items-center gap-1 text-sm text-white/50 hover:text-white mb-2">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </button>
        <h1 className="font-display text-2xl font-bold text-white">{kb?.name || "Conteúdo"}</h1>
        <p className="text-sm text-white/40">Gerencie as fontes desse conteúdo</p>
      </div>

      {/* New source button */}
      <button
        onClick={() => setAddingSource(true)}
        className="mb-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors w-full max-w-md"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(14,90%,58%)]/20">
          <Database className="h-5 w-5 text-[hsl(14,90%,58%)]" />
        </div>
        <span className="flex-1 text-left text-sm font-medium text-white">Nova fonte</span>
        <Plus className="h-5 w-5 text-white/40" />
      </button>

      <Tabs defaultValue="fontes">
        <TabsList className="mb-6 bg-white/5 border border-white/10">
          <TabsTrigger value="fontes" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Fontes</TabsTrigger>
          <TabsTrigger value="config" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="fontes">
          {/* Search and filters */}
          <div className="mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por fonte de dados (nome)"
                  className="pl-9 border-white/10 bg-white/[0.05] text-white"
                />
              </div>
            </div>
            <span className="text-xs text-white/40">{filteredSources.length} resultado(s)</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] border-white/10 bg-white/[0.05] text-white text-xs">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="qa">P&R</SelectItem>
                <SelectItem value="file">Arquivo</SelectItem>
                <SelectItem value="webpage">Página Web</SelectItem>
                <SelectItem value="website">Site Web</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] border-white/10 bg-white/[0.05] text-white text-xs">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sources table */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-5 gap-4 bg-white/[0.03] px-4 py-3 text-xs font-medium text-white/50 border-b border-white/10">
              <span>Nome</span>
              <span>Tipo</span>
              <span>Tamanho</span>
              <span>Última Sincronização</span>
              <span>Status</span>
            </div>
            {filteredSources.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/30">Nenhuma fonte encontrada</div>
            ) : (
              filteredSources.map((src) => (
                <div key={src.id} className="grid grid-cols-5 gap-4 items-center px-4 py-3 text-sm border-b border-white/10 last:border-0 hover:bg-white/[0.02]">
                  <span className="text-white truncate">{src.name}</span>
                  <span className="text-white/50 capitalize">{src.type}</span>
                  <span className="text-white/50">{(src.content?.length || 0) > 1000 ? `${(src.content.length / 1024).toFixed(1)}KB` : `${src.content?.length || 0} chars`}</span>
                  <span className="text-white/50">{new Date(src.updated_at).toLocaleDateString("pt-BR")}</span>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${src.status === "ready" ? "bg-green-500/20 text-green-400" : src.status === "error" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {src.status === "ready" ? "Pronto" : src.status === "error" ? "Erro" : "Pendente"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSource.mutate(src.id)}
                      className="h-7 w-7 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="config">
          <div className="max-w-md space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Nome</label>
              <Input value={kb?.name || ""} disabled className="border-white/10 bg-white/[0.05] text-white/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Descrição</label>
              <Textarea value={kb?.description || ""} disabled rows={3} className="border-white/10 bg-white/[0.05] text-white/50" />
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
              <h3 className="text-lg font-semibold text-red-400">Excluir Conteúdo</h3>
              <p className="mt-1 text-sm text-white/50">Todas as fontes serão removidas permanentemente.</p>
              <Button
                variant="destructive"
                className="mt-3"
                disabled={deleteKB.isPending}
                onClick={async () => {
                  if (!confirm("Tem certeza que deseja excluir este conteúdo e todas as suas fontes?")) return;
                  try {
                    await deleteKB.mutateAsync(kbId!);
                    toast.success("Conteúdo excluído!");
                    navigate("/conteudos");
                  } catch {
                    toast.error("Erro ao excluir conteúdo");
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir Conteúdo
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
