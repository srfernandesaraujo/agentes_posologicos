import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Mail, Eye, Edit3 } from "lucide-react";
import { useProjectCollaborators, useAddCollaborator, useRemoveCollaborator } from "@/hooks/useProjects";

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
}) {
  const { data: collaborators = [] } = useProjectCollaborators(projectId);
  const add = useAddCollaborator();
  const remove = useRemoveCollaborator();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    add.mutate({ projectId, email, role }, { onSuccess: () => setEmail("") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar projeto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="pl-10 border-white/10 bg-white/5 text-white"
              required
            />
          </div>
          <div className="flex gap-2">
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="flex-1 border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[hsl(220,25%,12%)] text-white">
                <SelectItem value="viewer">Visualizador (somente leitura)</SelectItem>
                <SelectItem value="editor">Editor (pode adicionar itens)</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={add.isPending} className="gradient-primary text-white">
              Convidar
            </Button>
          </div>
          <p className="text-xs text-white/40">
            O convidado verá o projeto automaticamente ao acessar a conta com este email.
          </p>
        </form>

        <div className="space-y-1 pt-2">
          <p className="text-xs text-white/60 mb-2">Colaboradores ({collaborators.length})</p>
          {collaborators.length === 0 ? (
            <p className="text-xs text-white/30 py-3 text-center">Nenhum colaborador ainda</p>
          ) : (
            collaborators.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{c.user_email}</p>
                  <p className="text-[10px] text-white/40 flex items-center gap-1">
                    {c.role === "editor" ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {c.role === "editor" ? "Editor" : "Visualizador"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}