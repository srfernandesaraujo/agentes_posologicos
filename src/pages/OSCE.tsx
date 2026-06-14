import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Plus, Play, BarChart3, Clock, Trophy, Radio, LogIn } from "lucide-react";
import { toast } from "sonner";

const sb: any = supabase;

export default function OSCE() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stations, setStations] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [s, e, a] = await Promise.all([
      sb.from("osce_stations").select("*").order("created_at", { ascending: false }),
      sb.from("osce_exams").select("*").order("created_at", { ascending: false }),
      sb.from("osce_attempts").select("*, osce_stations(title)").order("created_at", { ascending: false }).limit(50),
    ]);
    setStations(s.data || []);
    setExams(e.data || []);
    setAttempts(a.data || []);
    setLoading(false);
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function startAttempt(stationId: string, examId?: string) {
    const { data, error } = await sb.from("osce_attempts").insert({
      user_id: user!.id, station_id: stationId, exam_id: examId || null, status: "in_progress", transcript: [],
    }).select().single();
    if (error) { toast.error(error.message); return; }
    navigate(`/osce/atendimento/${data.id}`);
  }

  async function startLive(examId: string) {
    if (!confirm("Criar uma sessão ao vivo desta prova? Você receberá um PIN para os alunos entrarem.")) return;
    try {
      const { data, error } = await sb.functions.invoke("osce-session-control", { body: { action: "create", examId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      navigate(`/osce/sessao/${(data as any).session.id}`);
    } catch (e: any) { toast.error(e.message || "Falha ao criar sessão"); }
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-[hsl(174,62%,47%)]" /> OSCE Virtual
          </h1>
          <p className="text-sm text-muted-foreground">Estações cronometradas com paciente IA e rubrica automatizada.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/osce/entrar"><Button variant="outline" className="gap-2"><LogIn className="h-4 w-4" /> Entrar com PIN</Button></Link>
          <Link to="/osce/estacao/nova"><Button className="gap-2"><Plus className="h-4 w-4" /> Nova estação</Button></Link>
          <Link to="/osce/prova/nova"><Button variant="secondary" className="gap-2"><Plus className="h-4 w-4" /> Nova prova</Button></Link>
        </div>
      </div>

      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations">Estações</TabsTrigger>
          <TabsTrigger value="exams">Provas</TabsTrigger>
          <TabsTrigger value="attempts">Minhas tentativas</TabsTrigger>
        </TabsList>

        <TabsContent value="stations" className="mt-4">
          {loading ? <p>Carregando...</p> : stations.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma estação ainda. Crie sua primeira ou peça ao seu professor.
            </CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stations.map((st) => (
                <Card key={st.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{st.title}</CardTitle>
                      <Badge variant={st.is_public ? "default" : "secondary"}>{st.is_public ? "Pública" : "Privada"}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{st.scenario_brief}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {st.specialty && <Badge variant="outline">{st.specialty}</Badge>}
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {st.duration_minutes} min</Badge>
                      <Badge variant="outline">{st.difficulty}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 flex-1" onClick={() => startAttempt(st.id)}>
                        <Play className="h-3.5 w-3.5" /> Atender
                      </Button>
                      {st.user_id === user?.id && (
                        <Link to={`/osce/estacao/${st.id}`}><Button size="sm" variant="outline">Editar</Button></Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          {exams.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma prova criada ainda.</CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {exams.map((ex) => (
                <Card key={ex.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{ex.title}</CardTitle>
                    <CardDescription>{ex.description || "Sem descrição"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    {ex.user_id === user?.id && (
                      <Button size="sm" className="flex-1 gap-1" onClick={() => startLive(ex.id)}>
                        <Radio className="h-3.5 w-3.5" /> Aplicar ao vivo
                      </Button>
                    )}
                    <Link to={`/osce/prova/${ex.id}`} className="flex-1"><Button size="sm" variant="outline" className="w-full gap-1"><BarChart3 className="h-3.5 w-3.5" /> Detalhes</Button></Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attempts" className="mt-4">
          {attempts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Sem tentativas ainda.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {attempts.map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.osce_stations?.title || "Estação"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("pt-BR")} · {a.status === "completed" ? "Concluída" : "Em andamento"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.score != null && (
                        <Badge variant="default" className="gap-1"><Trophy className="h-3 w-3" /> {Number(a.score).toFixed(1)}/{Number(a.max_score || 10).toFixed(1)}</Badge>
                      )}
                      <Link to={a.status === "completed" ? `/osce/resultado/${a.id}` : `/osce/atendimento/${a.id}`}>
                        <Button size="sm" variant="outline">{a.status === "completed" ? "Ver" : "Continuar"}</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}