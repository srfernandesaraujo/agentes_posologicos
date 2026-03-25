import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useState } from "react";
import { Lightbulb, Clock, ChevronRight, X, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

interface SystemUpdate {
  id: string;
  title: string;
  status: string;
  priority: string;
}

export function RoadmapBanner() {
  const { isAdmin } = useIsAdmin();
  const [dismissed, setDismissed] = useState(false);

  const { data: pendingUpdates = [] } = useQuery({
    queryKey: ["roadmap-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_updates" as any)
        .select("id, title, status, priority")
        .in("status", ["planned", "in_progress", "idea"])
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as unknown as SystemUpdate[];
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAdmin || dismissed || pendingUpdates.length === 0) return null;

  const inProgress = pendingUpdates.filter((u) => u.status === "in_progress");
  const planned = pendingUpdates.filter((u) => u.status === "planned");
  const ideas = pendingUpdates.filter((u) => u.status === "idea");

  return (
    <div className="mx-4 mt-4 rounded-xl border border-[hsl(174,62%,47%)]/20 bg-gradient-to-r from-[hsl(174,62%,47%)]/5 to-[hsl(199,89%,48%)]/5 p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(174,62%,47%)]/20 shrink-0">
            <Rocket className="h-5 w-5 text-[hsl(174,62%,47%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">Roadmap de Atualizações</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {inProgress.length > 0 && (
                <span className="flex items-center gap-1 text-[hsl(199,89%,48%)]">
                  <Clock className="h-3.5 w-3.5" />
                  {inProgress.length} em desenvolvimento
                </span>
              )}
              {planned.length > 0 && (
                <span className="flex items-center gap-1 text-[hsl(38,92%,50%)]">
                  <Lightbulb className="h-3.5 w-3.5" />
                  {planned.length} planejado{planned.length > 1 ? "s" : ""}
                </span>
              )}
              {ideas.length > 0 && (
                <span className="flex items-center gap-1 text-[hsl(280,60%,55%)]">
                  <Lightbulb className="h-3.5 w-3.5" />
                  {ideas.length} ideia{ideas.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {inProgress.length > 0 && (
              <p className="text-xs text-white/40 mt-1.5 truncate">
                Em andamento: {inProgress.map((u) => u.title).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin"
            className="flex items-center gap-1 rounded-lg bg-[hsl(174,62%,47%)]/20 px-3 py-1.5 text-xs font-medium text-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,47%)]/30 transition-colors"
          >
            Ver Pipeline <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
