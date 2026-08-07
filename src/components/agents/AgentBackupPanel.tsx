import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2, Archive } from "lucide-react";
import { useAgentBackup, AgentBackupScope } from "@/hooks/useAgentBackup";

interface AgentBackupPanelProps {
  scope: AgentBackupScope;
}

const COPY: Record<AgentBackupScope, { title: string; description: string; queryKeys: string[] }> = {
  native: {
    title: "Backup das ferramentas nativas",
    description:
      "Gere um .zip com a configuração de todas as ferramentas nativas da plataforma, ou restaure um backup gerado anteriormente. A restauração sempre cria novas ferramentas (nunca sobrescreve as existentes).",
    queryKeys: ["admin-agents", "agents"],
  },
  custom: {
    title: "Backup das minhas ferramentas",
    description:
      "Gere um .zip com a configuração de todas as suas ferramentas próprias, ou restaure um backup gerado anteriormente. A restauração sempre cria novas ferramentas como rascunho (nunca sobrescreve as existentes nem republica no marketplace).",
    queryKeys: ["custom-agents"],
  },
};

export function AgentBackupPanel({ scope }: AgentBackupPanelProps) {
  const { title, description, queryKeys } = COPY[scope];
  const queryClient = useQueryClient();
  const { backup, backingUp, restore, restoring } = useAgentBackup(scope);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    try {
      const data = await backup();
      toast.success(`Backup gerado com ${data.count} ferramenta(s).`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar backup");
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!confirm(`Restaurar "${file.name}"? Isso vai criar novas ferramentas a partir do conteúdo do backup.`)) {
      return;
    }

    try {
      const result = await restore(file);
      toast.success(
        result.renamed.length > 0
          ? `${result.restored} ferramenta(s) restaurada(s). ${result.renamed.length} renomeada(s) por já existir uma com o mesmo nome.`
          : `${result.restored} ferramenta(s) restaurada(s).`,
      );
      for (const key of queryKeys) queryClient.invalidateQueries({ queryKey: [key] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao restaurar backup");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Archive className="h-5 w-5 text-white/70" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/40">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={handleBackup}
          disabled={backingUp}
          className="border-white/10 bg-white/[0.05] text-white hover:bg-white/10"
        >
          {backingUp ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
          {backingUp ? "Gerando..." : "Baixar backup (.zip)"}
        </Button>

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={restoring}
          className="border-white/10 bg-white/[0.05] text-white hover:bg-white/10"
        >
          {restoring ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          {restoring ? "Restaurando..." : "Restaurar backup (.zip)"}
        </Button>
        <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelected} className="hidden" />
      </div>
    </div>
  );
}
