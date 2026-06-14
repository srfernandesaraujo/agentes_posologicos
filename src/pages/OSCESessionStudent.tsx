import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Clock, Trophy } from "lucide-react";

function readGuest(sessionId: string): { token: string; name?: string; email?: string } | null {
  try {
    const raw = localStorage.getItem(`osce_guest_${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ? parsed : null;
  } catch { return null; }
}

export default function OSCESessionStudent() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const guest = sessionId ? readGuest(sessionId) : null;

  async function loadState() {
    if (!sessionId) return;
    const { data, error } = await supabase.functions.invoke("osce-session-control", {
      body: { action: "state", sessionId, guestToken: guest?.token || null },
    });
    if (error || (data as any)?.error) {
      setError((data as any)?.error || error?.message || "Falha ao carregar sessão");
      return;
    }
    setError(null);
    setSession((data as any).session);
    setAttempts((data as any).attempts || []);
    setStations((data as any).stations || []);
  }

  useEffect(() => {
    loadState();
    const t = setInterval(loadState, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id]);

  // Auto-redirect to in-progress attempt
  useEffect(() => {
    if (session?.status !== "running") return;
    const cur = attempts.find((a: any) => a.status === "in_progress");
    if (cur) {
      const qs = guest?.token ? `?guest=${encodeURIComponent(guest.token)}` : "";
      navigate(`/osce/atendimento/${cur.id}${qs}`);
    }
  }, [session?.status, attempts, navigate, guest?.token]);

  useEffect(() => {
    if (!session?.current_station_started_at) { setElapsed(0); return; }
    const start = new Date(session.current_station_started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [session?.current_station_started_at]);

  if (error) return <div className="container py-8"><Card><CardContent className="p-8 text-center text-destructive">{error}</CardContent></Card></div>;
  if (!session) return <div className="container py-8">Carregando sessão...</div>;

  if (session.status === "finished") {
    const total = attempts.reduce((s: number, a: any) => s + Number(a.score || 0), 0);
    const max = attempts.reduce((s: number, a: any) => s + Number(a.max_score || 0), 0);
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
              {attempts.map((a: any) => (
                <div key={a.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{a.osce_stations?.title}</div>
                    <Badge>{Number(a.score || 0).toFixed(1)}/{Number(a.max_score || 0).toFixed(1)}</Badge>
                  </div>
                  {a.feedback && <p className="text-xs text-muted-foreground mt-1">{a.feedback}</p>}
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
            {attempts.map((a: any, i: number) => (
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