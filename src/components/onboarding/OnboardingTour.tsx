import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TourStep {
  title: string;
  description: string;
  targetSelector?: string;
  route: string;
  position: "top" | "bottom" | "left" | "right" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao Agentes Posológicos! 🎉",
    description: "Vamos fazer um tour rápido para você conhecer as principais funcionalidades da plataforma. Será rápido, prometo!",
    route: "/agentes",
    position: "center",
  },
  {
    title: "Biblioteca de Agentes",
    description: "Aqui você encontra todos os agentes de IA especializados. Cada um foi treinado para uma tarefa específica na área de saúde e educação.",
    route: "/agentes",
    position: "center",
  },
  {
    title: "Seus Créditos",
    description: "Cada interação consome créditos. Você começa com créditos grátis! Acompanhe seu saldo e adquira mais quando precisar.",
    targetSelector: "[data-tour='credits']",
    route: "/agentes",
    position: "bottom",
  },
  {
    title: "Crie Seus Próprios Agentes",
    description: "Além dos agentes nativos, você pode criar agentes personalizados com seu próprio prompt, modelo de IA e base de conhecimento.",
    targetSelector: "[data-tour='my-agents']",
    route: "/agentes",
    position: "bottom",
  },
  {
    title: "Sua Conta",
    description: "Acesse seu perfil, dashboard com métricas de uso e configurações da conta pelo menu do avatar.",
    targetSelector: "[data-tour='user-menu']",
    route: "/agentes",
    position: "bottom",
  },
  {
    title: "Tudo pronto! 🚀",
    description: "Agora é só escolher um agente e começar a usar. Se tiver dúvidas, estamos aqui para ajudar. Bom trabalho!",
    route: "/agentes",
    position: "center",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences" as any)
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user,
  });

  const completeTour = useMutation({
    mutationFn: async () => {
      await supabase
        .from("user_preferences" as any)
        .upsert(
          { user_id: user!.id, onboarding_completed: true },
          { onConflict: "user_id" }
        );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-preferences"] }),
  });

  useEffect(() => {
    if (user && prefs === null && location.pathname === "/agentes") {
      // No preferences record = new user
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user, prefs, location.pathname]);

  const updateTooltipPosition = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step.targetSelector || step.position === "center") {
      setTooltipPos({ top: 0, left: 0 });
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setTooltipPos({ top: 0, left: 0 });
      return;
    }

    const rect = el.getBoundingClientRect();
    const pos = { top: 0, left: 0 };

    switch (step.position) {
      case "bottom":
        pos.top = rect.bottom + 12;
        pos.left = rect.left + rect.width / 2;
        break;
      case "top":
        pos.top = rect.top - 12;
        pos.left = rect.left + rect.width / 2;
        break;
      case "right":
        pos.top = rect.top + rect.height / 2;
        pos.left = rect.right + 12;
        break;
      case "left":
        pos.top = rect.top + rect.height / 2;
        pos.left = rect.left - 12;
        break;
    }

    setTooltipPos(pos);
  }, [currentStep]);

  useEffect(() => {
    if (!showTour) return;
    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    return () => window.removeEventListener("resize", updateTooltipPosition);
  }, [showTour, currentStep, updateTooltipPosition]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (TOUR_STEPS[nextStep].route !== location.pathname) {
        navigate(TOUR_STEPS[nextStep].route);
      }
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if (TOUR_STEPS[prevStep].route !== location.pathname) {
        navigate(TOUR_STEPS[prevStep].route);
      }
    }
  };

  const handleClose = () => {
    setShowTour(false);
    completeTour.mutate();
  };

  if (!showTour) return null;

  const step = TOUR_STEPS[currentStep];
  const isCenter = step.position === "center" || !step.targetSelector;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Tooltip */}
      <div
        className="fixed z-[9999] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-[hsl(220,25%,10%)] p-5 shadow-2xl animate-fade-in"
        style={
          isCenter
            ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            : {
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
                transform: step.position === "bottom" ? "translateX(-50%)" : step.position === "top" ? "translate(-50%, -100%)" : undefined,
              }
        }
      >
        {/* Arrow for non-center */}
        {!isCenter && step.position === "bottom" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-[hsl(220,25%,10%)] border-l border-t border-white/15" />
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(14,90%,58%)]" />
            <h3 className="font-display font-bold text-white text-sm">{step.title}</h3>
          </div>
          <button onClick={handleClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-white/60 leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? "w-4 bg-[hsl(14,90%,58%)]" : i < currentStep ? "w-1.5 bg-[hsl(174,62%,47%)]" : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev} className="h-8 text-white/60 hover:text-white hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="h-8 gap-1 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0"
            >
              {currentStep === TOUR_STEPS.length - 1 ? "Começar!" : "Próximo"}
              {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <button onClick={handleClose} className="mt-3 w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors">
          Pular tour
        </button>
      </div>
    </>
  );
}
