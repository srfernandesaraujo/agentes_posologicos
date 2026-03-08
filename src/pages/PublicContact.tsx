import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle2, Pill, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PublicContact() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) return;

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("contact-form", {
        body: {
          subject: subject.trim(),
          message: `[Contato público]\nNome: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`,
          senderName: name.trim(),
          senderEmail: email.trim(),
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setSent(true);
      toast({ title: "Mensagem enviada!", description: "Responderemos o mais breve possível." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(220,25%,5%)] text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,25%,5%)]/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold">Agentes Posológicos</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Entrar
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0">
                Criar Conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        {sent ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <CheckCircle2 className="h-16 w-16 text-[hsl(174,62%,47%)]" />
            <h2 className="text-2xl font-bold text-white">Mensagem enviada!</h2>
            <p className="text-white/60 text-center max-w-md">
              Sua mensagem foi enviada com sucesso. Responderemos o mais breve possível no email <span className="text-white/80">{email}</span>.
            </p>
            <Button variant="outline" onClick={() => setSent(false)} className="mt-4 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Enviar outra mensagem
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="font-display text-2xl font-bold text-white mb-2">Fale Conosco</h1>
            <p className="text-white/50 mb-8">Envie sua mensagem e responderemos o mais breve possível.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/70">Nome</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Assunto</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Dúvida sobre planos, sugestão de agente..."
                  maxLength={200}
                  required
                  className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
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
                  className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 resize-none"
                />
                <p className="text-xs text-white/30 text-right">{message.length}/5000</p>
              </div>

              <Button
                type="submit"
                disabled={loading || !name.trim() || !email.trim() || !subject.trim() || !message.trim()}
                className="w-full bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white"
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
          </div>
        )}
      </div>
    </div>
  );
}
