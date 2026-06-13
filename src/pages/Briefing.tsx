import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Loader2 } from "lucide-react";
import { MessageTTS } from "@/components/chat/MessageTTS";
import { SEO } from "@/components/seo/SEO";

export default function Briefing() {
  const { id } = useParams();
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("briefings" as any)
        .select("id, title, transcript, summary, sections, created_at")
        .eq("id", id!)
        .maybeSingle();
      if (!alive) return;
      setBriefing(data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,25%,5%)] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!briefing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,25%,5%)] text-white">
        Briefing não encontrado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
        <SEO title={briefing.title} description={briefing.summary || "Briefing por voz"} path={`/briefing/${briefing.id}`} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(174,62%,47%)]/20">
            <Headphones className="h-5 w-5 text-[hsl(174,62%,47%)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{briefing.title}</h1>
            <p className="text-xs text-white/40">{new Date(briefing.created_at).toLocaleString("pt-BR")}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/60">Player do briefing</p>
            <MessageTTS text={briefing.transcript} />
          </div>
          {Array.isArray(briefing.sections) && briefing.sections.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1">
              {briefing.sections.map((s: any, i: number) => (
                <span key={i} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/70">
                  {s.label}: {s.count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/80 mb-3">Transcrição</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{briefing.transcript}</p>
        </div>
      </div>
    </div>
  );
}