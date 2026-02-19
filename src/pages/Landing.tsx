import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Pill, BookOpen, FlaskConical, Video, MessageSquare, Settings } from "lucide-react";

const PREVIEW_AGENTS = [
  {
    name: "Interações Cardiovasculares",
    description: "Cruza prescrições e alerta sobre interações medicamentosas graves e risco cardiovascular.",
    icon: Pill,
  },
  {
    name: "Antibioticoterapia",
    description: "Sugere antimicrobianos, posologia e alertas de toxicidade baseado em diretrizes atuais.",
    icon: FlaskConical,
  },
  {
    name: "Planos de Aula",
    description: "Estrutura planos de aula com metodologias ativas, dinâmicas e critérios de avaliação.",
    icon: BookOpen,
  },
];

const SIDEBAR_ITEMS = [
  { icon: Bot, label: "Agentes", count: 10 },
  { icon: MessageSquare, label: "Conversas", count: null },
  { icon: Video, label: "Conteúdo", count: null },
  { icon: Settings, label: "Configurações", count: null },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      {/* Nav */}
      <header className="border-b border-white/10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold">Agentes Posológicos</span>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Fazer login
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0">
                Criar conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(199 89% 48% / 0.4) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="container relative py-24 md:py-32 text-center">
          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.1] mb-6 animate-slide-up">
            Potencialize sua
            <br />
            <span className="gradient-text">Prática com IA</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60 mb-10 animate-fade-in">
            Agentes de IA especializados para farmacêuticos, educadores e pesquisadores.
            Simples de usar, rápido e pronto para deixar o seu dia mais produtivo.
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2 text-base px-8 py-6 animate-fade-in">
              Começar agora
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="container pb-24">
        <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[hsl(220,25%,8%)] overflow-hidden shadow-2xl shadow-black/50 animate-slide-up">
          <div className="flex">
            {/* Sidebar */}
            <div className="hidden md:flex w-64 flex-col border-r border-white/10 p-5">
              <div className="flex items-center gap-2 mb-8">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
                  <Pill className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-display text-sm font-bold text-white/90">Agentes Posológicos</span>
              </div>
              <nav className="space-y-1">
                {SIDEBAR_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                      item.label === "Agentes"
                        ? "bg-white/10 text-white"
                        : "text-white/50"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.count && (
                      <span className="ml-auto text-xs text-white/40">{item.count}</span>
                    )}
                  </div>
                ))}
              </nav>
            </div>

            {/* Main content */}
            <div className="flex-1 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-display font-semibold text-white">Agentes</h2>
                  <p className="text-sm text-white/40">Escolha um agente especializado</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/60">
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-white/60" />
                  </div>
                  Minha conta
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PREVIEW_AGENTS.map((agent) => (
                  <div
                    key={agent.name}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
                        <agent.icon className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-white leading-tight">{agent.name}</h3>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{agent.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
