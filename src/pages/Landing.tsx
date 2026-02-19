import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Pill, BookOpen, FlaskConical, Video, MessageSquare, Settings, Sparkles, Shield, Zap, Users, Brain, BarChart3, FileText, CheckCircle2 } from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "Agentes Especializados",
    description: "IA treinada para farmácia clínica, educação em saúde, pesquisa acadêmica e produção de conteúdo.",
  },
  {
    icon: Zap,
    title: "Respostas Estruturadas",
    description: "Outputs formatados com relatórios, protocolos e guias prontos para uso imediato.",
  },
  {
    icon: Shield,
    title: "Base de Conhecimento",
    description: "Alimente seus agentes com documentos, sites e textos para respostas contextualizadas via RAG.",
  },
  {
    icon: Users,
    title: "Agentes Personalizados",
    description: "Crie seus próprios agentes com prompts customizados, escolha de modelo e temperatura.",
  },
];

const CATEGORIES = [
  {
    color: "hsl(199,89%,48%)",
    name: "Prática Clínica",
    agents: ["Interações Cardiovasculares", "Antibioticoterapia", "Educador Clínico"],
  },
  {
    color: "hsl(174,62%,47%)",
    name: "EdTech & Professores",
    agents: ["Metodologias Ativas", "Simulador Clínico", "Analisador de Turma"],
  },
  {
    color: "hsl(262,52%,56%)",
    name: "Pesquisa Acadêmica",
    agents: ["Editais de Fomento", "Análise Estatística"],
  },
  {
    color: "hsl(38,92%,50%)",
    name: "Conteúdo & Tech",
    agents: ["SEO para YouTube", "Fact-Checker de Saúde"],
  },
];

const STATS = [
  { value: "10+", label: "Agentes prontos" },
  { value: "5", label: "Provedores de IA" },
  { value: "∞", label: "Agentes customizáveis" },
  { value: "RAG", label: "Base de conhecimento" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl">
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
                Entrar
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle, hsl(199 89% 48% / 0.5) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[hsl(199,89%,48%)]/[0.06] blur-[120px]" />
        </div>

        <div className="container relative py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-white/60 mb-8 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(14,90%,58%)]" />
            Plataforma de agentes IA para saúde e educação
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] mb-6 animate-slide-up">
            Seus agentes de IA
            <br />
            <span className="gradient-text">especializados</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg md:text-xl text-white/50 mb-10 animate-fade-in leading-relaxed">
            Agentes prontos para farmácia clínica, educação em saúde e pesquisa.
            Crie agentes personalizados com sua própria base de conhecimento.
          </p>
          <div className="flex items-center justify-center gap-4 animate-fade-in">
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2 text-base px-8 h-12">
                Começar gratuitamente
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-8 text-base">
                Fazer login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="container py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl font-bold gradient-text">{s.value}</p>
                <p className="mt-1 text-sm text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Tudo que você precisa</h2>
          <p className="text-white/40 max-w-xl mx-auto">Uma plataforma completa para potencializar sua prática profissional com inteligência artificial.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Categorias de Agentes</h2>
          <p className="text-white/40 max-w-xl mx-auto">Agentes especializados organizados por área de atuação.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <h3 className="font-display text-lg font-semibold text-white">{cat.name}</h3>
              </div>
              <div className="space-y-2">
                {cat.agents.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-sm text-white/50">
                    <CheckCircle2 className="h-4 w-4 text-white/20" />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(199,89%,48%)]/5 to-[hsl(174,62%,47%)]/5" />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para começar?
            </h2>
            <p className="text-white/40 max-w-lg mx-auto mb-8">
              Crie sua conta gratuita e ganhe créditos para experimentar todos os agentes.
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2 text-base px-10 h-12">
                Criar conta grátis
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container flex items-center justify-between text-sm text-white/30">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded gradient-primary">
              <Pill className="h-3 w-3 text-white" />
            </div>
            <span className="font-display font-semibold">Agentes Posológicos</span>
          </div>
          <span>© {new Date().getFullYear()} Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
