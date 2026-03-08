import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pill, Zap, Star, Crown, Check, Coins, ArrowRight, ArrowLeft } from "lucide-react";

const PLANS = [
  {
    name: "Básico",
    price: "R$ 29,90",
    credits: 30,
    icon: Zap,
    popular: false,
    features: ["30 créditos/mês", "Acesso a todos os agentes nativos", "Suporte por e-mail"],
  },
  {
    name: "Pro",
    price: "R$ 59,90",
    credits: 100,
    icon: Star,
    popular: true,
    features: ["100 créditos/mês", "Acesso a todos os agentes nativos", "Agentes personalizados", "Suporte prioritário"],
  },
  {
    name: "Institucional",
    price: "R$ 149,90",
    credits: 300,
    icon: Crown,
    popular: false,
    features: ["300 créditos/mês", "Tudo do Pro", "Salas virtuais ilimitadas", "Suporte dedicado"],
  },
];

const CREDIT_PACKS = [
  { name: "Essencial", amount: 10, price: "R$ 9,90", icon: Zap, popular: false },
  { name: "Avançado", amount: 30, price: "R$ 24,90", icon: Star, popular: true },
  { name: "Profissional", amount: 100, price: "R$ 69,90", icon: Crown, popular: false },
];

export default function PublicCredits() {
  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold">Agentes Posológicos</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Entrar
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0">
                Criar Conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container max-w-5xl py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="mb-12 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Planos & <span className="gradient-text">Créditos</span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Escolha o plano ideal para suas necessidades ou compre pacotes avulsos de créditos.
          </p>
        </div>

        {/* Subscription Plans */}
        <div className="mb-16">
          <div className="mb-6 flex items-center gap-2">
            <Coins className="h-5 w-5 text-[hsl(174,62%,47%)]" />
            <h2 className="font-display text-xl font-bold text-white">Planos Mensais</h2>
          </div>
          <p className="mb-6 text-sm text-white/40">Receba créditos automaticamente todo mês e economize com assinatura recorrente.</p>

          <div className="grid gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-white/[0.03] p-6 transition-all hover:-translate-y-1 ${
                  plan.popular
                    ? "border-[hsl(174,62%,47%)]/50 shadow-[0_0_20px_-10px_hsl(174,62%,47%/0.2)]"
                    : "border-white/10"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(14,90%,58%)] px-4 py-1 text-xs font-semibold text-white">
                    Mais Popular
                  </div>
                )}

                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <plan.icon className="h-7 w-7 text-[hsl(174,62%,47%)]" />
                </div>
                <p className="mb-1 text-center font-display text-xl font-bold text-white">{plan.name}</p>
                <p className="mb-1 text-center text-sm text-white/40">{plan.credits} créditos/mês</p>
                <p className="mb-4 text-center text-2xl font-semibold text-white">
                  {plan.price}<span className="text-sm text-white/40">/mês</span>
                </p>

                <ul className="mb-6 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="h-4 w-4 shrink-0 text-[hsl(174,62%,47%)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/signup">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? "bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0"
                        : "border-white/20 bg-transparent text-white hover:bg-white/10"
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    Começar Agora
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Credit Packs */}
        <div className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <Coins className="h-5 w-5 text-[hsl(174,62%,47%)]" />
            <h2 className="font-display text-xl font-bold text-white">Pacotes Avulsos</h2>
          </div>
          <p className="mb-6 text-sm text-white/40">Compre créditos extras a qualquer momento, mesmo com uma assinatura ativa.</p>

          <div className="grid gap-6 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.amount}
                className={`relative rounded-2xl border bg-white/[0.03] p-6 text-center transition-all hover:-translate-y-1 ${
                  pack.popular ? "border-[hsl(174,62%,47%)] shadow-[0_0_30px_-10px_hsl(174,62%,47%/0.3)]" : "border-white/10"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-4 py-1 text-xs font-semibold text-white">
                    Mais Popular
                  </div>
                )}
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <pack.icon className="h-7 w-7 text-[hsl(174,62%,47%)]" />
                </div>
                <p className="mb-1 font-display text-lg font-bold text-[hsl(174,62%,47%)]">{pack.name}</p>
                <p className="mb-1 font-display text-3xl font-bold text-white">{pack.amount}</p>
                <p className="mb-1 text-sm text-white/40">créditos</p>
                <p className="mb-6 text-xl font-semibold text-white">{pack.price}</p>
                <Link to="/signup">
                  <Button
                    className={`w-full ${pack.popular ? "bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0" : "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"}`}
                    variant={pack.popular ? "default" : "outline"}
                  >
                    Criar Conta para Comprar
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-white/30">Os créditos são consumidos a cada interação com um agente. O custo varia de acordo com a complexidade do agente.</p>
          <p className="mt-2 text-xs text-white/20">Pagamento seguro via Stripe • Cartão de crédito/débito</p>
        </div>
      </div>
    </div>
  );
}
