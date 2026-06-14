import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Stethoscope } from "lucide-react";

export default function OSCEJoin() {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  async function join() {
    if (pin.trim().length < 4) { toast.error("Informe o PIN"); return; }
    if (!user) {
      if (!name.trim()) { toast.error("Informe seu nome"); return; }
      if (!email.trim() || !email.includes("@")) { toast.error("Informe um e-mail válido"); return; }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("osce-session-control", {
        body: {
          action: "join",
          pin: pin.trim(),
          guestName: user ? undefined : name.trim(),
          guestEmail: user ? undefined : email.trim().toLowerCase(),
        },
      });
      let errMsg = (data as any)?.error as string | undefined;
      if (error) {
        // supabase-js v2: read the real error body on non-2xx
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            errMsg = body?.error || errMsg;
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.text();
            try { errMsg = JSON.parse(txt)?.error || errMsg || txt; } catch { errMsg = errMsg || txt; }
          }
        } catch { /* ignore */ }
        if (!errMsg) errMsg = error.message;
      }
      if (errMsg) throw new Error(errMsg);
      const sessionId = (data as any).sessionId;
      const guestToken = (data as any).guestToken;
      if (guestToken) {
        localStorage.setItem(`osce_guest_${sessionId}`, JSON.stringify({ token: guestToken, name, email }));
      }
      navigate(`/osce/sala/${sessionId}`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao entrar");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Stethoscope className="h-5 w-5 text-[hsl(174,62%,47%)]" /> Entrar em uma prova OSCE
          </CardTitle>
          <CardDescription className="text-white/60">
            Digite o PIN compartilhado pelo professor.{!user && " Você não precisa criar uma conta."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-white/80">PIN</Label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-3xl tracking-[0.5em] font-mono h-16 bg-white/5 border-white/15 text-white"
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
          </div>
          {!user && (
            <>
              <div className="space-y-1.5">
                <Label className="text-white/80">Seu nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  className="bg-white/5 border-white/15 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/80">Seu e-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="bg-white/5 border-white/15 text-white"
                />
                <p className="text-[11px] text-white/40">
                  Usado apenas para identificar sua prova. Não criamos conta automaticamente.
                </p>
              </div>
            </>
          )}
          <Button
            onClick={join}
            disabled={loading || pin.length < 6}
            className="w-full bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,42%)] text-white gap-2"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Entrando..." : "Entrar na prova"}
          </Button>
          <div className="text-center pt-2">
            <Link to="/" className="text-xs text-white/50 hover:text-white">
              Voltar ao início
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}