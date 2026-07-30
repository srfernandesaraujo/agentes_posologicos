import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { compareRatings, type Rating } from "@/lib/raterAgreement";

const sb: any = supabase;

interface Props {
  attemptId: string;
  stationOwnerId: string | null;
  llmItems: Array<{ criterion: string; max_score: number; score: number; evidence?: string }>;
}

export function RaterReview({ attemptId, stationOwnerId, llmItems }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isStationOwner = !!user && !!stationOwnerId && user.id === stationOwnerId;
  const [scores, setScores] = useState<Record<string, number>>({});

  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["osce-attempt-ratings", attemptId],
    queryFn: async () => {
      const { data, error } = await sb.from("osce_attempt_ratings").select("*").eq("attempt_id", attemptId);
      if (error) throw error;
      return data || [];
    },
  });

  const humanRating = ratings.find((r: any) => r.rater_type === "human");
  const llmRating: Rating | null = useMemo(
    () => (llmItems.length ? { items: llmItems, score: llmItems.reduce((s, i) => s + i.score, 0), max_score: llmItems.reduce((s, i) => s + i.max_score, 0) } : null),
    [llmItems],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const items = llmItems.map((it) => ({
        criterion: it.criterion,
        max_score: it.max_score,
        score: scores[it.criterion] ?? it.score,
      }));
      const { data, error } = await supabase.functions.invoke("osce-submit-rating", { body: { attemptId, items } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
    },
    onSuccess: () => {
      toast.success("Avaliação registrada!");
      qc.invalidateQueries({ queryKey: ["osce-attempt-ratings", attemptId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar avaliação"),
  });

  if (!isStationOwner && !humanRating) return null;
  if (llmItems.length === 0) return null;

  const agreement = llmRating && humanRating
    ? compareRatings(llmRating, { items: humanRating.items, score: humanRating.score, max_score: humanRating.max_score })
    : null;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" /> Calibração inter-avaliador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : humanRating ? (
          <>
            <p className="text-sm">
              Avaliação humana: <strong>{Number(humanRating.score).toFixed(1)}/{Number(humanRating.max_score).toFixed(1)}</strong>
              {" · "}IA: <strong>{llmRating ? `${llmRating.score.toFixed(1)}/${llmRating.max_score.toFixed(1)}` : "—"}</strong>
            </p>
            {agreement && (
              <Badge variant={agreement.agreementRate >= 80 ? "default" : agreement.agreementRate >= 50 ? "secondary" : "destructive"}>
                {agreement.agreementRate.toFixed(0)}% de concordância por critério
              </Badge>
            )}
          </>
        ) : isStationOwner ? (
          <>
            <p className="text-xs text-muted-foreground">
              Reavalie cada critério (nota da IA pré-preenchida) e registre sua avaliação humana.
            </p>
            {llmItems.map((it) => (
              <div key={it.criterion} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex-1">{it.criterion}</span>
                <Input
                  type="number"
                  min={0}
                  max={it.max_score}
                  step={0.5}
                  defaultValue={it.score}
                  onChange={(e) => setScores((prev) => ({ ...prev, [it.criterion]: Number(e.target.value) }))}
                  className="w-20"
                />
                <span className="w-10 text-xs text-muted-foreground">/{it.max_score}</span>
              </div>
            ))}
            <Button onClick={() => submit.mutate()} disabled={submit.isPending} size="sm" className="gap-2">
              {submit.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-3 w-3" />}
              Registrar avaliação humana
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
