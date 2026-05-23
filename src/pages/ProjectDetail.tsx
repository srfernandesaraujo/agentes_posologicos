import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject, useProjectItems, useUpdateProject, useDeleteProject, useRemoveProjectItem, ProjectItemRow } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Share2, Archive, Trash2, Download, Pencil, Check, X, MessageSquare, GitBranch, BookOpen, Video, ShieldCheck, ExternalLink, Tag } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShareProjectDialog } from "@/components/projects/ShareProjectDialog";
import { toast } from "sonner";

const TYPE_META: Record<string, { label: string; icon: any; link: (id: string) => string; tab: string }> = {
  conversation: { label: "Conversa", icon: MessageSquare, link: (id) => `/conversas?session=${id}`, tab: "conversations" },
  flow: { label: "Fluxo", icon: GitBranch, link: (id) => `/fluxos/${id}`, tab: "flows" },
  knowledge_base: { label: "Base de conhecimento", icon: BookOpen, link: (id) => `/conteudos/${id}`, tab: "knowledge" },
  meeting: { label: "Reunião", icon: Video, link: () => `/reunioes`, tab: "meetings" },
  certificate: { label: "Certificado", icon: ShieldCheck, link: () => `/conta`, tab: "certificates" },
};

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { data: items = [] } = useProjectItems(projectId);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const removeItem = useRemoveProjectItem();
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Fetch titles for items
  const { data: titlesMap = {} } = useQuery({
    queryKey: ["project-item-titles", projectId, items.length],
    enabled: items.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const byType: Record<string, string[]> = {};
      items.forEach((it) => {
        byType[it.item_type] = byType[it.item_type] || [];
        byType[it.item_type].push(it.item_id);
      });
      if (byType.conversation?.length) {
        const { data } = await supabase.from("chat_sessions").select("id, title").in("id", byType.conversation);
        data?.forEach((r: any) => (map[`conversation:${r.id}`] = r.title || "Conversa sem título"));
      }
      if (byType.flow?.length) {
        const { data } = await supabase.from("agent_flows").select("id, name").in("id", byType.flow);
        data?.forEach((r: any) => (map[`flow:${r.id}`] = r.name));
      }
      if (byType.knowledge_base?.length) {
        const { data } = await supabase.from("knowledge_bases").select("id, name").in("id", byType.knowledge_base);
        data?.forEach((r: any) => (map[`knowledge_base:${r.id}`] = r.name));
      }
      if (byType.meeting?.length) {
        const { data } = await supabase.from("meetings").select("id, title, meet_link").in("id", byType.meeting);
        data?.forEach((r: any) => (map[`meeting:${r.id}`] = r.title || r.meet_link || "Reunião"));
      }
      if (byType.certificate?.length) {
        const { data } = await supabase.from("content_certificates").select("id, agent_name, content_preview").in("id", byType.certificate);
        data?.forEach((r: any) => (map[`certificate:${r.id}`] = `${r.agent_name}: ${(r.content_preview || "").slice(0, 60)}`));
      }
      return map;
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, ProjectItemRow[]> = {};
    items.forEach((it) => {
      g[it.item_type] = g[it.item_type] || [];
      g[it.item_type].push(it);
    });
    return g;
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container max-w-4xl py-16 text-center">
        <p className="text-white/60 mb-4">Projeto não encontrado.</p>
        <Button onClick={() => navigate("/projetos")} variant="outline" className="border-white/20 text-white">Voltar</Button>
      </div>
    );
  }

  const saveName = async () => {
    if (!nameDraft.trim()) { setEditing(false); return; }
    await updateMutation.mutateAsync({ id: project.id, patch: { name: nameDraft.trim() } });
    setEditing(false);
  };

  const toggleArchive = async () => {
    await updateMutation.mutateAsync({ id: project.id, patch: { archived: !project.archived } });
    toast.success(project.archived ? "Projeto desarquivado" : "Projeto arquivado");
  };

  const exportJson = () => {
    const payload = {
      project,
      items: items.map((it) => ({
        ...it,
        title: titlesMap[`${it.item_type}:${it.item_id}`] || null,
      })),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projeto-${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Projeto exportado");
  };

  const ItemList = ({ list }: { list: ProjectItemRow[] }) => (
    <div className="space-y-2">
      {list.length === 0 ? (
        <p className="text-sm text-white/40 py-6 text-center">Nada por aqui ainda.</p>
      ) : (
        list.map((it) => {
          const meta = TYPE_META[it.item_type];
          const Icon = meta.icon;
          const title = titlesMap[`${it.item_type}:${it.item_id}`] || `${meta.label} ${it.item_id.slice(0, 8)}`;
          return (
            <div key={it.id} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{title}</p>
                <p className="text-[10px] text-white/40">
                  {meta.label} • adicionado {new Date(it.added_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Link to={meta.link(it.item_id)}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeItem.mutate(it.id)}
                className="h-8 w-8 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="container max-w-5xl py-8">
      <Link to="/projetos" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar para projetos
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${project.color}25`, color: project.color }}
          >
            <span className="font-display text-2xl">{project.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-9 max-w-md border-white/20 bg-white/10 text-white"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                />
                <Button variant="ghost" size="icon" onClick={saveName} className="h-8 w-8 text-green-400"><Check className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(false)} className="h-8 w-8 text-white/40"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl text-white truncate">{project.name}</h1>
                <Button variant="ghost" size="icon" onClick={() => { setNameDraft(project.name); setEditing(true); }} className="h-8 w-8 text-white/40 hover:text-white">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
            {project.description && <p className="text-white/50 text-sm mt-1">{project.description}</p>}
            {project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {project.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] border-white/10 text-white/60">
                    <Tag className="h-2.5 w-2.5 mr-1" /> {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button onClick={() => setShareOpen(true)} variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10">
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
          <Button onClick={exportJson} variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button onClick={toggleArchive} variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10">
            <Archive className="h-4 w-4" /> {project.archived ? "Desarquivar" : "Arquivar"}
          </Button>
          <Button onClick={() => setConfirmDelete(true)} variant="outline" className="gap-2 border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="border border-white/10 bg-white/[0.03] flex flex-wrap h-auto">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="conversations">Conversas ({grouped.conversation?.length || 0})</TabsTrigger>
          <TabsTrigger value="flows">Fluxos ({grouped.flow?.length || 0})</TabsTrigger>
          <TabsTrigger value="knowledge">Bases ({grouped.knowledge_base?.length || 0})</TabsTrigger>
          <TabsTrigger value="meetings">Reuniões ({grouped.meeting?.length || 0})</TabsTrigger>
          <TabsTrigger value="certificates">Certificados ({grouped.certificate?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4"><ItemList list={items} /></TabsContent>
        <TabsContent value="conversations" className="mt-4"><ItemList list={grouped.conversation || []} /></TabsContent>
        <TabsContent value="flows" className="mt-4"><ItemList list={grouped.flow || []} /></TabsContent>
        <TabsContent value="knowledge" className="mt-4"><ItemList list={grouped.knowledge_base || []} /></TabsContent>
        <TabsContent value="meetings" className="mt-4"><ItemList list={grouped.meeting || []} /></TabsContent>
        <TabsContent value="certificates" className="mt-4"><ItemList list={grouped.certificate || []} /></TabsContent>
      </Tabs>

      <ShareProjectDialog open={shareOpen} onOpenChange={setShareOpen} projectId={project.id} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              O projeto e seus vínculos serão removidos. As conversas, fluxos e bases originais NÃO serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await deleteMutation.mutateAsync(project.id); navigate("/projetos"); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}