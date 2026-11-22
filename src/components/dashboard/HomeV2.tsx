import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calculator, Coins, MessageSquare, Search, Sparkles, Users, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PkCurve } from "@/components/ds/PkCurve";
import { CountUp } from "@/components/ds/CountUp";
import { Reveal, RevealItem } from "@/components/ds/Reveal";
import { Spotlight } from "@/components/ds/Spotlight";
import { AreaTrend } from "@/components/ds/AreaTrend";
import { Gauge } from "@/components/ds/Gauge";
import { ActivityHeatmap } from "@/components/ds/ActivityHeatmap";
import { TeamPulsePanel } from "./TeamPulsePanel";
import { awaitingCount, useTeamPulse } from "@/hooks/useTeamPulse";
import { useAgents } from "@/hooks/useAgents";
import { useCustomAgents } from "@/hooks/useCustomAgents";

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
  const { data: pulse } = useTeamPulse();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, display_name").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });
  const firstName = (profile?.display_name || "").trim().split(/\s+/)[0];

  // Desde que o Chat virou "sala pessoal", as conversas novas vivem em virtual_rooms (chat_sessions ficou congelado).
  const { data: rooms = [] } = useQuery({
    queryKey: ["home-personal-rooms", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("virtual_rooms")
        .select("id, agent_id, name, updated_at, created_at")
        .eq("user_id", user!.id)
        .eq("room_type", "personal")
        .order("updated_at", { ascending: false })
        .limit(200);
      return (data || []) as { id: string; agent_id: string | null; name: string; updated_at: string; created_at: string }[];
    },
    enabled: !!user,
  });
  const { data: nativeAgents = [] } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();
  const agentName = (id: string | null) =>
    (id && (nativeAgents.find((a) => a.id === id)?.name || (customAgents as any[]).find((a) => a.id === id)?.name)) || null;

  // sala pessoal (atual) + sessões antigas, da mais recente para a mais antiga
  const recent = useMemo(() => {
    const fromRooms = rooms.filter((r) => r.agent_id).map((r) => ({ id: r.id, to: `/chat/${r.agent_id}?room=${r.id}`, title: agentName(r.agent_id) || r.name || "Conversa", subtitle: r.name, at: r.updated_at }));
    const fromSessions = sessions.map((s) => ({ id: s.id, to: `/chat/${s.agent_id}?session=${s.id}`, title: s.agents?.name || "Conversa", subtitle: "", at: s.created_at }));
    return [...fromRooms, ...fromSessions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, sessions, nativeAgents, customAgents]);
  const usage = useMemo(() => ledger.filter((l) => l.type === "usage"), [ledger]);
  const convSeries = useMemo(() => dailySeries([...rooms.map((r) => r.updated_at), ...sessions.map((s) => s.created_at)], 14), [rooms, sessions]);
  const creditSeries = useMemo(() => dailySeries(usage.map((u) => u.created_at), 14, (i) => Math.abs(usage[i].amount)), [usage]);
  const conv14 = convSeries.reduce((a, b) => a + b, 0);
  const cred14 = creditSeries.reduce((a, b) => a + b, 0);
  const allDates = useMemo(() => [...rooms.map((r) => r.updated_at), ...sessions.map((s) => s.created_at)], [rooms, sessions]);
  // 14 dias anteriores, para dizer se o ritmo subiu ou caiu
  const convPrev14 = useMemo(() => dailySeries(allDates, 28).slice(0, 14).reduce((a, b) => a + b, 0), [allDates]);
  const delta = convPrev14 > 0 ? Math.round(((conv14 - convPrev14) / convPrev14) * 100) : null;
  // quantos dias o saldo dura se o ritmo dos últimos 14 dias continuar
  const runway = cred14 > 0 ? Math.floor(balance / (cred14 / 14)) : null;
  const awaiting = awaitingCount(pulse);


  const stat = "font-brand text-3xl font-extrabold tracking-tight text-white md:text-4xl";
  const statLabel = "mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/45";

  return (
    <Reveal className="mb-10" stagger={0.09}>
      <RevealItem>
        <div className="pos-elev relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(var(--dom-inicio)/0.10)] via-pos-base to-pos-base p-6 md:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] md:block [mask-image:linear-gradient(90deg,transparent,#000_45%)]" aria-hidden="true">
            <PkCurve draw height={260} preserve="xMaxYMax slice" className="absolute bottom-0 right-0 h-full w-full opacity-40" />
          </div>
          <div className="relative z-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--dom-inicio))]">Central de comando</p>
            <h1 className="mt-2 font-brand text-3xl font-extrabold tracking-tight text-white md:text-5xl">
              {greeting()}{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {awaiting > 0 ? `${awaiting} ${awaiting === 1 ? "coisa espera" : "coisas esperam"} por você. O que quer fazer agora?` : "Tudo em dia. O que você quer fazer agora?"}
            </p>

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

            <dl className="mt-7 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/10 pt-5">
              <div>
                <dd className={stat}><CountUp value={conv14} /></dd>
                <dt className={statLabel}>conversas, 14 dias</dt>
              </div>
              <div>
                <dd className={stat}><CountUp value={balance} decimals={balance % 1 ? 1 : 0} /></dd>
                <dt className={statLabel}>créditos no saldo</dt>
              </div>
              <div>
                <dd className={`${stat} ${awaiting > 0 ? "text-[hsl(var(--warning))]" : ""}`}><CountUp value={awaiting} /></dd>
                <dt className={statLabel}>aguardando você</dt>
              </div>
            </dl>
          </div>
        </div>
      </RevealItem>

      <RevealItem><TeamPulsePanel /></RevealItem>

      <RevealItem className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
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
                <Spotlight key={s.id} tone="var(--dom-clinica)" className="rounded-xl border border-white/10 bg-pos-base transition hover:-translate-y-0.5">
                  <button onClick={() => navigate(s.to)} className="flex h-full w-full flex-col items-start gap-2 p-3.5 text-left">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--dom-clinica)/0.15)] text-[hsl(var(--dom-clinica))]"><MessageSquare className="h-4 w-4" /></span>
                    <span className="line-clamp-2 text-sm font-semibold text-white">{s.title}</span>
                    {s.subtitle && s.subtitle !== s.title && <span className="line-clamp-1 text-xs text-white/50">{s.subtitle}</span>}
                    <span className="text-xs text-white/40">{formatDistanceToNow(new Date(s.at), { addSuffix: true, locale: ptBR })}</span>
                  </button>
                </Spotlight>
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
          <Spotlight tone="var(--dom-clinica)" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">Conversas ativas, 14 dias</h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <p className="font-brand text-3xl font-extrabold text-white"><CountUp value={conv14} /></p>
              {delta !== null && (
                <span className={`font-mono text-xs ${delta >= 0 ? "text-[hsl(var(--dom-acervo))]" : "text-[hsl(var(--dom-ajuda))]"}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs. 14 dias antes
                </span>
              )}
            </div>
            <AreaTrend values={convSeries} color="hsl(var(--dom-clinica))" className="mt-2 w-full" height={72} label="Conversas ativas por dia" />
          </Spotlight>
          <Spotlight tone="var(--dom-ensino)" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40"><Coins className="h-3 w-3" />Créditos, 14 dias</h2>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="font-brand text-3xl font-extrabold text-white"><CountUp value={cred14} decimals={cred14 % 1 ? 1 : 0} /></p>
                <p className="mt-1 font-mono text-xs text-white/45">
                  {runway === null ? "sem consumo no período" : runway > 365 ? "saldo dura mais de 1 ano" : `saldo dura ~${runway} ${runway === 1 ? "dia" : "dias"} neste ritmo`}
                </p>
              </div>
              <Gauge value={runway === null ? 1 : Math.min(1, runway / 60)} size={72} stroke={7} color="hsl(var(--dom-ensino))" label="Autonomia do saldo em relação a 60 dias">
                <Coins className="h-4 w-4 text-[hsl(var(--dom-ensino))]" />
              </Gauge>
            </div>
            <AreaTrend values={creditSeries} color="hsl(var(--dom-ensino))" className="mt-2 w-full" height={56} label="Créditos usados por dia" />
          </Spotlight>
        </div>
      </RevealItem>

      <RevealItem className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">Sua atividade, 18 semanas</h2>
          <span className="font-mono text-[10.5px] text-white/35">mais claro = mais conversas no dia</span>
        </div>
        <ActivityHeatmap dates={allDates} weeks={18} tone="var(--dom-inicio)" />
      </RevealItem>
    </Reveal>
  );
}
