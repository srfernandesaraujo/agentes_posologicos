import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AreaTrend } from "@/components/ds/AreaTrend";
import { CountUp } from "@/components/ds/CountUp";
import { Gauge } from "@/components/ds/Gauge";
import { Reveal, RevealItem } from "@/components/ds/Reveal";

interface Row { amount: number; type: string; description: string | null; created_at: string }

const DAY = 86_400_000;
const DAYS = 60;

interface Props {
  balance: number;
  unlimited: boolean;
  /** chip do plano e botão de gerenciar, vindos da tela */
  actions?: ReactNode;
}

/** Carteira de créditos: saldo, como ele evoluiu, quanto dura no seu ritmo e as últimas movimentações. */
export function CreditsWallet({ balance, unlimited, actions }: Props) {
  const { user } = useAuth();
  const { data: ledger = [] } = useQuery({
    queryKey: ["user-ledger", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("credits_ledger").select("amount, type, description, created_at").eq("user_id", user!.id).order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { series, spent30, added30, runway, recent } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = today.getTime() - (DAYS - 1) * DAY;
    // saldo no fim de cada dia, partindo do que já havia antes da janela
    let running = ledger.filter((r) => new Date(r.created_at).getTime() < start).reduce((s, r) => s + r.amount, 0);
    const series: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      const from = start + d * DAY, to = from + DAY;
      running += ledger.filter((r) => { const t = new Date(r.created_at).getTime(); return t >= from && t < to; }).reduce((s, r) => s + r.amount, 0);
      series.push(running);
    }
    const since30 = today.getTime() - 29 * DAY;
    const last30 = ledger.filter((r) => new Date(r.created_at).getTime() >= since30);
    const spent30 = Math.abs(last30.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0));
    const added30 = last30.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const runway = spent30 > 0 ? Math.floor(balance / (spent30 / 30)) : null;
    return { series, spent30, added30, runway, recent: [...ledger].reverse().slice(0, 7) };
  }, [ledger, balance]);

  const fmt1 = (n: number) => (n % 1 ? 1 : 0);

  return (
    <Reveal className="mb-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]" stagger={0.08}>
      <RevealItem className="pos-elev relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[hsl(var(--dom-ajuda)/0.10)] via-card to-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"><Coins className="h-3.5 w-3.5" /> Saldo</p>
          {actions}
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="bg-gradient-to-r from-[#2DD4BF] to-[#38BDF8] bg-clip-text font-display text-7xl font-extrabold leading-none tracking-tight text-transparent md:text-8xl">
            {unlimited ? "∞" : <CountUp value={balance} decimals={fmt1(balance)} />}
          </div>
          {!unlimited && (
            <Gauge value={runway === null ? 1 : Math.min(1, runway / 60)} size={92} stroke={8} color="hsl(var(--dom-ajuda))" label="Autonomia do saldo em relação a 60 dias">
              <div>
                <div className="font-display text-xl font-extrabold leading-none text-foreground">{runway === null ? "—" : runway > 365 ? "365+" : runway}</div>
                <div className="font-mono text-[9px] uppercase text-muted-foreground">dias</div>
              </div>
            </Gauge>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unlimited ? "Sua conta tem acesso sem custo por uso." : runway === null ? "Sem consumo nos últimos 30 dias." : runway > 365 ? "No seu ritmo atual, o saldo dura mais de um ano." : `No seu ritmo dos últimos 30 dias, o saldo dura cerca de ${runway} ${runway === 1 ? "dia" : "dias"}.`}
        </p>
        <div className="mt-5">
          <AreaTrend values={series} color="hsl(var(--dom-ajuda))" height={110} className="w-full" label="Saldo de créditos nos últimos 60 dias" />
          <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>há 60 dias</span><span>hoje</span></div>
        </div>
      </RevealItem>

      <RevealItem className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><ArrowDownRight className="h-3 w-3 text-[hsl(var(--dom-ensino))]" /> usados, 30 dias</div>
            <div className="mt-1 font-display text-3xl font-extrabold text-foreground"><CountUp value={spent30} decimals={fmt1(spent30)} /></div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><ArrowUpRight className="h-3 w-3 text-[hsl(var(--dom-acervo))]" /> recebidos, 30 dias</div>
            <div className="mt-1 font-display text-3xl font-extrabold text-foreground"><CountUp value={added30} decimals={fmt1(added30)} /></div>
          </div>
        </div>
        <div className="flex-1 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Últimas movimentações</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{r.description || (r.amount > 0 ? "Crédito recebido" : "Uso de agente")}</span>
                    <span className="block font-mono text-[10.5px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </span>
                  <b className={`font-mono text-sm ${r.amount > 0 ? "text-[hsl(var(--dom-acervo))]" : "text-foreground"}`}>{r.amount > 0 ? "+" : ""}{r.amount.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </RevealItem>
    </Reveal>
  );
}
