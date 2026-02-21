import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/agentes");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/agentes` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex min-h-screen bg-[hsl(220,25%,5%)]">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-white/10">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary">
            <Pill className="h-10 w-10 text-white" />
          </div>
          <h2 className="mb-4 font-display text-4xl font-bold text-white">Agentes Posológicos</h2>
          <p className="text-lg text-white/60">{t("login.branding")}</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 flex items-center justify-between">
            <div className="lg:hidden flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
                <Pill className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold gradient-text">Agentes Posológicos</span>
            </div>
            <LanguageSelector />
          </div>

          <h1 className="mb-2 font-display text-3xl font-bold text-white">{t("login.title")}</h1>
          <p className="mb-8 text-white/50">{t("login.desc")}</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full gap-2 border-white/10 bg-white/[0.05] text-white hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">{t("login.email")}</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">{t("login.password")}</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20" />
            </div>
            <Button type="submit" className="w-full gap-2 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0" disabled={loading}>
              {loading ? t("login.loading") : t("login.submit")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="text-right">
              <Link to="/redefinir-senha" className="text-sm font-medium text-[hsl(174,62%,47%)] hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            {t("login.noAccount")}{" "}
            <Link to="/signup" className="font-medium text-[hsl(174,62%,47%)] hover:underline">{t("login.createFree")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
