import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, BarChart3, Settings, Megaphone } from "lucide-react";
import type { CookiePreferences } from "@/hooks/useCookieConsent";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (prefs: CookiePreferences) => void;
  initial: CookiePreferences | null;
}

const CATEGORIES = [
  {
    key: "necessary" as const,
    icon: Shield,
    label: "Necessários",
    description: "Essenciais para o funcionamento do site. Incluem consentimento de cookies e estado da interface.",
    locked: true,
  },
  {
    key: "functional" as const,
    icon: Settings,
    label: "Funcionais",
    description: "Melhoram sua experiência salvando preferências como idioma e último agente visualizado.",
  },
  {
    key: "analytics" as const,
    icon: BarChart3,
    label: "Analíticos",
    description: "Nos ajudam a entender como o site é usado para melhorar nossos agentes e conteúdos.",
  },
  {
    key: "marketing" as const,
    icon: Megaphone,
    label: "Marketing",
    description: "Rastreiam a origem do seu acesso (ex: campanhas em redes sociais) para otimizarmos a divulgação.",
  },
];

export function CookiePreferencesModal({ open, onOpenChange, onSave, initial }: Props) {
  const [prefs, setPrefs] = useState<CookiePreferences>(
    initial ?? { necessary: true, functional: false, analytics: false, marketing: false }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Preferências de Cookies
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {CATEGORIES.map(({ key, icon: Icon, label, description, locked }) => (
            <div key={key} className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
              <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">{label}</Label>
                  <Switch
                    checked={prefs[key]}
                    disabled={locked}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => { onSave(prefs); onOpenChange(false); }}>
            Salvar preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
