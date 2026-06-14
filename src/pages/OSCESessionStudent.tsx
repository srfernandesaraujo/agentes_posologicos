import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Clock, Trophy } from "lucide-react";

const sb: any = supabase;

export default function OSCESessionStudent() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [elapsed, setElapsed] = useState(0);

  async function loadAll() {
    if (!sessionId || !user) return;
    const { data: s } = await sb.from("osce_exam_sessions").select("*").eq("id", sessionId).maybeSingle();
    setSession(s);
    if (!s) return;
    const { data: p } = await sb.from("osce_session_participants").select("*")
      .eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
    setParticipant(p);
    const { data: ats } = await sb.from("osce_attempts").select("*, osce_stations(title, duration_minutes)")
      .eq("session_id", sessionId).eq("user_id", user.id).order("created_at", { ascending: true });
    setAttempts(ats || []);
    const { data: exSt } = await sb.from("osce_exam_stations")
      .select("order_index, osce_stations(title, duration_minutes)").eq("exam_id", s.exam_id)
      .order("order_index", { ascending: true });
    setStations((exSt || []).map((r: any) => r.osce_stations).filter(Boolean));
  }

  useEffect(() => { loadAll(); }, [sessionId, user?.id]);

  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`osce-student-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "osce_exam_sessions", filter: `id=eq.${sessionId}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "osce_session_participants", filter: `session_id=eq.${sessionId}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "osce_attempts", filter: `session_id=eq.${sessionId}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // Auto-redirect to in-progress attempt
  useEffect(() => {
    if (session?.status !== "running") return;
    const cur = attempts.find((a) => a.status === "in_progress");
    if (cur) navigate(`/osce/atendimento/${cur.id}`);
  }, [session?.status, attempts, navigate]);

  // Elapsed timer for current station
  useEffect(() => {
    if (!session?.current_station_started_at) { setElapsed(0); return; }
    const start = new Date(session.current_station_started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [session?.current_station_started_at]);

  if (!session) return <div className="container py-8">Carregando sessão...</div>;

  // Finished view
  if (session.status === "finished") {
    const total = attempts.reduce((s, a) => s + Number(a.score || 0), 0);
    const max = attempts.reduce((s, a) => s + Number(a.max_score || 0), 0);
    return (
      <div className="container max-w-3xl py-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Prova encerrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center py-4">
              <div className="text-5xl font-bold gradient-text">{total.toFixed(1)}<span className="text-muted-foreground text-2xl">/{max.toFixed(1)}</span></div>
              <p className="text-sm text-muted-foreground mt-1">Pontuação total · {attempts.length} estações</p>
            </div>
            <div className="space-y-2">
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm">{a.osce_stations?.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{a.feedback}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{Number(a.score || 0).toFixed(1)}/{Number(a.max_score || 0).toFixed(1)}</Badge>
                    <a href={`/osce/resultado/${a.id}`} className="text-xs underline">Ver</a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIdx = session.current_station_index ?? -1;
  const currentStation = currentIdx >= 0 && currentIdx < stations.length ? stations[currentIdx] : null;
  const totalSec = (currentStation?.duration_minutes || 8) * 60;
  const pct = Math.min(100, (elapsed / totalSec) * 100);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="container max-w-2xl py-12 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {session.status === "waiting" ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Aguardando o professor iniciar</>
            ) : session.status === "paused" ? (
              <><Clock className="h-5 w-5" /> Prova pausada</>
            ) : (
              <><Loader2 className="h-5 w-5 animate-spin" /> Preparando próxima estação...</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session.status === "waiting" && (
            <>
              <p className="text-sm text-muted-foreground">Você está na sala. Quando o professor iniciar, você será levado automaticamente para a estação 1.</p>
              <div className="text-center py-4">
                <div className="text-xs text-muted-foreground uppercase">PIN</div>
                <div className="text-3xl font-bold font-mono tracking-[0.3em]">{session.pin}</div>
              </div>
            </>
          )}
          {session.status === "paused" && (
            <p className="text-sm text-muted-foreground">Aguarde — o professor retomará a sessão.</p>
          )}
          {currentStation && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span>Estação atual: <strong>{currentStation.title}</strong></span>
                <span className="font-mono">{mm}:{ss} / {currentStation.duration_minutes}:00</span>
              </div>
              <Progress value={pct} />
            </div>
          )}
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Suas estações</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {attempts.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1">
                <span>{i + 1}. {a.osce_stations?.title}</span>
                {a.status === "completed" ? (
                  <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {Number(a.score || 0).toFixed(1)}/{Number(a.max_score || 0).toFixed(1)}</Badge>
                ) : (
                  <Badge variant="outline">em andamento</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}