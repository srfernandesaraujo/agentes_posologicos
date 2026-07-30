import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Award, Loader2, Check, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { compareRatings, type Rating } from "@/lib/raterAgreement";

const sb: any = supabase;

interface PendingStation {
  id: string;
  title: string;
  specialty: string | null;
  scenario_brief: string;
  submitted_at: string | null;
  institutions: { name: string } | null;
}

function StationCalibrationInfo({ stationId }: { stationId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["osce-station-calibration", stationId],
    queryFn: async () => {
      const { data: attempts } = await sb.from("osce_attempts").select("id").eq("station_id", stationId);
      const attemptIds = (attempts || []).map((a: any) => a.id);
      if (!attemptIds.length) return { attemptCount: 0, agreementRate: null as number | null };

      const { data: ratings } = await sb.from("osce_attempt_ratings").select("*").in("attempt_id", attemptIds);
      const byAttempt = new Map<string, any[]>();
      (ratings || []).forEach((r: any) => {
        const arr = byAttempt.get(r.attempt_id) || [];
        arr.push(r);
        byAttempt.set(r.attempt_id, arr);
      });

      const rates: number[] = [];
      byAttempt.forEach((rs) => {
        const llm = rs.find((r) => r.rater_type === "llm");
        const human = rs.find((r) => r.rater_type === "human");
        if (llm && human) {
          const summary = compareRatings(
            { items: llm.items, score: llm.score, max_score: llm.max_score } as Rating,
            { items: human.items, score: human.score, max_score: human.max_score } as Rating,
          );
          rates.push(summary.agreementRate);
        }
      });

      return {
        attemptCount: attemptIds.length,
        agreementRate: rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null,
      };
    },
  });

  if (isLoading) return <span className="text-xs text-white/30">Carregando calibração...</span>;
  if (!data || data.attemptCount === 0) return <span className="text-xs text-white/30">Sem tentativas ainda.</span>;

  return (
    <span className="text-xs text-white/40 flex items-center gap-1">
      <ClipboardList className="h-3 w-3" />
      {data.attemptCount} tentativa(s)
      {data.agreementRate !== null && ` · ${data.agreementRate.toFixed(0)}% concordância LLM×humano`}
      {data.agreementRate === null && " · sem par de avaliação humana ainda"}
    </span>
  );
}

export function OsceCertificationPanel() {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<{ station: PendingStation; approve: boolean } | null>(null);
  const [note, setNote] = useState("");

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["admin-osce-pending"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("osce_stations")
        .select("id, title, specialty, scenario_brief, submitted_at, institutions(name)")
        .eq("certification_status", "pending")
        .order("submitted_at");
      if (error) throw error;
      return data as PendingStation[];
    },
  });

  const review = useMutation({
    mutationFn: async ({ stationId, approve, note }: { stationId: string; approve: boolean; note: string }) => {
      const { error } = await sb.rpc("review_station_certification", {
        p_station_id: stationId, p_approve: approve, p_note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "Estação certificada." : "Estação rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["admin-osce-pending"] });
      setReviewing(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao revisar estação."),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-white flex items-center gap-2">
        <Award className="h-5 w-5 text-[hsl(174,62%,47%)]" />
        Certificação de Casos OSCE
        {stations.length > 0 && (
          <span className="rounded-full bg-[hsl(14,90%,58%)]/20 text-[hsl(14,90%,58%)] px-2 py-0.5 text-xs font-semibold">
            {stations.length} pendente(s)
          </span>
        )}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
      ) : stations.length === 0 ? (
        <p className="text-sm text-white/30 py-8 text-center">Nenhuma estação aguardando certificação.</p>
      ) : (
        <div className="space-y-2">
          {stations.map((st) => (
            <div key={st.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{st.title}</p>
                  <p className="text-xs text-white/40">
                    {st.institutions?.name || "Instituição"} {st.specialty ? `· ${st.specialty}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">Pendente</Badge>
              </div>
              <p className="text-xs text-white/50 line-clamp-2">{st.scenario_brief}</p>
              <StationCalibrationInfo stationId={st.id} />
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="gap-1" onClick={() => setReviewing({ station: st, approve: true })}>
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setReviewing({ station: st, approve: false })}>
                  <X className="h-3.5 w-3.5" /> Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(open) => { if (!open) { setReviewing(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewing?.approve ? "Certificar estação" : "Rejeitar estação"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{reviewing?.station.title}</p>
          <Textarea
            placeholder={reviewing?.approve ? "Nota opcional para o autor" : "Motivo da rejeição (visível ao autor)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancelar</Button>
            <Button
              disabled={review.isPending}
              onClick={() => reviewing && review.mutate({ stationId: reviewing.station.id, approve: reviewing.approve, note })}
            >
              {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
