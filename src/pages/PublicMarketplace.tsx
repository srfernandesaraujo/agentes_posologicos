import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pill, Bot, ArrowLeft, ArrowRight, Sparkles, Star, Calculator, Gamepad2, Stethoscope, Brain, FlaskConical, BarChart3, BookOpen, Shield } from "lucide-react";
import { FloatingAuth } from "@/components/auth/FloatingAuth";

const PRODUCTS = [
  {
    icon: Stethoscope,
    name: "Simulador de Casos Clínicos",
    category: "Simulador",
    color: "hsl(199,89%,48%)",
    description: "Gera cenários clínicos complexos e realistas para treinamento de estudantes e residentes. Inclui erros de administração, reações adversas graves e situações de emergência farmacológica.",
    useCase: "Professores economizam horas na criação de provas e estudos de caso. Estudantes praticam raciocínio clínico em ambiente seguro.",
    highlight: true,
  },
  {
    icon: Calculator,
    name: "Calculadora de Risco Cardiovascular",
    category: "Calculadora",
    color: "hsl(14,90%,58%)",
    description: "Cruza prescrições com dados do paciente para calcular risco cardiovascular e alertar sobre interações medicamentosas graves, sugerindo ajustes de dose baseados em evidências.",
    useCase: "Farmacêuticos e médicos tomam decisões clínicas mais seguras com análise automatizada de risco.",
    highlight: true,
  },
  {
    icon: Brain,
    name: "Arquiteto de Metodologias Ativas",
    category: "Simulador",
    color: "hsl(174,62%,47%)",
    description: "Estrutura planos de aula completos baseados em PBL, sala invertida, TBL e outras metodologias ativas. Inclui dinâmicas, casos práticos e critérios de avaliação.",
    useCase: "Professores transformam aulas expositivas em experiências de aprendizado ativas e engajantes.",
    highlight: false,
  },
  {
    icon: Shield,
    name: "Consultor de Antibioticoterapia",
    category: "Calculadora",
    color: "hsl(262,52%,56%)",
    description: "Assistente baseado em diretrizes atualizadas. Sugere antimicrobianos ideais considerando quadro clínico, perfil de resistência hospitalar, posologia e alertas de toxicidade.",
    useCase: "Farmacêuticos hospitalares e médicos otimizam a terapia antimicrobiana com recomendações baseadas em evidências.",
    highlight: false,
  },
  {
    icon: FlaskConical,
    name: "Consultor de Análise Estatística",
    category: "Calculadora",
    color: "hsl(38,92%,50%)",
    description: "Indica o melhor teste estatístico para sua pesquisa, explica como preparar os dados e como interpretar resultados no padrão exigido por revistas científicas.",
    useCase: "Pesquisadores e pós-graduandos avançam na análise de dados sem precisar de um estatístico dedicado.",
    highlight: false,
  },
  {
    icon: Gamepad2,
    name: "Desmistificador e Fact-Checker",
    category: "Jogo",
    color: "hsl(199,89%,48%)",
    description: "Combate desinformação em saúde construindo argumentos sólidos baseados em evidências científicas. Ideal para criar conteúdo educativo que desmente mitos e fake news.",
    useCase: "Criadores de conteúdo e profissionais de saúde produzem material antifake para redes sociais em minutos.",
    highlight: false,
  },
  {
    icon: BarChart3,
    name: "Analisador Adaptativo de Turma",
    category: "Simulador",
    color: "hsl(174,62%,47%)",
    description: "Analisa dados de desempenho dos alunos para identificar lacunas de aprendizado, sugerir agrupamentos estratégicos e adaptar o nível de dificuldade das aulas.",
    useCase: "Professores personalizam o ensino baseados em dados reais da turma, aumentando a eficácia pedagógica.",
    highlight: false,
  },
  {
    icon: BookOpen,
    name: "Educador e Tradutor Clínico",
    category: "Simulador",
    color: "hsl(14,90%,58%)",
    description: "Transforma dados técnicos de tratamentos complexos (Diabetes, Alzheimer, etc.) em material educativo com linguagem acessível, analogias e cronogramas de uso.",
    useCase: "Farmacêuticos criam material para pacientes que pode ser impresso ou enviado via WhatsApp em segundos.",
    highlight: false,
  },
];

export default function PublicMarketplace() {
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
          <FloatingAuth />
        </div>
      </header>

      <div className="container max-w-6xl py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-white/60 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(14,90%,58%)]" />
            Simuladores, Calculadoras e Assistentes Inteligentes
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Conheça nossos <span className="gradient-text">Agentes de IA</span>
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto text-lg">
            Ferramentas inteligentes projetadas para profissionais de saúde, educadores e pesquisadores. Cada agente é um especialista no que faz.
          </p>
        </div>

        {/* Featured */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          {PRODUCTS.filter(p => p.highlight).map((product) => (
            <div
              key={product.name}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 transition-all hover:-translate-y-1 hover:border-white/20"
            >
              <div className="absolute top-4 right-4 rounded-full bg-[hsl(14,90%,58%)]/20 px-3 py-1 text-xs font-semibold text-[hsl(14,90%,58%)]">
                ⭐ Destaque
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-xl mb-5" style={{ background: `${product.color}20`, border: `1px solid ${product.color}40` }}>
                <product.icon className="h-7 w-7" style={{ color: product.color }} />
              </div>
              <div className="inline-block rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/50 mb-3">
                {product.category}
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-3">{product.name}</h3>
              <p className="text-sm text-white/60 leading-relaxed mb-4">{product.description}</p>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-xs text-white/40 font-medium mb-1">💡 Caso de uso</p>
                <p className="text-sm text-white/70">{product.useCase}</p>
              </div>
            </div>
          ))}
        </div>

        {/* All Products */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-16">
          {PRODUCTS.filter(p => !p.highlight).map((product) => (
            <div
              key={product.name}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:-translate-y-1 hover:border-white/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4" style={{ background: `${product.color}15`, border: `1px solid ${product.color}30` }}>
                <product.icon className="h-6 w-6" style={{ color: product.color }} />
              </div>
              <div className="inline-block rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/50 mb-2">
                {product.category}
              </div>
              <h3 className="font-display text-base font-bold text-white mb-2">{product.name}</h3>
              <p className="text-sm text-white/50 leading-relaxed mb-3">{product.description}</p>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
                <p className="text-xs text-white/40 font-medium mb-0.5">💡 Caso de uso</p>
                <p className="text-xs text-white/60">{product.useCase}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(199,89%,48%)]/5 to-[hsl(174,62%,47%)]/5" />
          <div className="relative">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
              Pronto para experimentar?
            </h2>
            <p className="text-white/40 max-w-lg mx-auto mb-8">
              Crie sua conta gratuita e receba 15 créditos de boas-vindas para testar os agentes.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2 px-8 h-12">
                  Criar Conta Gratuita
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-8">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
