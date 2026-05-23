import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/hooks/useProjects";

const COLORS = ["#14b8a6", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#eab308", "#22c55e", "#ef4444"];

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (projectId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [tagsInput, setTagsInput] = useState("");
  const create = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const project = await create.mutateAsync({ name: name.trim(), description, color, tags });
    setName(""); setDescription(""); setTagsInput(""); setColor(COLORS[0]);
    onOpenChange(false);
    onCreated?.(project.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Nome*</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: TCC sobre antibioticoterapia"
              className="border-white/10 bg-white/5 text-white"
              required
              autoFocus
              maxLength={120}
            />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para que serve esse projeto?"
              className="border-white/10 bg-white/5 text-white min-h-[70px]"
              maxLength={500}
            />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-2 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${color === c ? "border-white scale-110" : "border-white/20"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Tags (separadas por vírgula)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="ex.: pesquisa, mestrado"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-white/70 hover:text-white">
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || !name.trim()} className="gradient-primary text-white">
              {create.isPending ? "Criando..." : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}