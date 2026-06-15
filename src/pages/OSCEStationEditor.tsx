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
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus } from "lucide-react";

const sb: any = supabase;

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
    exam_results: [],
  });

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