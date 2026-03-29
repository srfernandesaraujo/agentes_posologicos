import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Certificate {
  id: string;
  verification_code: string;
  content_hash: string;
  created_at: string;
}

export function useContentCertificate() {
  const [generating, setGenerating] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);

  const generateCertificate = async ({
    content,
    agentName,
    sessionId,
    messageId,
  }: {
    content: string;
    agentName: string;
    sessionId?: string;
    messageId?: string;
  }) => {
    setGenerating(true);
    setCertificate(null);

    try {
      const { data, error } = await supabase.functions.invoke("content-certificate", {
        body: { action: "generate", content, agentName, sessionId, messageId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCertificate(data.certificate);
      toast.success("Certificado gerado com sucesso!");
      return data.certificate as Certificate;
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar certificado");
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generateCertificate, generating, certificate, setCertificate };
}
