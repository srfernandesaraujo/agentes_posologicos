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
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/20 backdrop-blur-sm">
            <Pill className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="mb-4 font-display text-4xl font-bold text-primary-foreground">
            Agentes Posológicos
          </h2>
          <p className="text-lg text-primary-foreground/80">
            Agentes de IA especializados para profissionais de saúde, educadores e pesquisadores.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Pill className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold gradient-text">Agentes Posológicos</span>
          </div>

          <h1 className="mb-2 font-display text-3xl font-bold">Entrar</h1>
          <p className="mb-8 text-muted-foreground">
            Acesse sua conta para usar os agentes
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Criar conta gratuita
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
