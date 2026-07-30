import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMyInstitutions } from "@/hooks/useInstitutions";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus, Award } from "lucide-react";

const sb: any = supabase;

const CERTIFICATION_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Em análise", className: "bg-amber-500/20 text-amber-300" },
  certified: { label: "Certificada", className: "bg-emerald-500/20 text-emerald-300" },
  rejected: { label: "Rejeitada", className: "bg-red-500/20 text-red-300" },
};

const DEFAULT_RUBRIC = [
  { criterion: "Apresentação e empatia inicial", max_score: 2 },
  { criterion: "Anamnese sistemática e perguntas-chave", max_score: 3 },
  { criterion: "Hipótese diagnóstica fundamentada", max_score: 2 },
  { criterion: "Conduta terapêutica adequada e segura", max_score: 2 },
  { criterion: "Comunicação clara com o paciente", max_score: 1 },
];

export default function OSCEStationEditor() {
  const { id } = useParams();
  const isNew = !id || id === "nova";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<any>({
    title: "", specialty: "", duration_minutes: 8, difficulty: "medio",
    scenario_brief: "", patient_persona: "", patient_symptoms: "", patient_omissions: "",
    expected_questions: [""], expected_conducts: [""], rubric: DEFAULT_RUBRIC, is_public: false,
    exam_results: [], institution_id: null, certification_status: "none", review_note: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const { data: myInstitutions } = useMyInstitutions();
  const eligibleInstitutions = (myInstitutions || []).filter(
    (m) => m.role === "institution_admin" || m.role === "teacher"
  );

  useEffect(() => {
    if (isNew) return;
    sb.from("osce_stations").select("*").eq("id", id).maybeSingle().then(({ data }: any) => {
      if (data) setForm({
        ...data,
        expected_questions: data.expected_questions?.length ? data.expected_questions : [""],
        expected_conducts: data.expected_conducts?.length ? data.expected_conducts : [""],
        rubric: data.rubric?.length ? data.rubric : DEFAULT_RUBRIC,
        exam_results: Array.isArray(data.exam_results) ? data.exam_results : [],
      });
    });
  }, [id]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.title.trim() || !form.scenario_brief.trim() || !form.patient_persona.trim()) {
      toast.error("Preencha título, cenário e persona"); return;
    }
    const payload = {
      ...form,
      expected_questions: form.expected_questions.filter((s: string) => s.trim()),
      expected_conducts: form.expected_conducts.filter((s: string) => s.trim()),
      rubric: form.rubric.filter((r: any) => r.criterion?.trim()),
      exam_results: (form.exam_results || []).filter((e: any) => e?.name?.trim() && e?.content?.trim()),
      user_id: user!.id,
    };
    delete payload.created_at; delete payload.updated_at;
    delete payload.certification_status; delete payload.submitted_at;
    delete payload.certified_at; delete payload.certified_by; delete payload.review_note;
    const res = isNew
      ? await sb.from("osce_stations").insert(payload).select().single()
      : await sb.from("osce_stations").update(payload).eq("id", id).select().single();
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Salvo");
    navigate("/osce");
  }

  async function remove() {
    if (isNew) return;
    if (!confirm("Excluir esta estação?")) return;
    await sb.from("osce_stations").delete().eq("id", id);
    navigate("/osce");
  }

  async function submitForCertification() {
    if (isNew || !form.institution_id) return;
    if (!confirm("Submeter esta estação para certificação? Um admin da plataforma vai revisar antes de disponibilizá-la no banco compartilhado entre instituições.")) return;
    setSubmitting(true);
    const { error } = await sb.rpc("submit_station_for_certification", { p_station_id: id });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Submetida para certificação.");
    set("certification_status", "pending");
  }

  return (
    <div className="container max-w-3xl py-8 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/osce")} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      <h1 className="text-2xl font-bold">{isNew ? "Nova estação" : "Editar estação"}</h1>

      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Especialidade</Label><Input value={form.specialty || ""} onChange={(e) => set("specialty", e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={3} max={20} value={form.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value))} /></div>
            <div><Label>Dificuldade</Label>
              <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facil">Fácil (10 cr)</SelectItem>
                  <SelectItem value="medio">Médio (15 cr)</SelectItem>
                  <SelectItem value="dificil">Difícil (20 cr)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_public} onCheckedChange={(v) => set("is_public", v)} />
            <Label>Pública (qualquer aluno pode atender)</Label>
          </div>
          {eligibleInstitutions.length > 0 && (
            <div>
              <Label>Instituição (compartilhar com membros dela)</Label>
              <Select
                value={form.institution_id || "none"}
                onValueChange={(v) => set("institution_id", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {eligibleInstitutions.map((m) => (
                    <SelectItem key={m.institution_id} value={m.institution_id}>{m.institution_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.certification_status && form.certification_status !== "none" && (
            <div className="flex items-center gap-2">
              <Badge className={CERTIFICATION_LABELS[form.certification_status]?.className}>
                {CERTIFICATION_LABELS[form.certification_status]?.label}
              </Badge>
              {form.certification_status === "rejected" && form.review_note && (
                <span className="text-xs text-muted-foreground">Motivo: {form.review_note}</span>
              )}
            </div>
          )}
          {!isNew && form.institution_id && ["none", "rejected"].includes(form.certification_status) && (
            <Button variant="outline" size="sm" className="gap-1" disabled={submitting} onClick={submitForCertification}>
              <Award className="h-3.5 w-3.5" /> Submeter para certificação
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cenário e paciente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Briefing do cenário (visível ao aluno antes de iniciar) *</Label>
            <Textarea rows={3} value={form.scenario_brief} onChange={(e) => set("scenario_brief", e.target.value)} placeholder="Você está no pronto-atendimento. Paciente do sexo masculino, 58 anos, chega com dor no peito há 2 horas..." /></div>
          <div><Label>Persona do paciente (invisível) *</Label>
            <Textarea rows={3} value={form.patient_persona} onChange={(e) => set("patient_persona", e.target.value)} placeholder="Sr. José, pedreiro, ansioso, evita falar de hábitos. Tabagista..." /></div>
          <div><Label>Sintomas e história (invisível) *</Label>
            <Textarea rows={4} value={form.patient_symptoms} onChange={(e) => set("patient_symptoms", e.target.value)} /></div>
          <div><Label>Omissões (só revela se perguntado)</Label>
            <Textarea rows={3} value={form.patient_omissions || ""} onChange={(e) => set("patient_omissions", e.target.value)} placeholder="- usa sildenafila ocasionalmente; - histórico familiar de IAM precoce" /></div>
        </CardContent>
      </Card>

      <ListEditor label="Perguntas-chave esperadas" items={form.expected_questions} onChange={(v) => set("expected_questions", v)} />
      <ListEditor label="Condutas esperadas" items={form.expected_conducts} onChange={(v) => set("expected_conducts", v)} />

      <Card>
        <CardHeader><CardTitle>Resultados de exames (laboratoriais / imagem)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cadastre exames que o paciente possui. Eles só serão revelados se o aluno perguntar/solicitar. O paciente virtual apresentará o exame em tabela markdown bem formatada.
          </p>
          {(form.exam_results || []).map((ex: any, i: number) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Label>Nome do exame</Label>
                  <Input value={ex.name || ""} placeholder="Ex.: Hemograma completo, ECG, Raio-X de tórax"
                    onChange={(e) => { const arr = [...form.exam_results]; arr[i] = { ...arr[i], name: e.target.value }; set("exam_results", arr); }} />
                </div>
                <div className="col-span-4">
                  <Label>Categoria</Label>
                  <Select value={ex.category || "laboratorial"} onValueChange={(v) => { const arr = [...form.exam_results]; arr[i] = { ...arr[i], category: v }; set("exam_results", arr); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laboratorial">Laboratorial</SelectItem>
                      <SelectItem value="imagem">Imagem</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-end justify-end">
                  <Button variant="ghost" size="icon" onClick={() => set("exam_results", form.exam_results.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Resultado (use tabela markdown ou descrição)</Label>
                <Textarea rows={6} value={ex.content || ""}
                  placeholder={"| Parâmetro | Resultado | Referência |\n|---|---|---|\n| Hemoglobina | 10,2 g/dL | 13-17 |\n| Leucócitos | 14.500 | 4.000-10.000 |"}
                  onChange={(e) => { const arr = [...form.exam_results]; arr[i] = { ...arr[i], content: e.target.value }; set("exam_results", arr); }} />
              </div>
              <div>
                <Label className="text-xs">Laudo/observações (opcional)</Label>
                <Textarea rows={2} value={ex.notes || ""} placeholder="Ex.: Laudo do RX — infiltrado em base direita compatível com pneumonia."
                  onChange={(e) => { const arr = [...form.exam_results]; arr[i] = { ...arr[i], notes: e.target.value }; set("exam_results", arr); }} />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => set("exam_results", [...(form.exam_results || []), { name: "", category: "laboratorial", content: "", notes: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Adicionar exame
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rubrica de avaliação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {form.rubric.map((r: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <Input className="flex-1" value={r.criterion} placeholder="Critério" onChange={(e) => {
                const arr = [...form.rubric]; arr[i] = { ...arr[i], criterion: e.target.value }; set("rubric", arr);
              }} />
              <Input className="w-20" type="number" min={1} max={10} value={r.max_score} onChange={(e) => {
                const arr = [...form.rubric]; arr[i] = { ...arr[i], max_score: Number(e.target.value) }; set("rubric", arr);
              }} />
              <Button variant="ghost" size="icon" onClick={() => set("rubric", form.rubric.filter((_: any, j: number) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => set("rubric", [...form.rubric, { criterion: "", max_score: 1 }])}>
            <Plus className="h-3.5 w-3.5" /> Critério
          </Button>
          <p className="text-xs text-muted-foreground">Soma de pontos = nota máxima. Padrão soma 10.</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save}>Salvar</Button>
        {!isNew && <Button variant="destructive" onClick={remove}>Excluir</Button>}
      </div>
    </div>
  );
}

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input value={it} onChange={(e) => { const arr = [...items]; arr[i] = e.target.value; onChange(arr); }} />
            <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => onChange([...items, ""])}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
      </CardContent>
    </Card>
  );
}