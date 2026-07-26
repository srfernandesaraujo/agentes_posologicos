import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Send, Square, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const sb: any = supabase;

type Msg = { role: "patient" | "student"; content: string; ts: string };

export default function OSCEAttendance() {
  const { attemptId } = useParams();
  const [searchParams] = useSearchParams();
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

  // Guest token: prefer URL param, fallback to localStorage by session
  const guestTokenFromUrl = searchParams.get("guest");
  const [guestToken, setGuestToken] = useState<string | null>(guestTokenFromUrl);
  const isGuest = !user && !!guestToken;

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      // Resolve guest token from localStorage if not in URL
      let token = guestTokenFromUrl;
      if (!user && !token) {
        // try every osce_guest_* key
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("osce_guest_")) {
            try { const v = JSON.parse(localStorage.getItem(k) || ""); if (v?.token) { token = v.token; break; } } catch { /* */ }
          }
        }
      }
      setGuestToken(token || null);

      // Fetch via edge function so guests work
      const { data, error } = await supabase.functions.invoke("osce-session-control", {
        body: { action: "attempt", attemptId, guestToken: token || null },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Tentativa não encontrada");
        navigate(user ? "/osce" : "/osce/entrar"); return;
      }
      const a = (data as any).attempt;
      const st = (data as any).station;
      setAttempt(a);
      setStation(st);
      setHistory(Array.isArray(a.transcript) ? a.transcript : []);
      if (a.status === "completed") {
        navigate(a.session_id ? `/osce/sala/${a.session_id}` : `/osce/resultado/${a.id}`);
      }
    })();
  }, [attemptId]);

  // If in a live session, listen for session changes (auto-advance / finish) and bounce back
  useEffect(() => {
    if (!attempt?.session_id) return;
    const sessionId = attempt.session_id;
    const ch = supabase
      .channel(`osce-att-session-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "osce_attempts", filter: `id=eq.${attemptId}` }, (payload: any) => {
        if (payload.new?.status === "completed") navigate(`/osce/sala/${sessionId}`);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "osce_exam_sessions", filter: `id=eq.${sessionId}` }, (payload: any) => {
        const ns = payload.new;
        if (ns?.status === "paused" || ns?.status === "finished") navigate(`/osce/sala/${sessionId}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [attempt?.session_id, attemptId, navigate]);

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
        body: { attemptId, guestToken, history, userMessage: message },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "...";
      const patientMsg: Msg = { role: "patient", content: reply, ts: new Date().toISOString() };
      const newHistory = [...next, patientMsg];
      setHistory(newHistory);
      if (isGuest) {
        await supabase.functions.invoke("osce-session-control", {
          body: { action: "save-transcript", attemptId, guestToken, transcript: newHistory },
        });
      } else {
        await sb.from("osce_attempts").update({ transcript: newHistory }).eq("id", attemptId);
      }
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
      if (isGuest) {
        await supabase.functions.invoke("osce-session-control", {
          body: { action: "save-transcript", attemptId, guestToken, transcript: history },
        });
      } else {
        await sb.from("osce_attempts").update({ transcript: history }).eq("id", attemptId);
      }
      const { data, error } = await supabase.functions.invoke("osce-evaluate", {
        body: { attemptId, guestToken: isGuest ? guestToken : undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) { toast.error((data as any).error); setEvaluating(false); return; }
      navigate(attempt?.session_id ? `/osce/sala/${attempt.session_id}` : `/osce/resultado/${attemptId}`);
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
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{station.scenario_brief}</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 shadow-sm ${overtime ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"}`}>
              <Clock className="h-4 w-4 shrink-0" />
              <div className="flex items-baseline gap-1 font-mono leading-none">
                <span className="text-lg font-bold tabular-nums">{mm}:{ss}</span>
                <span className="text-xs opacity-60 tabular-nums">/ {String(station.duration_minutes).padStart(2, "0")}:00</span>
              </div>
            </div>
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
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "student" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-[10px] opacity-70 mb-0.5">{m.role === "student" ? "Você (aluno)" : "Paciente"}</div>
                {m.role === "patient" ? (
                  <div className="space-y-2 [&_p]:m-0 [&_p+p]:mt-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ node, ...props }) => (
                          <div className="my-2 overflow-x-auto rounded-md border border-border bg-background">
                            <table className="w-full text-xs" {...props} />
                          </div>
                        ),
                        thead: (props) => <thead className="bg-muted/60" {...props} />,
                        th: (props) => <th className="border-b border-border px-3 py-2 text-left font-semibold" {...props} />,
                        td: (props) => <td className="border-b border-border/60 px-3 py-1.5 align-top" {...props} />,
                        tr: (props) => <tr className="even:bg-muted/20" {...props} />,
                        code: (props) => <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
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