import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, ArrowRight, Pill, BookOpen, FlaskConical, Video, MessageSquare, Settings, Sparkles, Shield, Zap, Users, Brain, BarChart3, FileText, CheckCircle2, DoorOpen, Wrench, Stethoscope, Smartphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function Landing() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const { t } = useLanguage();

  const FEATURES = [
    { icon: Brain, title: t("feature.specialized"), description: t("feature.specialized.desc") },
    { icon: Wrench, title: t("feature.custom"), description: t("feature.custom.desc") },
    { icon: Stethoscope, title: t("feature.virtual"), description: t("feature.virtual.desc") },
    { icon: Smartphone, title: t("feature.whatsapp"), description: t("feature.whatsapp.desc") },
    { icon: Shield, title: t("feature.rag"), description: t("feature.rag.desc") },
    { icon: Zap, title: t("feature.structured"), description: t("feature.structured.desc") },
  ];

  const CATEGORIES = [
    { color: "hsl(199,89%,48%)", name: t("cat.clinical"), agents: ["Interações Cardiovasculares", "Antibioticoterapia", "Educador Clínico"] },
    { color: "hsl(174,62%,47%)", name: t("cat.edtech"), agents: ["Metodologias Ativas", "Simulador Clínico", "Analisador de Turma"] },
    { color: "hsl(262,52%,56%)", name: t("cat.research"), agents: ["Editais de Fomento", "Análise Estatística"] },
    { color: "hsl(38,92%,50%)", name: t("cat.content"), agents: ["SEO para YouTube", "Fact-Checker de Saúde"] },
  ];

  const STATS = [
    { value: "10+", label: t("landing.stats.agents") },
    { value: "5", label: t("landing.stats.providers") },
    { value: "∞", label: t("landing.stats.custom") },
    { value: "RAG", label: t("landing.stats.rag") },
  ];

  const handlePinAccess = () => {
    if (pin.trim().length >= 4) {
      navigate(`/sala/${pin.trim()}`);
    }
  };

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
            <LanguageSelector />
            <Link to="/login">
              <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                {t("landing.enter")}
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0">
                {t("landing.signup")}
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
            {t("landing.subtitle")}
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] mb-6 animate-slide-up">
            {t("landing.hero.title1")}
            <br />
            <span className="gradient-text">{t("landing.hero.title2")}</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg md:text-xl text-white/50 mb-10 animate-fade-in leading-relaxed">
            {t("landing.hero.desc")}
          </p>
          <div className="flex items-center justify-center gap-4 animate-fade-in">
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2 text-base px-8 h-12">
                {t("landing.cta")}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-8 text-base">
                {t("landing.login")}
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

      {/* PIN Access */}
      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="container py-12">
          <div className="mx-auto max-w-md text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <DoorOpen className="h-6 w-6 text-[hsl(174,62%,47%)]" />
              <h2 className="font-display text-xl font-bold text-white">{t("landing.pin.title")}</h2>
            </div>
            <p className="text-sm text-white/40 mb-4">{t("landing.pin.desc")}</p>
            <div className="flex gap-2">
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t("landing.pin.placeholder")}
                className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 text-center font-mono text-lg tracking-widest"
                onKeyDown={(e) => { if (e.key === "Enter") handlePinAccess(); }}
              />
              <Button onClick={handlePinAccess} disabled={pin.trim().length < 4} className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white shrink-0">
                {t("landing.pin.access")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t("landing.features.title")}</h2>
          <p className="text-white/40 max-w-xl mx-auto">{t("landing.features.desc")}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t("landing.categories.title")}</h2>
          <p className="text-white/40 max-w-xl mx-auto">{t("landing.categories.desc")}</p>
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
              {t("landing.cta2.title")}
            </h2>
            <p className="text-white/40 max-w-lg mx-auto mb-8">
              {t("landing.cta2.desc")}
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2 text-base px-10 h-12">
                {t("landing.signup")}
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
          <span>© {new Date().getFullYear()} {t("landing.footer.rights")}</span>
        </div>
      </footer>
    </div>
  );
}
