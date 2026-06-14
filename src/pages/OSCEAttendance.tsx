import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Send, Square, Clock } from "lucide-react";

const sb: any = supabase;

type Msg = { role: "patient" | "student"; content: string; ts: string };

export default function OSCEAttendance() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [station, setStation] = useState<any>(null);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      const { data: a } = await sb.from("osce_attempts").select("*").eq("id", attemptId).maybeSingle();
      if (!a) { toast.error("Tentativa não encontrada"); navigate("/osce"); return; }
      setAttempt(a);
      setHistory(Array.isArray(a.transcript) ? a.transcript : []);
      const { data: st } = await sb.from("osce_stations").select("*").eq("id", a.station_id).maybeSingle();
      setStation(st);
      if (a.status === "completed") navigate(`/osce/resultado/${a.id}`);
    })();
  }, [attemptId]);

  useEffect(() => {
    if (!attempt) return;
    const start = new Date(attempt.started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [attempt]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const totalSec = (station?.duration_minutes || 8) * 60;
  const pct = Math.min(100, (elapsed / totalSec) * 100);
  const overtime = elapsed > totalSec;

  async function send() {
    if (!input.trim() || sending) return;
    const message = input.trim();
    setInput("");
    setSending(true);
    const studentMsg: Msg = { role: "student", content: message, ts: new Date().toISOString() };
    const next = [...history, studentMsg];
    setHistory(next);
    try {
      const { data, error } = await supabase.functions.invoke("osce-patient", {
        body: { stationId: station.id, history, userMessage: message },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "...";
      const patientMsg: Msg = { role: "patient", content: reply, ts: new Date().toISOString() };
      const newHistory = [...next, patientMsg];
      setHistory(newHistory);
      await sb.from("osce_attempts").update({ transcript: newHistory }).eq("id", attemptId);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar resposta");
    } finally {
      setSending(false);
    }
  }

  async function finish() {
    if (!confirm("Encerrar atendimento e avaliar?")) return;
    setEvaluating(true);
    try {
      await sb.from("osce_attempts").update({ transcript: history }).eq("id", attemptId);
      const { data, error } = await supabase.functions.invoke("osce-evaluate", { body: { attemptId } });
      if (error) throw error;
      if ((data as any)?.error) { toast.error((data as any).error); setEvaluating(false); return; }
      navigate(`/osce/resultado/${attemptId}`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao avaliar"); setEvaluating(false);
    }
  }

  if (!attempt || !station) return <div className="container py-8">Carregando...</div>;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="container max-w-3xl py-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold">{station.title}</h1>
            <p className="text-xs text-muted-foreground line-clamp-2">{station.scenario_brief}</p>
          </div>
          <div className="text-right">
            <Badge variant={overtime ? "destructive" : "outline"} className="gap-1">
              <Clock className="h-3 w-3" /> {mm}:{ss} / {station.duration_minutes}:00
            </Badge>
          </div>
        </div>
        <Progress value={pct} className={overtime ? "[&>div]:bg-destructive" : ""} />
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              O paciente está aguardando. Inicie com sua apresentação.
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "student" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-[10px] opacity-70 mb-0.5">{m.role === "student" ? "Você (aluno)" : "Paciente"}</div>
                {m.content}
              </div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground italic">Paciente está pensando...</div>}
          <div ref={endRef} />
        </CardContent>
      </Card>

      <div className="mt-3 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fale com o paciente..."
          rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={sending || evaluating}
        />
        <div className="flex flex-col gap-2">
          <Button onClick={send} disabled={sending || evaluating || !input.trim()}><Send className="h-4 w-4" /></Button>
          <Button variant="destructive" onClick={finish} disabled={evaluating || history.length < 2} title="Encerrar">
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {evaluating && <p className="text-center text-sm text-muted-foreground mt-2">Avaliando desempenho...</p>}
    </div>
  );
}