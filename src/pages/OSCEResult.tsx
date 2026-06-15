import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Trophy, CheckCircle2, AlertTriangle } from "lucide-react";

const sb: any = supabase;

export default function OSCEResult() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState<any>(null);
  const [station, setStation] = useState<any>(null);

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      const { data: a } = await sb.from("osce_attempts").select("*").eq("id", attemptId).maybeSingle();
      setAttempt(a);
      if (a) {
        const { data: st } = await sb.from("osce_stations").select("*").eq("id", a.station_id).maybeSingle();
        setStation(st);
      }
    })();
  }, [attemptId]);

  if (!attempt) return <div className="container py-8">Carregando...</div>;
  const r = attempt.rubric_result || {};
  const pct = attempt.max_score ? (Number(attempt.score) / Number(attempt.max_score)) * 100 : 0;

  return (
    <div className="container max-w-3xl py-8 space-y-4">
      <Link to="/osce"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> OSCE</Button></Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-[hsl(174,62%,47%)]" /> {station?.title || "Resultado"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-4xl font-bold">{Number(attempt.score || 0).toFixed(1)}<span className="text-xl text-muted-foreground">/{Number(attempt.max_score || 10).toFixed(1)}</span></div>
              <div className="text-xs text-muted-foreground">Duração: {Math.round((attempt.duration_seconds || 0) / 60)} min · {attempt.credits_charged} créditos</div>
            </div>
            <Badge variant={pct >= 70 ? "default" : pct >= 50 ? "secondary" : "destructive"}>{pct.toFixed(0)}%</Badge>
          </div>
          <Progress value={pct} />
          {attempt.feedback && <p className="text-sm bg-muted p-3 rounded">{attempt.feedback}</p>}
        </CardContent>
      </Card>

      {Array.isArray(r.items) && r.items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Rubrica detalhada</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {r.items.map((it: any, i: number) => {
              const p = it.max_score ? (Number(it.score) / Number(it.max_score)) * 100 : 0;
              return (
                <div key={i} className="space-y-2 pb-3 border-b border-border/40 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-4 text-sm">
                    <span className="flex-1">{it.criterion}</span>
                    <span className="shrink-0 font-mono font-bold text-base px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                      {Number(it.score).toFixed(1)}<span className="opacity-60">/{it.max_score}</span>
                    </span>
                  </div>
                  <Progress value={p} />
                  {it.evidence && <p className="text-xs text-muted-foreground italic">"{it.evidence}"</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {(r.strengths?.length || r.improvements?.length) && (
        <div className="grid md:grid-cols-2 gap-3">
          {r.strengths?.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base flex gap-2 items-center"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Pontos fortes</CardTitle></CardHeader>
              <CardContent><ul className="text-sm space-y-1 list-disc pl-4">{r.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent></Card>
          )}
          {r.improvements?.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base flex gap-2 items-center"><AlertTriangle className="h-4 w-4 text-amber-500" /> A melhorar</CardTitle></CardHeader>
              <CardContent><ul className="text-sm space-y-1 list-disc pl-4">{r.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent></Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Replay da consulta</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(attempt.transcript || []).map((m: any, i: number) => (
            <div key={i} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "student" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-[10px] opacity-70 mb-0.5">{m.role === "student" ? "Aluno" : "Paciente"}</div>
                {m.content}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}