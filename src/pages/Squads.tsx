import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus, Users, Repeat, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSquadActions, useSquadTemplates, useSquads, type SquadTemplateInfo } from "@/hooks/useSquads";
import { fmtUsd } from "@/components/squads/CostCapField";

const SENSITIVITY_LABEL: Record<SquadTemplateInfo["sensitivity"], string | null> = {
  normal: null,
  dados_pessoais: "Dados pessoais comuns",
  dados_saude: "Dados de saúde (somente anonimizados)",
};

export default function Squads() {
  const navigate = useNavigate();
  const { data: squads = [], isLoading } = useSquads();
  const { data: templates = [], isLoading: loadingTemplates } = useSquadTemplates();
  const { createSquad } = useSquadActions();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const templateBySlug = new Map(templates.map((t) => [t.slug, t]));

  const create = async (t: SquadTemplateInfo) => {
    setCreating(t.slug);
    try {
      const { squad } = await createSquad.mutateAsync({ templateSlug: t.slug });
      setOpen(false);
      navigate(`/squads/${squad.id}`);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível criar o squad");
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Squads de agentes</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Equipes de agentes de IA com funções fixas. Você descreve a missão em um formulário, acompanha as entregas e aprova ou pede ajustes.
            Cada squad é visível só para você.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 gradient-primary"><Plus className="h-4 w-4" /> Novo squad</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>
      ) : squads.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Users className="mb-4 h-16 w-16 text-white/20" />
          <h2 className="text-xl font-semibold text-white/60">Nenhum squad criado</h2>
          <p className="mt-2 max-w-md text-white/40">Escolha um template, preencha o formulário da missão e acompanhe o time trabalhando.</p>
          <Button onClick={() => setOpen(true)} className="mt-6 gap-2"><Plus className="h-4 w-4" /> Criar o primeiro squad</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {squads.map((s) => {
            const t = templateBySlug.get(s.template_slug);
            return (
              <Card key={s.id} onClick={() => navigate(`/squads/${s.id}`)} role="link" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/squads/${s.id}`); }}
                className="cursor-pointer border-white/10 bg-white/5 text-white transition-colors hover:border-white/30">
                <CardHeader>
                  <CardTitle className="text-lg">{s.name}</CardTitle>
                  <CardDescription className="flex flex-wrap gap-2 text-white/50">
                    <Badge variant="outline" className="border-white/20 text-white/60">{s.kind === "continuous" ? "Contínuo" : "Por missão"}</Badge>
                    {t && <span>{t.agents.length} agentes</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-white/40">Criado em {new Date(s.created_at).toLocaleDateString("pt-BR")}</CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <DialogHeader><DialogTitle>Escolha um template de squad</DialogTitle></DialogHeader>
          {loadingTemplates ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/40" /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <div key={t.slug} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                      {t.kind === "continuous" && <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3" /> Contínuo, com agendamento</span>}
                      <span>Custo estimado por missão: {fmtUsd(t.estimatedCostUsd.min)} a {fmtUsd(t.estimatedCostUsd.max)}</span>
                    </div>
                  </div>
                  <ul className="space-y-0.5 text-sm text-white/70">
                    {t.agents.map((a) => <li key={a.slug}><span className="font-medium">{a.name}</span> <span className="text-white/40">{a.role}</span></li>)}
                  </ul>
                  {SENSITIVITY_LABEL[t.sensitivity] && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-300/80"><ShieldAlert className="h-3.5 w-3.5" /> {SENSITIVITY_LABEL[t.sensitivity]}</p>
                  )}
                  <Button onClick={() => create(t)} disabled={!!creating} className="mt-auto gap-2">
                    {creating === t.slug && <Loader2 className="h-4 w-4 animate-spin" />} Criar este squad
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
