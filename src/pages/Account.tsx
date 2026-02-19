import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Coins, Clock, ArrowUpRight, ArrowDownRight, Gift } from "lucide-react";

export default function Account() {
  const { user } = useAuth();
  const { balance } = useCredits();

  const { data: ledger = [] } = useQuery({
    queryKey: ["ledger", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits_ledger")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const typeConfig: Record<string, { icon: typeof Coins; label: string; color: string }> = {
    purchase: { icon: ArrowUpRight, label: "Compra", color: "text-[hsl(152,60%,42%)]" },
    usage: { icon: ArrowDownRight, label: "Uso", color: "text-[hsl(0,72%,51%)]" },
    bonus: { icon: Gift, label: "Bônus", color: "text-[hsl(174,62%,47%)]" },
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Minha Conta</h1>
      </div>

      {/* Profile card */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-primary">
            <User className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-white">{user?.email}</p>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Coins className="h-4 w-4 text-[hsl(38,92%,50%)]" />
              {balance} créditos
            </div>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <h2 className="mb-4 font-display text-xl font-semibold text-white">Histórico</h2>
      <div className="space-y-2">
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-white/40">Nenhuma movimentação</p>
        ) : (
          ledger.map((entry) => {
            const cfg = typeConfig[entry.type] || typeConfig.usage;
            const EntryIcon = cfg.icon;
            return (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${cfg.color}`}>
                  <EntryIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white/80">{entry.description || cfg.label}</p>
                  <p className="text-xs text-white/30">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`font-display font-semibold ${cfg.color}`}>
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
