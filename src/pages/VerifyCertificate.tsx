import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ShieldX, Search, FileCheck, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CertificateResult {
  valid: boolean;
  message?: string;
  certificate?: {
    id: string;
    verification_code: string;
    content_hash: string;
    content_preview: string;
    agent_name: string;
    created_at: string;
  };
}

interface IntegrityResult {
  valid: boolean;
  integrity?: boolean;
  message?: string;
}

export default function VerifyCertificate() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateResult | null>(null);

  const [showIntegrity, setShowIntegrity] = useState(false);
  const [integrityContent, setIntegrityContent] = useState("");
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);

  const handleVerify = async () => {
    if (!code.trim()) {
      toast.error("Digite o código de verificação");
      return;
    }
    setLoading(true);
    setResult(null);
    setShowIntegrity(false);
    setIntegrityResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("content-certificate", {
        body: { action: "verify", verificationCode: code.trim() },
      });
      if (error) throw error;
      setResult(data as CertificateResult);
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar");
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrityCheck = async () => {
    if (!integrityContent.trim()) {
      toast.error("Cole o conteúdo a ser verificado");
      return;
    }
    setIntegrityLoading(true);
    setIntegrityResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("content-certificate", {
        body: { action: "validate_hash", verificationCode: code.trim(), content: integrityContent },
      });
      if (error) throw error;
      setIntegrityResult(data as IntegrityResult);
    } catch (err: any) {
      toast.error(err.message || "Erro ao validar integridade");
    } finally {
      setIntegrityLoading(false);
    }
  };

  const formatCode = (v: string) => {
    const clean = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
    const parts = clean.match(/.{1,4}/g) || [];
    return parts.join("-");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold">Verificador de Autenticidade</h1>
              <p className="text-xs text-white/50">Agentes Posológicos</p>
            </div>
          </div>
          <a href="/" className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Search */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-2 text-center">Verificar Certificado</h2>
          <p className="text-sm text-white/50 text-center mb-6">
            Insira o código de verificação para conferir a autenticidade de um conteúdo gerado pela plataforma.
          </p>

          <div className="flex gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              placeholder="XXXX-XXXX-XXXX"
              className="bg-white/10 border-white/20 text-white text-center text-lg tracking-widest font-mono placeholder:text-white/30"
              maxLength={14}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
            <Button onClick={handleVerify} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {result.valid && result.certificate ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="h-8 w-8 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-emerald-300 text-lg">Certificado Válido</h3>
                    <p className="text-xs text-emerald-400/70">Conteúdo autêntico gerado pela plataforma</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Código</span>
                    <span className="font-mono text-emerald-300">{result.certificate.verification_code}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Agente</span>
                    <span>{result.certificate.agent_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Data de emissão</span>
                    <span>
                      {new Date(result.certificate.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="py-2 border-b border-white/10">
                    <span className="text-white/50 block mb-1">Hash SHA-256</span>
                    <code className="text-[10px] text-white/40 break-all font-mono">{result.certificate.content_hash}</code>
                  </div>
                  <div className="py-2">
                    <span className="text-white/50 block mb-1">Prévia do conteúdo</span>
                    <p className="text-white/70 text-xs italic">{result.certificate.content_preview}</p>
                  </div>
                </div>

                {/* Integrity check */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  {!showIntegrity ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowIntegrity(true)}
                      className="w-full border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <FileCheck className="h-4 w-4 mr-2" />
                      Verificar integridade do conteúdo
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-white/50">
                        Cole o conteúdo completo abaixo para verificar se ele não foi alterado após a certificação.
                      </p>
                      <Textarea
                        value={integrityContent}
                        onChange={(e) => setIntegrityContent(e.target.value)}
                        placeholder="Cole aqui o conteúdo completo..."
                        className="bg-white/10 border-white/20 text-white min-h-[120px] text-sm"
                      />
                      <Button
                        onClick={handleIntegrityCheck}
                        disabled={integrityLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {integrityLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Validar integridade
                      </Button>

                      {integrityResult && (
                        <div
                          className={`p-4 rounded-xl ${
                            integrityResult.integrity
                              ? "bg-emerald-500/10 border border-emerald-500/30"
                              : "bg-red-500/10 border border-red-500/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {integrityResult.integrity ? (
                              <ShieldCheck className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-400" />
                            )}
                            <span className={`text-sm font-medium ${integrityResult.integrity ? "text-emerald-300" : "text-red-300"}`}>
                              {integrityResult.message}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <ShieldX className="h-8 w-8 text-red-400" />
                  <div>
                    <h3 className="font-bold text-red-300 text-lg">Certificado Não Encontrado</h3>
                    <p className="text-sm text-red-400/70">
                      Nenhum certificado foi encontrado com este código. Verifique se digitou corretamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-12 text-center text-white/30 text-xs space-y-2">
          <p>O sistema de certificação gera um hash SHA-256 único para cada conteúdo produzido pela plataforma.</p>
          <p>Isso garante a integridade acadêmica e permite verificar se o conteúdo foi alterado após a geração.</p>
        </div>
      </main>
    </div>
  );
}
