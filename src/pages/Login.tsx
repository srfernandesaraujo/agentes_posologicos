import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen bg-[hsl(220,25%,5%)]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-white/10">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary">
            <Pill className="h-10 w-10 text-white" />
          </div>
          <h2 className="mb-4 font-display text-4xl font-bold text-white">
            Agentes Posológicos
          </h2>
          <p className="text-lg text-white/60">
            Agentes de IA especializados para profissionais de saúde, educadores e pesquisadores.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold gradient-text">Agentes Posológicos</span>
          </div>

          <h1 className="mb-2 font-display text-3xl font-bold text-white">Entrar</h1>
          <p className="mb-8 text-white/50">
            Acesse sua conta para usar os agentes
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">E-mail</Label>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-white/20"
              />
            </div>
            <Button type="submit" className="w-full gap-2 bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            Não tem conta?{" "}
            <Link to="/signup" className="font-medium text-[hsl(174,62%,47%)] hover:underline">
              Criar conta gratuita
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
