import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calculator, Coins, MessageSquare, Search, Sparkles, Users, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkline } from "@/components/ds/Sparkline";
import { PkCurve } from "@/components/ds/PkCurve";

interface SessionRow { id: string; created_at: string; agent_id: string; agents?: { name?: string } | null }
interface LedgerRow { amount: number; type: string; created_at: string }

const openPalette = (query?: string) => window.dispatchEvent(new CustomEvent("open-command-palette", { detail: { query } }));

const SUGGESTIONS: { label: string; query: string }[] = [
  { label: "Dose por peso", query: "70 kg 5 mg/kg" },
  { label: "Clearance de creatinina", query: "clearance 65 anos 72 kg creatinina 1,2 feminino" },
  { label: "Superfície corporal", query: "70 kg 170 cm" },
  { label: "Abrir reunião", query: "reuniões" },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Série diária dos últimos `days` dias a partir de datas ISO. */
function dailySeries(dates: string[], days: number, weight?: (i: number) => number): number[] {
  const out = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dates.forEach((iso, i) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
    if (diff >= 0 && diff < days) out[days - 1 - diff] += weight ? weight(i) : 1;
  });
  return out;
}

/** Central de comando do novo visual: saudação, pergunta direta, retomar e KPIs com tendência. */
export function HomeV2({ sessions, ledger, balance }: { sessions: SessionRow[]; ledger: LedgerRow[]; balance: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, display_name").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });
  const firstName = (profile?.display_name || "").trim().split(/\s+/)[0];

  const recent = sessions.slice(0, 3);
  const usage = useMemo(() => ledger.filter((l) => l.type === "usage"), [ledger]);
  const convSeries = useMemo(() => dailySeries(sessions.map((s) => s.created_at), 14), [sessions]);
  const creditSeries = useMemo(() => dailySeries(usage.map((u) => u.created_at), 14, (i) => Math.abs(usage[i].amount)), [usage]);
  const conv14 = convSeries.reduce((a, b) => a + b, 0);
  const cred14 = creditSeries.reduce((a, b) => a + b, 0);

  return (
    <section className="mb-10 animate-slide-up" aria-label="Central de comando">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(var(--dom-inicio)/0.10)] via-pos-base to-pos-base p-6 md:p-8">
        <PkCurve height={120} className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-30" />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--dom-inicio))]">Central de comando</p>
          <h1 className="mt-2 font-brand text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            {greeting()}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-white/55">O que você quer fazer agora?</p>

          <button
            type="button"
            onClick={() => openPalette()}
            className="mt-5 flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-white/15 bg-pos-vacuo/80 px-4 py-3.5 text-left text-sm text-white/45 backdrop-blur transition hover:border-[hsl(var(--dom-inicio))] hover:shadow-[0_0_0_4px_hsl(var(--dom-inicio)/0.15)]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Pergunte, calcule ou busque. Ex.: 70 kg 5 mg/kg</span>
            <kbd className="hidden rounded border border-white/15 px-1.5 font-mono text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s.label} onClick={() => openPalette(s.query)} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/65 transition hover:border-[hsl(var(--dom-inicio))] hover:text-white">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">Retomar de onde parou</h2>
          {recent.length === 0 ? (
            <button onClick={() => navigate("/agentes")} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 p-4 text-left text-sm text-white/60 hover:border-white/30">
              <Sparkles className="h-4 w-4 text-[hsl(var(--dom-clinica))]" />
              Você ainda não conversou com nenhum agente. Escolha um para começar.
              <ArrowRight className="ml-auto h-4 w-4" />
            </button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {recent.map((s) => (
                <button key={s.id} onClick={() => navigate(`/chat/${s.agent_id}?session=${s.id}`)} className="group flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-pos-base p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[hsl(var(--dom-clinica))]">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--dom-clinica)/0.15)] text-[hsl(var(--dom-clinica))]"><MessageSquare className="h-4 w-4" /></span>
                  <span className="line-clamp-2 text-sm font-semibold text-white">{s.agents?.name || "Conversa"}</span>
                  <span className="text-xs text-white/40">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR })}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {[
              { to: "/calculadora", label: "Calculadora", icon: Calculator },
              { to: "/squads", label: "Squads", icon: Users },
              { to: "/fluxos", label: "Fluxos", icon: Workflow },
            ].map((a) => (
              <button key={a.to} onClick={() => navigate(a.to)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:bg-white/5 hover:text-white">
                <a.icon className="h-3.5 w-3.5" />{a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">Conversas, 14 dias</h2>
            <div className="mt-2 flex items-end justify-between">
              <p className="font-brand text-3xl font-extrabold text-white">{conv14}</p>
              <Sparkline values={convSeries} color="hsl(var(--dom-clinica))" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40"><Coins className="h-3 w-3" />Créditos, 14 dias</h2>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="font-brand text-3xl font-extrabold text-white">{cred14.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p>
                <p className="font-mono text-xs text-white/40">saldo {balance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p>
              </div>
              <Sparkline values={creditSeries} color="hsl(var(--dom-ensino))" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
