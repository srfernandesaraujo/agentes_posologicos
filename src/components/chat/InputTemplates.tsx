import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, BookmarkPlus, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  agentId: string;
  currentInput: string;
  onSelectTemplate: (content: string) => void;
}

export function InputTemplates({ agentId, currentInput, onSelectTemplate }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["saved-templates", user?.id, agentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("saved_templates")
        .select("*")
        .eq("user_id", user!.id)
        .eq("agent_id", agentId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; title: string; content: string; created_at: string }[];
    },
    enabled: !!user && !!agentId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !currentInput.trim()) throw new Error("Preencha o título e o input");
      const { error } = await (supabase as any).from("saved_templates").insert({
        user_id: user!.id,
        agent_id: agentId,
        title: title.trim(),
        content: currentInput.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-templates", user?.id, agentId] });
      toast.success("Template salvo!");
      setSaveOpen(false);
      setTitle("");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("saved_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-templates", user?.id, agentId] });
      toast.success("Template removido");
    },
  });

  return (
    <div className="flex items-center gap-1">
      {/* Save current input as template */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          if (!currentInput.trim()) {
            toast.error("Digite algo antes de salvar como template");
            return;
          }
          setSaveOpen(true);
        }}
        className="shrink-0 text-white/40 hover:text-[hsl(174,62%,47%)] hover:bg-white/10"
        title="Salvar como template"
      >
        <BookmarkPlus className="h-5 w-5" />
      </Button>

      {/* Load templates */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-white/40 hover:text-[hsl(174,62%,47%)] hover:bg-white/10 relative"
            title="Meus templates"
          >
            <Bookmark className="h-5 w-5" />
            {templates.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(174,62%,47%)] text-[10px] font-bold text-white">
                {templates.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-80 border-white/10 bg-[hsl(220,25%,10%)] text-white p-0"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Templates Salvos</p>
            <p className="text-xs text-white/40">Clique para usar como input</p>
          </div>
          {templates.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-white/20 mb-2" />
              <p className="text-xs text-white/30">Nenhum template salvo para este agente</p>
              <p className="text-xs text-white/20 mt-1">Use o botão <BookmarkPlus className="inline h-3 w-3" /> para salvar</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group flex items-start gap-2 border-b border-white/5 px-4 py-3 hover:bg-white/[0.05] cursor-pointer transition-colors"
                  onClick={() => {
                    onSelectTemplate(tpl.content);
                    setPopoverOpen(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tpl.title}</p>
                    <p className="text-xs text-white/30 truncate mt-0.5">{tpl.content}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-400/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(tpl.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5 text-[hsl(174,62%,47%)]" />
              Salvar Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Nome do template</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Análise de prescrição para paciente idoso"
                className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveMutation.mutate();
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Conteúdo</label>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {currentInput}
              </div>
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim()}
              className="w-full bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,42%)] text-white border-0"
            >
              Salvar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
