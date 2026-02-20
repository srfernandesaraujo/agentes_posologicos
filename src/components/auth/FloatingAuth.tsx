import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowRight, LogIn, Chrome } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export function FloatingAuth() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      navigate("/agentes");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("signup.success"));
      setTab("login");
      setPassword("");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/agentes`,
      },
    });
    if (error) toast.error(error.message);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white gap-2"
        >
          <LogIn className="h-4 w-4" />
          {t("landing.enter")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] border-white/10 bg-[hsl(220,25%,8%)] p-0 shadow-2xl shadow-black/50"
        sideOffset={8}
      >
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              tab === "login" ? "text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {t("login.submit")}
            {tab === "login" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-[hsl(174,62%,47%)]" />
            )}
          </button>
          <button
            onClick={() => setTab("signup")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              tab === "signup" ? "text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {t("signup.title")}
            {tab === "signup" && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-[hsl(174,62%,47%)]" />
            )}
          </button>
        </div>

        <div className="p-5">
          {/* Google login */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full gap-2 border-white/10 bg-white/[0.05] text-white hover:bg-white/10 hover:text-white mb-4"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">{t("login.email")}</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30 focus-visible:ring-[hsl(174,62%,47%)]/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">{t("login.password")}</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30 focus-visible:ring-[hsl(174,62%,47%)]/30"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white border-0"
              >
                {loading ? t("login.loading") : t("login.submit")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">{t("signup.name")}</Label>
                <Input
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30 focus-visible:ring-[hsl(174,62%,47%)]/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">{t("signup.email")}</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30 focus-visible:ring-[hsl(174,62%,47%)]/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">{t("signup.password")}</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="h-9 border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/30 focus-visible:ring-[hsl(174,62%,47%)]/30"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white border-0"
              >
                {loading ? t("signup.loading") : t("signup.submit")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
