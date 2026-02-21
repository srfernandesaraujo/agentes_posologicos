import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill, ArrowRight, Lock, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

type Mode = "request" | "set-password" | "loading-session";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const invited = searchParams.get("invited") === "true";
    const isRecoveryFlow = hash.includes("type=recovery") || hash.includes("type=invite") || invited;
    
    if (isRecoveryFlow) {
      setMode("loading-session");
      setIsInvite(invited || hash.includes("type=invite"));
    }

    // Explicitly extract and set session from hash tokens
    const establishSession = async () => {
      if (!isRecoveryFlow) return;

      // Try to parse tokens directly from hash
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          setSessionReady(true);
          setMode("set-password");
          // Clean hash from URL
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          return;
        }
      }

      // Fallback: poll for session (Supabase client may process hash internally)
      for (let i = 0; i < 20; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
          setMode("set-password");
          return;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // Timeout - show warning
      setMode("set-password");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && isRecoveryFlow)) {
        setSessionReady(true);
        setMode("set-password");
      }
    });

    establishSession();

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Email enviado! Verifique sua caixa de entrada.");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!sessionReady) {
      toast.error("Aguarde a sessão ser carregada. Tente novamente em alguns segundos.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha definida com sucesso!");
      navigate("/agentes");
    }
  };

  return (
    <div className="flex min-h-screen bg-[hsl(220,25%,5%)]">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-white/10">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary">
            <Pill className="h-10 w-10 text-white" />
          </div>
          <h2 className="mb-4 font-display text-4xl font-bold text-white">Agentes Posológicos</h2>
          <p className="text-lg text-white/60">
            {isInvite
              ? "Você foi convidado! Defina sua senha para começar a usar a plataforma."
              : "Redefina sua senha para continuar acessando a plataforma."}
          </p>
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

          {mode === "loading-session" ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-white/50">Verificando sessão de autenticação...</p>
            </div>
          ) : mode === "set-password" ? (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h1 className="mb-2 font-display text-3xl font-bold text-white">
                {isInvite ? "Crie sua senha" : "Nova senha"}
              </h1>
              <p className="mb-8 text-white/50">
                {isInvite
                  ? "Defina uma senha para acessar sua conta com acesso ilimitado."
                  : "Digite sua nova senha abaixo."}
              </p>

              {!sessionReady && (
                <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                  O link pode ter expirado. Solicite um novo link de redefinição de senha.
                </div>
              )}

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/70">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white/70">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gap-2 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0"
                  disabled={loading || !sessionReady}
                >
                  {loading ? "Salvando..." : !sessionReady ? "Sessão expirada" : "Definir senha"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : sent ? (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(152,60%,42%)]/10">
                <Check className="h-6 w-6 text-[hsl(152,60%,42%)]" />
              </div>
              <h1 className="mb-2 font-display text-3xl font-bold text-white">Email enviado!</h1>
              <p className="mb-8 text-white/50">
                Verifique sua caixa de entrada (e spam) para o link de redefinição de senha.
              </p>
              <Button
                onClick={() => { setSent(false); setEmail(""); }}
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/5"
              >
                Enviar novamente
              </Button>
            </>
          ) : (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="mb-2 font-display text-3xl font-bold text-white">Esqueceu a senha?</h1>
              <p className="mb-8 text-white/50">
                Informe seu email e enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/70">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gap-2 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0"
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Enviar link de redefinição"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-white/40">
            Lembrou a senha?{" "}
            <Link to="/login" className="font-medium text-[hsl(174,62%,47%)] hover:underline">Fazer login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
