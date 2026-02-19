import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, Zap, Star, Crown } from "lucide-react";
import { toast } from "sonner";

const CREDIT_PACKS = [
  { amount: 10, price: "R$ 9,90", icon: Zap, popular: false },
  { amount: 30, price: "R$ 24,90", icon: Star, popular: true },
  { amount: 100, price: "R$ 69,90", icon: Crown, popular: false },
];

export default function Credits() {
  const { user } = useAuth();
  const { balance, refetch } = useCredits();

  const handlePurchase = async (amount: number) => {
    if (!user) return;
    // Mock purchase — real integration would go through Stripe/payment
    await supabase.from("credits_ledger").insert({
      user_id: user.id,
      amount,
      type: "purchase",
      description: `Compra de ${amount} créditos`,
    });
    await refetch();
    toast.success(`${amount} créditos adicionados!`);
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold">Créditos</h1>
        <p className="text-muted-foreground">
          Cada uso de agente consome créditos. Compre mais para continuar usando.
        </p>
      </div>

      <div className="mb-8 glass-card rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
            <Coins className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo atual</p>
            <p className="font-display text-4xl font-bold">{balance}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.amount}
            className={`relative glass-card rounded-2xl p-6 text-center transition-all hover:shadow-xl hover:-translate-y-1 animate-fade-in ${
              pack.popular ? "ring-2 ring-primary" : ""
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                Mais popular
              </div>
            )}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
              <pack.icon className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-1 font-display text-3xl font-bold">{pack.amount}</p>
            <p className="mb-1 text-sm text-muted-foreground">créditos</p>
            <p className="mb-6 text-xl font-semibold">{pack.price}</p>
            <Button
              onClick={() => handlePurchase(pack.amount)}
              className="w-full"
              variant={pack.popular ? "default" : "outline"}
            >
              Comprar
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        * Pagamento simulado para demonstração. Integração com gateway real será adicionada.
      </p>
    </div>
  );
}
