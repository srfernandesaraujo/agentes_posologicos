import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Coins, BarChart3, Activity, Bot, FileText, TrendingDown, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

const CHART_COLORS = [
  "hsl(174, 62%, 47%)",
  "hsl(199, 89%, 48%)",
  "hsl(14, 90%, 58%)",
  "hsl(152, 60%, 42%)",
  "hsl(280, 60%, 55%)",
  "hsl(45, 90%, 55%)",
];

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

const tooltipStyle = {
  background: "hsl(220,25%,10%)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
};

export default function UserDashboard() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const [period, setPeriod] = useState("30");

  const periodStart = useMemo(() => {
    if (period === "all") return null;
    return new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();
  }, [period]);

  // Fetch user's credits ledger
  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ["user-ledger", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits_ledger")
        .select("amount, type, description, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's chat sessions with agent info
  const { data: sessions = [] } = useQuery({
    queryKey: ["user-sessions-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, created_at, agent_id, agents(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Filter by period
  const filteredLedger = useMemo(() => {
    if (!periodStart) return ledger;
    return ledger.filter((r) => r.created_at >= periodStart);
  }, [ledger, periodStart]);

  const usageEntries = filteredLedger.filter((r) => r.type === "usage");
  const totalCreditsUsed = usageEntries.reduce((s, r) => s + Math.abs(r.amount), 0);
  const totalCreditsPurchased = filteredLedger
    .filter((r) => ["purchase", "subscription", "bonus"].includes(r.type))
    .reduce((s, r) => s + r.amount, 0);

  // Agent usage breakdown
  const agentUsage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of usageEntries) {
      const match = row.description?.match(/Uso: (.+?)( \(|$)/);
      const name = match ? match[1] : "Outro";
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({
        name: name.length > 25 ? name.slice(0, 25) + "…" : name,
        uso: count,
      }));
  }, [usageEntries]);

  // Daily usage over time
  const dailyUsage = useMemo(() => {
    const map: Record<string, { uso: number; creditos: number }> = {};
    for (const row of usageEntries) {
      const date = row.created_at.slice(0, 10);
      if (!map[date]) map[date] = { uso: 0, creditos: 0 };
      map[date].uso += 1;
      map[date].creditos += Math.abs(row.amount);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date: date.slice(5), ...data }));
  }, [usageEntries]);

  // Pie chart for credit types
  const creditBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    const labels: Record<string, string> = {
      bonus: "Bônus",
      purchase: "Compra",
      subscription: "Assinatura",
      usage: "Consumo",
    };
    for (const row of filteredLedger) {
      const label = labels[row.type] || row.type;
      map[label] = (map[label] || 0) + Math.abs(row.amount);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }));
  }, [filteredLedger]);

  const totalSessions = useMemo(() => {
    if (!periodStart) return sessions.length;
    return sessions.filter((s) => s.created_at >= periodStart).length;
  }, [sessions, periodStart]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-[hsl(174,62%,47%)]" />
            Meu Dashboard
          </h1>
          <p className="text-white/50 mt-1">Acompanhe seu uso, créditos e interações com os agentes</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-white/40" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] border-white/10 bg-white/[0.05] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { label: "Saldo Atual", value: balance.toFixed(1), icon: Coins, color: "hsl(38,92%,50%)" },
          { label: "Créditos Consumidos", value: totalCreditsUsed.toFixed(1), icon: TrendingDown, color: "hsl(14,90%,58%)" },
          { label: "Interações", value: usageEntries.length, icon: Activity, color: "hsl(174,62%,47%)" },
          { label: "Sessões de Chat", value: totalSessions, icon: FileText, color: "hsl(199,89%,48%)" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              <span className="text-sm text-white/50">{stat.label}</span>
            </div>
            <p className="font-display text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Usage over time */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-semibold text-white/70">Uso ao longo do tempo</h3>
          {dailyUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyUsage}>
                <defs>
                  <linearGradient id="gradientUso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(174,62%,47%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(174,62%,47%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="uso" stroke="hsl(174,62%,47%)" fill="url(#gradientUso)" strokeWidth={2} name="Interações" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">Sem dados de uso neste período</p>
          )}
        </div>

        {/* Credits consumed over time */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-semibold text-white/70">Créditos consumidos por dia</h3>
          {dailyUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="creditos" fill="hsl(199,89%,48%)" radius={[4, 4, 0, 0]} name="Créditos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">Sem dados neste período</p>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top agents */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-semibold text-white/70 flex items-center gap-2">
            <Bot className="h-4 w-4 text-[hsl(174,62%,47%)]" />
            Agentes mais usados
          </h3>
          {agentUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, agentUsage.length * 40)}>
              <BarChart data={agentUsage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={160} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="uso" radius={[0, 4, 4, 0]} name="Interações">
                  {agentUsage.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">Nenhum agente utilizado neste período</p>
          )}
        </div>

        {/* Credit breakdown */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 text-sm font-semibold text-white/70 flex items-center gap-2">
            <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
            Distribuição de créditos
          </h3>
          {creditBreakdown.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={creditBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" nameKey="name">
                    {creditBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {creditBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm text-white/60">{item.name}</span>
                    <span className="text-sm font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">Sem dados neste período</p>
          )}
        </div>
      </div>
    </div>
  );
}
