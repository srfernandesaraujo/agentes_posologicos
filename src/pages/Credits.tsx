import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useSubscription, SUBSCRIPTION_TIERS, TierKey } from "@/hooks/useSubscription";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, Zap, Star, Crown, Loader2, Check, Settings, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const CREDIT_PACKS = [
  { amount: 10, packKey: "10", price: "R$ 9,90", icon: Zap, popular: false },
  { amount: 30, packKey: "30", price: "R$ 24,90", icon: Star, popular: true },
  { amount: 100, packKey: "100", price: "R$ 69,90", icon: Crown, popular: false },
];

const PLANS: { key: TierKey; icon: typeof Zap; popular: boolean; features: string[] }[] = [
  {
    key: "basico",
    icon: Zap,
    popular: false,
    features: ["30 créditos/mês", "Acesso a todos os agentes nativos", "Suporte por e-mail"],
  },
  {
    key: "pro",
    icon: Star,
    popular: true,
    features: ["100 créditos/mês", "Acesso a todos os agentes nativos", "Agentes personalizados", "Suporte prioritário"],
  },
  {
    key: "institucional",
    icon: Crown,
    popular: false,
    features: ["300 créditos/mês", "Tudo do Pro", "Salas virtuais ilimitadas", "Suporte dedicado"],
  },
];

export default function Credits() {
  const { user } = useAuth();
  const { balance, refetch } = useCredits();
  const { subscribed, tier, tierInfo, subscriptionEnd, refetch: refetchSub, isLoading: subLoading } = useSubscription();
  const { hasUnlimitedAccess } = useUnlimitedAccess();
  const { isAdmin } = useIsAdmin();
  const hasFreeAccess = isAdmin || hasUnlimitedAccess;
  const { t } = useLanguage();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      const credits = searchParams.get("credits");
      toast.success(`${credits} créditos adicionados com sucesso!`);
      refetch();
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get("subscription") === "true") {
      toast.success("Assinatura ativada com sucesso! Seus créditos já foram adicionados.");
      refetch();
      refetchSub();
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
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error("Erro ao iniciar pagamento: " + (err.message || "Tente novamente"));
    } finally {
      setLoadingPack(null);
    }
  };

  const handleSubscribe = async (planKey: string) => {
    if (!user) return;
    setLoadingPlan(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar assinatura");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error("Erro ao abrir portal: " + (err.message || "Tente novamente"));
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">{t("credits.title")}</h1>
        <p className="text-white/50">{t("credits.desc")}</p>
      </div>

      {/* Zero credits banner */}
      {balance <= 0 && !subscribed && !hasFreeAccess && (
        <div className="mb-8 rounded-2xl border border-[hsl(14,90%,58%)]/30 bg-[hsl(14,90%,58%)]/10 p-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(14,90%,58%)]/20">
              <AlertTriangle className="h-6 w-6 text-[hsl(14,90%,58%)]" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-white">Seus créditos acabaram!</p>
              <p className="text-sm text-white/60">
                Assine um plano mensal para receber créditos automaticamente ou compre um pacote avulso para continuar usando os agentes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Balance */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
              <Coins className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-white/50">{t("credits.balance")}</p>
              <p className="font-display text-4xl font-bold text-white">{hasFreeAccess ? "∞" : balance}</p>
            </div>
          </div>
          {subscribed && tierInfo && (
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-[hsl(174,62%,47%)]/30 bg-[hsl(174,62%,47%)]/10 px-4 py-2">
                <span className="text-sm font-semibold text-[hsl(174,62%,47%)]">
                  Plano {tierInfo.name}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="border-white/20 text-white hover:bg-white/10"
              >
                {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                <span className="ml-1">Gerenciar</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="mb-12">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[hsl(174,62%,47%)]" />
          <h2 className="font-display text-xl font-bold text-white">Planos Mensais</h2>
        </div>
        <p className="mb-6 text-sm text-white/40">Receba créditos automaticamente todo mês e economize com assinatura recorrente.</p>

        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const info = SUBSCRIPTION_TIERS[plan.key];
            const isCurrentPlan = subscribed && tier === plan.key;

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border bg-white/[0.03] p-6 transition-all hover:-translate-y-1 animate-fade-in ${
                  isCurrentPlan
                    ? "border-[hsl(174,62%,47%)] shadow-[0_0_30px_-10px_hsl(174,62%,47%/0.4)]"
                    : plan.popular
                    ? "border-[hsl(174,62%,47%)]/50 shadow-[0_0_20px_-10px_hsl(174,62%,47%/0.2)]"
                    : "border-white/10"
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-4 py-1 text-xs font-semibold text-white">
                    Seu Plano
                  </div>
                )}
                {!isCurrentPlan && plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(14,90%,58%)] px-4 py-1 text-xs font-semibold text-white">
                    Mais Popular
                  </div>
                )}

                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <plan.icon className="h-7 w-7 text-[hsl(174,62%,47%)]" />
                </div>
                <p className="mb-1 text-center font-display text-xl font-bold text-white">{info.name}</p>
                <p className="mb-1 text-center text-sm text-white/40">{info.credits} créditos/mês</p>
                <p className="mb-4 text-center text-2xl font-semibold text-white">
                  {info.price}<span className="text-sm text-white/40">/mês</span>
                </p>

                <ul className="mb-6 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="h-4 w-4 shrink-0 text-[hsl(174,62%,47%)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button disabled className="w-full bg-white/10 text-white/50 border-0">
                    Plano Atual
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={loadingPlan !== null || subscribed}
                    className={`w-full ${
                      plan.popular
                        ? "bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0"
                        : "border-white/20 bg-transparent text-white hover:bg-white/10"
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {loadingPlan === plan.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : subscribed ? (
                      "Gerencie seu plano"
                    ) : (
                      "Assinar"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Credit Packs */}
      <div>
        <div className="mb-6 flex items-center gap-2">
          <Coins className="h-5 w-5 text-[hsl(174,62%,47%)]" />
          <h2 className="font-display text-xl font-bold text-white">Pacotes Avulsos</h2>
        </div>
        <p className="mb-6 text-sm text-white/40">Compre créditos extras a qualquer momento, mesmo com uma assinatura ativa.</p>

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
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-white/30">{t("credits.disclaimer")}</p>
        <p className="mt-2 text-xs text-white/20">Pagamento seguro via Stripe • Cartão de crédito/débito</p>
      </div>
    </div>
  );
}
