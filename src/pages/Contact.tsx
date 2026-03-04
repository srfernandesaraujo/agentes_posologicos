import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("contact-form", {
        body: { subject: subject.trim(), message: message.trim() },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setSent(true);
      setSubject("");
      setMessage("");
      toast({ title: "Mensagem enviada!", description: "Responderemos o mais breve possível." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <CheckCircle2 className="h-16 w-16 text-emerald-400" />
        <h2 className="text-2xl font-bold text-white">Mensagem enviada!</h2>
        <p className="text-white/60 text-center max-w-md">
          Sua mensagem foi enviada com sucesso. Responderemos o mais breve possível no email <span className="text-white/80">{user?.email}</span>.
        </p>
        <Button variant="outline" onClick={() => setSent(false)} className="mt-4">
          Enviar outra mensagem
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-xl">Fale Conosco</CardTitle>
          <CardDescription className="text-white/50">
            Envie sua mensagem e responderemos o mais breve possível.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-white/70">Remetente</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-white/5 border-white/10 text-white/60"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Dúvida sobre planos, sugestão de agente..."
                maxLength={200}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Mensagem</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva sua mensagem aqui..."
                maxLength={5000}
                rows={6}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />
              <p className="text-xs text-white/30 text-right">{message.length}/5000</p>
            </div>

            <Button
              type="submit"
              disabled={loading || !subject.trim() || !message.trim()}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Enviar mensagem
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
