import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FolderPlus, Plus } from "lucide-react";
import { useProjects, useAddProjectItem, ProjectItemType } from "@/hooks/useProjects";
import { CreateProjectDialog } from "./CreateProjectDialog";

export function AddToProjectMenu({
  itemType,
  itemId,
  variant = "ghost",
  size = "sm",
  label,
}: {
  itemType: ProjectItemType;
  itemId: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "icon";
  label?: string;
}) {
  const { data: projects = [] } = useProjects();
  const add = useAddProjectItem();
  const [createOpen, setCreateOpen] = useState(false);

  const activeProjects = projects.filter((p) => !p.archived);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {size === "icon" ? (
            <Button variant={variant} size="icon" className="h-8 w-8 text-white/60 hover:text-white" title="Adicionar a projeto">
              <FolderPlus className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant={variant} size={size} className="gap-2 text-white/70 hover:text-white">
              <FolderPlus className="h-4 w-4" />
              {label || "Adicionar a projeto"}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-white/10 bg-[hsl(220,25%,12%)] text-white min-w-[220px]">
          <DropdownMenuLabel className="text-xs text-white/40">Adicionar a projeto</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          {activeProjects.length === 0 ? (
            <DropdownMenuItem disabled className="text-white/40 text-xs">
              Nenhum projeto criado ainda
            </DropdownMenuItem>
          ) : (
            activeProjects.slice(0, 10).map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => add.mutate({ projectId: p.id, itemType, itemId })}
                className="gap-2 cursor-pointer hover:bg-white/10"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2 cursor-pointer hover:bg-white/10 text-[hsl(174,62%,47%)]">
            <Plus className="h-4 w-4" />
            Criar novo projeto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(projectId) => add.mutate({ projectId, itemType, itemId })}
      />
    </>
  );
}