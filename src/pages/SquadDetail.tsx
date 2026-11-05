import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSquad, useSquadActions, useSquadMemories, useSquadMissions, useSquadTemplates } from "@/hooks/useSquads";
import { MemoryPanel } from "@/components/squads/MemoryPanel";
import { TemplateFormFields, missingRequired } from "@/components/squads/TemplateFormFields";
import { CostCapField, fmtUsd } from "@/components/squads/CostCapField";
import { MissionPanel, MISSION_STATUS } from "@/components/squads/MissionPanel";
import { SchedulePanel } from "@/components/squads/SchedulePanel";

export default function SquadDetail() {
  const { squadId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSquad(squadId);
  const { data: templates = [] } = useSquadTemplates();
  const { data: missions = [] } = useSquadMissions(squadId);
  const { startMission, deleteSquad } = useSquadActions();
  const { data: memories = [] } = useSquadMemories(squadId);
  const pendingMemories = memories.filter((m) => m.status === "suggested").length;

  const squad = data?.squad;
  const agents = data?.agents || [];
  const template = templates.find((t) => t.slug === squad?.template_slug);

  const [values, setValues] = useState<Record<string, string>>({});
  const [cap, setCap] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("missoes");

  useEffect(() => { if (squad) { setCap(Number(squad.default_cost_cap_usd)); } }, [squad?.id]);
  // Abre a missão mais recente ao entrar na página.
  useEffect(() => { if (!selected && missions.length) setSelected(missions[0].id); }, [missions.length]);

  if (isLoading || !template && templates.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>;
  }
  if (!squad || !template) {
    return (
      <div className="p-8 text-center text-white/60">
        Squad não encontrado. <Link to="/squads" className="underline">Voltar para a lista</Link>
      </div>
    );
  }

  const missing = missingRequired(template.formFields, values);

  const start = async () => {
    if (missing.length) { toast.error(`Preencha: ${missing.join(", ")}`); return; }
    try {
      const { mission, piiFindings } = await startMission.mutateAsync({ squadId: squad.id, formData: values, costCapUsd: cap });
      if (piiFindings.length) toast.warning("Identificadores pessoais foram mascarados antes do envio ao modelo.");
      setValues({});
      setSelected(mission.id);
      setTab("missoes");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível iniciar a missão");
    }
  };

  const remove = async () => {
    try { await deleteSquad.mutateAsync(squad.id); navigate("/squads"); }
    catch (e: any) { toast.error(e.message || "Não foi possível apagar"); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <Link to="/squads" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Squads</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{squad.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-white/20 text-white/60">{squad.kind === "continuous" ? "Contínuo" : "Por missão"}</Badge>
              {agents.map((a) => <Badge key={a.id} variant="outline" className="border-white/10 text-white/50" title={a.role}>{a.name}</Badge>)}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-white/40 hover:text-red-300"><Trash2 className="h-4 w-4" /> Apagar squad</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar este squad?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">Missões, entregas e agendamento deste squad serão apagados. Não dá para desfazer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/20 bg-transparent">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {squad.sensitivity !== "normal" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-amber-300/80">
            <ShieldAlert className="h-4 w-4" />
            {squad.sensitivity === "dados_saude"
              ? "Squad de dados de saúde: use apenas dados anonimizados. Identificadores óbvios são mascarados, mas nomes de pessoas não são detectados."
              : "Este squad lida com dados pessoais comuns. Não inclua dados de saúde."}
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="missoes">Missões</TabsTrigger>
          <TabsTrigger value="nova">{template.kind === "continuous" ? "Executar agora" : "Nova missão"}</TabsTrigger>
          {template.kind === "continuous" && <TabsTrigger value="agenda">Agendamento</TabsTrigger>}
          <TabsTrigger value="memoria">Memória{pendingMemories > 0 && <Badge className="ml-2 h-5 bg-amber-400 px-1.5 text-black hover:bg-amber-400" aria-label={`${pendingMemories} sugestões para revisar`}>{pendingMemories}</Badge>}</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="missoes" className="mt-6">
          {missions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-10 text-center">
              <p className="text-white/60">Nenhuma missão ainda.</p>
              <Button className="mt-4" onClick={() => setTab("nova")}>{template.kind === "continuous" ? "Executar agora" : "Criar a primeira missão"}</Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
              <ul className="space-y-1.5">
                {missions.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSelected(m.id)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selected === m.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
                      <div className="line-clamp-2 font-medium">{m.briefing}</div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className={MISSION_STATUS[m.status].className.split(" ").find((c) => c.startsWith("text-"))}>{MISSION_STATUS[m.status].label}</span>
                        <span className="text-white/40">{new Date(m.created_at).toLocaleDateString("pt-BR")} · {fmtUsd(Number(m.cost_usd))}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-w-0">
                {selected && <MissionPanel key={selected} missionId={selected} squadId={squad.id} agents={agents} template={template} environment={squad.environment} />}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="nova" className="mt-6 max-w-2xl space-y-6">
          <TemplateFormFields fields={template.formFields} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
          <CostCapField value={cap} onChange={setCap} max={template.maxCapUsd} estimate={template.estimatedCostUsd} />
          <Button onClick={start} disabled={startMission.isPending} className="gap-2">
            {startMission.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Iniciar missão
          </Button>
        </TabsContent>

        {template.kind === "continuous" && (
          <TabsContent value="agenda" className="mt-6 max-w-2xl"><SchedulePanel squad={squad} template={template} /></TabsContent>
        )}

        <TabsContent value="memoria" className="mt-6 max-w-2xl"><MemoryPanel squad={squad} /></TabsContent>

        <TabsContent value="equipe" className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {agents.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">{a.name}</div>
                <div className="text-sm text-white/50">{a.role}</div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
