import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { CookiePreferencesModal } from "./CookiePreferencesModal";

export function CookieConsent() {
  const { isConsentGiven, acceptAll, acceptNecessaryOnly, setConsent, preferences } = useCookieConsent();
  const [showPrefs, setShowPrefs] = useState(false);

  if (isConsentGiven) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-bottom-4 duration-500">
        <div className="mx-auto max-w-3xl rounded-xl border bg-background/95 backdrop-blur-lg shadow-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">Nós usamos cookies 🍪</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Utilizamos cookies para melhorar sua experiência, analisar o tráfego e personalizar conteúdo. 
                  Você pode escolher quais categorias aceitar.{" "}
                  <Link to="/cookies" className="underline hover:text-primary transition-colors">
                    Política de Cookies
                  </Link>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={acceptAll}>
                  Aceitar todos
                </Button>
                <Button size="sm" variant="outline" onClick={acceptNecessaryOnly}>
                  Apenas necessários
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowPrefs(true)}>
                  Personalizar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CookiePreferencesModal
        open={showPrefs}
        onOpenChange={setShowPrefs}
        onSave={setConsent}
        initial={preferences}
      />
    </>
  );
}
