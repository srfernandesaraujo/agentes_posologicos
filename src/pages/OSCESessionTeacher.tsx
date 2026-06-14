import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Play, SkipForward, Square, Pause, Users, Clock, Trophy } from "lucide-react";

const sb: any = supabase;

export default function OSCESessionTeacher() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const { data: s } = await sb.from("osce_exam_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!s) return;
    setSession(s);
    const { data: ex } = await sb.from("osce_exams").select("*").eq("id", s.exam_id).maybeSingle();
    setExam(ex);
    const { data: exSt } = await sb.from("osce_exam_stations")
      .select("station_id, order_index, osce_stations(*)").eq("exam_id", s.exam_id)
      .order("order_index", { ascending: true });
    setStations((exSt || []).map((r: any) => r.osce_stations).filter(Boolean));
    const { data: ps } = await sb.from("osce_session_participants").select("*").eq("session_id", sessionId);
    setParticipants(ps || []);
    const { data: ats } = await sb.from("osce_attempts").select("*").eq("session_id", sessionId);
    setAttempts(ats || []);
    const ids = Array.from(new Set((ps || []).map((p: any) => p.user_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await sb.from("profiles").select("user_id, display_name").in("user_id", ids);
      const m: Record<string, string> = {};
      (profs || []).forEach((p: any) => { m[p.user_id] = p.display_name || "Aluno"; });
      setProfiles(m);
    }
  }

  useEffect(() => { if (sessionId) loadAll(); }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`osce-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "osce_exam_sessions", filter: `id=eq.${sessionId}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "osce_session_participants", filter: `session_id=eq.${sessionId}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "osce_attempts", filter: `session_id=eq.${sessionId}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  useEffect(() => {
    if (!session?.current_station_started_at || session.status !== "running") {
      setElapsed(0);
      return;
    }
    const start = new Date(session.current_station_started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [session?.current_station_started_at, session?.status]);

  async function act(action: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("osce-session-control", { body: { action, sessionId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      await loadAll();
    } catch (e: any) { toast.error(e.message || "Falha"); }
    finally { setBusy(false); }
  }

  if (!session) return <div className="container py-8">Carregando...</div>;

  const currentIdx = session.current_station_index ?? -1;
  const currentStation = currentIdx >= 0 && currentIdx < stations.length ? stations[currentIdx] : null;
  const totalSec = (currentStation?.duration_minutes || 8) * 60;
  const pct = Math.min(100, (elapsed / totalSec) * 100);
  const overtime = elapsed > totalSec;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  // Ranking — supports guests (user_id null) via guest_token
  const participantKey = (p: any) => p.user_id || `g:${p.guest_token}`;
  const participantName = (p: any) =>
    p.user_id ? (profiles[p.user_id] || p.display_name || "Aluno") : (p.display_name || p.guest_name || p.guest_email || "Convidado");
  const ranking = participants.map((p) => {
    const myAttempts = attempts.filter((a) =>
      p.user_id ? a.user_id === p.user_id : (a.guest_token && a.guest_token === p.guest_token)
    );
    const total = myAttempts.reduce((s, a) => s + Number(a.score || 0), 0);
    const max = myAttempts.reduce((s, a) => s + Number(a.max_score || 0), 0);
    const inProgress = myAttempts.find((a) => a.status === "in_progress");
    return {
      key: participantKey(p),
      name: participantName(p),
      total, max,
      completed: myAttempts.filter((a) => a.status === "completed").length,
      inProgress: !!inProgress,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <Link to="/osce"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> OSCE</Button></Link>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{exam?.title}</h1>
          <p className="text-sm text-muted-foreground">Sessão ao vivo · {stations.length} estações</p>
        </div>
        <Card className="border-primary">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase">PIN da sala</div>
            <div className="text-5xl font-bold font-mono tracking-[0.3em] text-primary">{session.pin}</div>
            <div className="text-xs text-muted-foreground mt-1">Alunos entram em <strong>/osce/entrar</strong></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Badge variant={session.status === "running" ? "default" : session.status === "finished" ? "secondary" : "outline"}>
              {session.status === "waiting" ? "Aguardando" : session.status === "running" ? "Em andamento" : session.status === "paused" ? "Pausada" : "Encerrada"}
            </Badge>
            {currentStation && <span className="text-base">Estação {currentIdx + 1}/{stations.length}: {currentStation.title}</span>}
          </CardTitle>
          {currentStation && session.status === "running" && (
            <Badge variant={overtime ? "destructive" : "outline"} className="gap-1 text-base px-3 py-1">
              <Clock className="h-4 w-4" /> {mm}:{ss} / {currentStation.duration_minutes}:00
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {currentStation && <Progress value={pct} className={overtime ? "[&>div]:bg-destructive" : ""} />}
          <div className="flex gap-2 flex-wrap">
            {session.status === "waiting" && (
              <Button onClick={() => act("start", `Iniciar a prova para ${participants.length} aluno(s)?`)} disabled={busy || participants.length === 0} className="gap-2">
                <Play className="h-4 w-4" /> Iniciar prova
              </Button>
            )}
            {session.status === "running" && (
              <>
                <Button onClick={() => act("pause")} variant="outline" disabled={busy} className="gap-2"><Pause className="h-4 w-4" /> Pausar</Button>
                {currentIdx + 1 < stations.length && (
                  <Button onClick={() => act("next", "Avaliar a estação atual e avançar para a próxima?")} disabled={busy} className="gap-2">
                    <SkipForward className="h-4 w-4" /> Próxima estação
                  </Button>
                )}
                <Button onClick={() => act("finish", "Avaliar a estação atual e encerrar a sessão?")} variant="destructive" disabled={busy} className="gap-2">
                  <Square className="h-4 w-4" /> Encerrar prova
                </Button>
              </>
            )}
            {session.status === "paused" && (
              <Button onClick={() => act("resume")} disabled={busy} className="gap-2"><Play className="h-4 w-4" /> Retomar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Participantes ({participants.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-96 overflow-y-auto">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Compartilhe o PIN para os alunos entrarem.</p>
            ) : participants.map((p) => (
              <div key={participantKey(p)} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span>
                  {participantName(p)}
                  {!p.user_id && <Badge variant="outline" className="ml-2 text-[10px]">convidado</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(p.joined_at).toLocaleTimeString("pt-BR")}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Ranking parcial</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-96 overflow-y-auto">
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : ranking.map((r, i) => (
              <div key={r.key} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span><strong>{i + 1}.</strong> {r.name} {r.inProgress && <Badge variant="outline" className="ml-1 text-[10px]">atendendo</Badge>}</span>
                <span className="font-mono">{r.total.toFixed(1)}/{r.max.toFixed(1)} · {r.completed} est.</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}