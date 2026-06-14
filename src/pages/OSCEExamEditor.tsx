import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Play, Trophy } from "lucide-react";

const sb: any = supabase;

export default function OSCEExamEditor() {
  const { id } = useParams();
  const isNew = !id || id === "nova";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exam, setExam] = useState<any>({ title: "", description: "", is_open: true });
  const [stations, setStations] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    sb.from("osce_stations").select("*").then(({ data }: any) => setStations(data || []));
    if (isNew) return;
    sb.from("osce_exams").select("*").eq("id", id).maybeSingle().then(({ data }: any) => data && setExam(data));
    sb.from("osce_exam_stations").select("station_id").eq("exam_id", id).then(({ data }: any) => {
      setSelected(new Set((data || []).map((r: any) => r.station_id)));
    });
    (async () => {
      const { data } = await sb.from("osce_attempts").select("*, osce_stations(title)").eq("exam_id", id).order("created_at", { ascending: false });
      const list = data || [];
      const userIds = Array.from(new Set(list.map((a: any) => a.user_id)));
      if (userIds.length) {
        const { data: profs } = await sb.from("profiles").select("user_id,display_name").in("user_id", userIds);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.display_name; });
        list.forEach((a: any) => { a._student = map[a.user_id] || "Aluno"; });
      }
      setAttempts(list);
    })();
  }, [id]);

  async function save() {
    if (!exam.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload = { title: exam.title, description: exam.description, is_open: exam.is_open, user_id: user!.id };
    const res = isNew
      ? await sb.from("osce_exams").insert(payload).select().single()
      : await sb.from("osce_exams").update(payload).eq("id", id).select().single();
    if (res.error) { toast.error(res.error.message); return; }
    const examId = res.data.id;
    if (!isNew) await sb.from("osce_exam_stations").delete().eq("exam_id", examId);
    const rows = Array.from(selected).map((sid, i) => ({ exam_id: examId, station_id: sid, order_index: i }));
    if (rows.length) await sb.from("osce_exam_stations").insert(rows);
    toast.success("Prova salva");
    navigate(`/osce/prova/${examId}`);
  }

  // Aggregate stats
  const byStudent: Record<string, { name: string; total: number; max: number; n: number }> = {};
  attempts.forEach((a) => {
    if (a.status !== "completed") return;
    const k = a.user_id;
      if (!byStudent[k]) byStudent[k] = { name: a._student || "Aluno", total: 0, max: 0, n: 0 };
    byStudent[k].total += Number(a.score || 0);
    byStudent[k].max += Number(a.max_score || 0);
    byStudent[k].n += 1;
  });

  return (
    <div className="container max-w-4xl py-8 space-y-4">
      <Link to="/osce"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> OSCE</Button></Link>
      <h1 className="text-2xl font-bold">{isNew ? "Nova prova" : exam.title}</h1>

      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={2} value={exam.description || ""} onChange={(e) => setExam({ ...exam, description: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Estações ({selected.size} selecionadas)</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-80 overflow-y-auto">
          {stations.map((st) => (
            <label key={st.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
              <Checkbox checked={selected.has(st.id)} onCheckedChange={(v) => {
                const s = new Set(selected); if (v) s.add(st.id); else s.delete(st.id); setSelected(s);
              }} />
              <div className="flex-1">
                <div className="font-medium text-sm">{st.title}</div>
                <div className="text-xs text-muted-foreground">{st.specialty} · {st.duration_minutes} min · {st.difficulty}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Button onClick={save}>Salvar prova</Button>

      {!isNew && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Desempenho da turma</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(byStudent).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tentativa concluída ainda.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(byStudent).map(([uid, s]) => (
                    <div key={uid} className="flex justify-between text-sm border-b pb-2">
                      <span>{s.name}</span>
                      <span className="font-mono">{s.total.toFixed(1)}/{s.max.toFixed(1)} · {s.n} estação(ões)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Todas as tentativas</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {attempts.map((a) => (
                <div key={a.id} className="flex justify-between text-sm py-1 border-b">
                  <span>{a._student || "Aluno"} - {a.osce_stations?.title}</span>
                  <span className="flex gap-2">
                    {a.status === "completed" ? <Badge>{Number(a.score).toFixed(1)}/{Number(a.max_score).toFixed(1)}</Badge> : <Badge variant="secondary">em andamento</Badge>}
                    <Link to={`/osce/resultado/${a.id}`}><Button size="sm" variant="ghost"><Play className="h-3.5 w-3.5" /></Button></Link>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}