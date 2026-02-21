import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, Zap, Star, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const CREDIT_PACKS = [
  { amount: 10, packKey: "10", price: "R$ 9,90", icon: Zap, popular: false },
  { amount: 30, packKey: "30", price: "R$ 24,90", icon: Star, popular: true },
  { amount: 100, packKey: "100", price: "R$ 69,90", icon: Crown, popular: false },
];

export default function Credits() {
  const { user } = useAuth();
  const { balance, refetch } = useCredits();
  const { t } = useLanguage();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      const credits = searchParams.get("credits");
      toast.success(`${credits} créditos adicionados com sucesso!`);
      refetch();
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Compra cancelada.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const handlePurchase = async (packKey: string) => {
    if (!user) return;
    setLoadingPack(packKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { packKey },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao iniciar pagamento: " + (err.message || "Tente novamente"));
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">{t("credits.title")}</h1>
        <p className="text-white/50">{t("credits.desc")}</p>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
            <Coins className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-sm text-white/50">{t("credits.balance")}</p>
            <p className="font-display text-4xl font-bold text-white">{balance}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.amount}
            className={`relative rounded-2xl border bg-white/[0.03] p-6 text-center transition-all hover:-translate-y-1 animate-fade-in ${
              pack.popular ? "border-[hsl(174,62%,47%)] shadow-[0_0_30px_-10px_hsl(174,62%,47%/0.3)]" : "border-white/10"
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-4 py-1 text-xs font-semibold text-white">
                {t("credits.popular")}
              </div>
            )}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <pack.icon className="h-7 w-7 text-[hsl(174,62%,47%)]" />
            </div>
            <p className="mb-1 font-display text-3xl font-bold text-white">{pack.amount}</p>
            <p className="mb-1 text-sm text-white/40">{t("credits.credits")}</p>
            <p className="mb-6 text-xl font-semibold text-white">{pack.price}</p>
            <Button
              onClick={() => handlePurchase(pack.packKey)}
              disabled={loadingPack !== null}
              className={`w-full ${pack.popular ? "bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0" : "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"}`}
              variant={pack.popular ? "default" : "outline"}
            >
              {loadingPack === pack.packKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("credits.buy")
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-white/30">{t("credits.disclaimer")}</p>
        <p className="mt-2 text-xs text-white/20">Pagamento seguro via Stripe • Cartão de crédito/débito</p>
      </div>
    </div>
  );
}
