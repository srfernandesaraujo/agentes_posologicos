import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Headphones, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { invokeFunction } from "@/lib/invokeFunction";

type Settings = {
  enabled: boolean;
  frequency: "daily" | "weekly";
  send_hour: number;
  last_sent_at: string | null;
};

export function BriefingSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: settings } = useQuery<Settings>({
    queryKey: ["briefing_settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("briefing_settings" as any)
        .select("enabled, frequency, send_hour, last_sent_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return ((data as unknown) as Settings) || { enabled: false, frequency: "daily", send_hour: 7, last_sent_at: null };
    },
  });

  const [local, setLocal] = useState<Settings | null>(null);
  useEffect(() => { if (settings) setLocal(settings); }, [settings]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const next = { ...(local || settings)!, ...patch };
      setLocal(next);
      const { error } = await supabase
        .from("briefing_settings" as any)
        .upsert({ user_id: user!.id, ...next }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing_settings", user?.id] }),
    onError: () => toast.error("Não foi possível salvar"),
  });

  const testSend = useMutation({
    mutationFn: async () => invokeFunction("generate-briefing", { userId: user!.id }),
    onSuccess: () => { toast.success("Briefing gerado e enviado por e-mail!"); qc.invalidateQueries({ queryKey: ["briefings_recent", user?.id] }); },
    onError: (e: any) => toast.error(e?.message || "Falha ao gerar briefing"),
  });

  const { data: recent } = useQuery({
    queryKey: ["briefings_recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("briefings" as any)
        .select("id, title, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
  });

  const s = local || settings;
  if (!s) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Briefing por Voz</CardTitle>
        </div>
        <CardDescription>
          Receba um resumo em áudio de 3-5 min com novidades do PubMed nos seus interesses, atualizações da plataforma e suas conversas pendentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Receber briefings por e-mail</p>
            <p className="text-xs text-muted-foreground">Link para o player web + transcrição</p>
          </div>
          <Switch checked={s.enabled} onCheckedChange={(v) => save.mutate({ enabled: v })} />
        </div>

        {s.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Frequência</label>
              <select
                value={s.frequency}
                onChange={(e) => save.mutate({ frequency: e.target.value as Settings["frequency"] })}
                className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Horário</label>
              <select
                value={s.send_hour}
                onChange={(e) => save.mutate({ send_hour: Number(e.target.value) })}
                className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <Button onClick={() => testSend.mutate()} disabled={testSend.isPending} variant="outline" size="sm" className="w-full">
          {testSend.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Send className="h-3 w-3 mr-2" />}
          Gerar briefing agora (teste)
        </Button>

        {recent && recent.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border/30">
            <p className="text-xs text-muted-foreground mb-2">Briefings recentes</p>
            {(recent as any[]).map((b) => (
              <a
                key={b.id}
                href={`/briefing/${b.id}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
              >
                {b.title} · {new Date(b.created_at).toLocaleString("pt-BR")}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}