import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Archive, Users, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/useProjects";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";

export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex items-start justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="mb-2 font-display text-3xl font-bold text-white flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-[hsl(174,62%,47%)]" />
            Projetos
          </h1>
          <p className="text-white/50">
            Agrupe conversas, fluxos, bases e reuniões em workspaces compartilháveis.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gradient-primary text-white gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Novo projeto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <FolderKanban className="mx-auto mb-4 h-12 w-12 text-white/30" />
          <h2 className="font-display text-xl text-white mb-2">Crie seu primeiro projeto</h2>
          <p className="text-white/50 mb-6 max-w-md mx-auto">
            Organize seu trabalho por projeto — todas as conversas, fluxos e bases ficam reunidas no mesmo lugar.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gradient-primary text-white gap-2">
            <Plus className="h-4 w-4" />
            Criar projeto
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <Link
                key={p.id}
                to={`/projetos/${p.id}`}
                className="group rounded-2xl border bg-white/[0.03] p-5 transition-all hover:bg-white/[0.06] hover:scale-[1.02]"
                style={{ borderColor: `${p.color}40`, boxShadow: `0 0 30px -10px ${p.color}30` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${p.color}20`, color: p.color }}
                  >
                    <FolderKanban className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="font-display text-lg text-white mb-1 truncate">{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-white/50 line-clamp-2 mb-3">{p.description}</p>
                )}
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] border-white/10 text-white/60">
                        <Tag className="h-2.5 w-2.5 mr-1" /> {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-[10px] text-white/30">
                  Atualizado {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                </div>
              </Link>
            ))}
          </div>

          {archived.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-sm uppercase tracking-wide text-white/40 mb-3 flex items-center gap-2">
                <Archive className="h-4 w-4" /> Arquivados
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                {archived.map((p) => (
                  <Link
                    key={p.id}
                    to={`/projetos/${p.id}`}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05]"
                  >
                    <p className="text-sm text-white truncate">{p.name}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}