import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

export default function OSCEJoin() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  async function join() {
    if (pin.trim().length < 4) { toast.error("Informe o PIN"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("osce-session-control", {
        body: { action: "join", pin: pin.trim(), displayName: user?.email },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      navigate(`/osce/sala/${(data as any).sessionId}`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao entrar");
    } finally { setLoading(false); }
  }

  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5" /> Entrar em uma prova OSCE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Digite o PIN de 6 dígitos compartilhado pelo professor.</p>
          <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000" className="text-center text-3xl tracking-[0.5em] font-mono h-16"
            onKeyDown={(e) => e.key === "Enter" && join()} />
          <Button onClick={join} disabled={loading || pin.length < 6} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}