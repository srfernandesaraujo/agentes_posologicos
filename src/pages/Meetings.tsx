import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Video, Send, RefreshCw, FileText, Copy, Clock, CheckCircle2, AlertCircle, Loader2, Trash2, Link2, Unlink, FileSearch, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddToProjectMenu } from "@/components/projects/AddToProjectMenu";

const GOOGLE_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Você cancelou a conexão com o Google.",
  invalid_state: "A conexão expirou, tente novamente.",
  no_refresh_token: "O Google não concedeu acesso permanente. Tente conectar novamente e aceite todas as permissões.",
  token_exchange_failed: "Falha ao trocar credenciais com o Google.",
  save_failed: "Falha ao salvar a conexão.",
};

type Meeting = {
  id: string;
  meet_link: string;
  title: string;
  status: string;
  bot_id: string | null;
  transcript: string;
  summary: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Aguardando ata", icon: Clock, color: "bg-yellow-500/20 text-yellow-400" },
  matched: { label: "Reunião localizada", icon: FileSearch, color: "bg-cyan-500/20 text-cyan-400" },
  transcribing: { label: "Lendo transcrição", icon: Loader2, color: "bg-blue-500/20 text-blue-400" },
  summarizing: { label: "Gerando Ata", icon: Loader2, color: "bg-purple-500/20 text-purple-400" },
  done: { label: "Concluído", icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-400" },
  error: { label: "Erro", icon: AlertCircle, color: "bg-red-500/20 text-red-400" },
};

export default function Meetings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meetLink, setMeetLink] = useState("");
  const [meetTitle, setMeetTitle] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const { data: googleConnection, isLoading: isLoadingConnection } = useQuery({
    queryKey: ["google-connection", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meeting-google-status", { body: {} });
      if (error) throw error;
      return data as { connected: boolean; googleEmail: string | null; lastError: string | null };
    },
    enabled: !!user,
  });

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    const googleError = searchParams.get("google_error");
    if (connected) {
      toast({ title: "Google conectado!", description: "Agora você pode registrar reuniões." });
      queryClient.invalidateQueries({ queryKey: ["google-connection"] });
    } else if (googleError) {
      toast({
        title: "Não foi possível conectar o Google",
        description: GOOGLE_OAUTH_ERROR_MESSAGES[googleError] || googleError,
        variant: "destructive",
      });
    }
    if (connected || googleError) {
      searchParams.delete("google_connected");
      searchParams.delete("google_error");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meeting-google-oauth-start", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { authUrl: string };
    },
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
    onError: (e: any) => {
      toast({ title: "Erro ao conectar Google", description: e.message, variant: "destructive" });
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meeting-google-disconnect", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Google desconectado" });
      queryClient.invalidateQueries({ queryKey: ["google-connection"] });
    },
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings", user?.id],
    queryFn: async () => {
      await supabase.functions.invoke("meeting-sync", { body: {} });

      const { data, error } = await supabase
        .from("meetings" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Meeting[];
    },
    enabled: !!user,
    refetchInterval: 15000, // Poll every 15s for status updates
  });

  // Auto-select first meeting if none selected
  useEffect(() => {
    if (selectedMeeting) {
      const updated = meetings.find((m) => m.id === selectedMeeting.id);
      if (updated) setSelectedMeeting(updated);
    }
  }, [meetings]);

  const registerMeetingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meeting-register", {
        body: { meet_link: meetLink.trim(), title: meetTitle || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Reunião registrada!",
        description: "A ata será gerada automaticamente assim que o Gemini terminar de processar a reunião no Meet.",
      });
      setMeetLink("");
      setMeetTitle("");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      if (data?.meeting) setSelectedMeeting(data.meeting);
    },
    onError: (e: any) => {
      if (e.message === "google_not_connected") {
        toast({
          title: "Conecte sua conta do Google",
          description: "Você precisa conectar sua conta do Google antes de registrar uma reunião.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Erro ao registrar reunião", description: e.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { data, error } = await supabase.functions.invoke("meeting-summary", {
        body: { meeting_id: meetingId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Ata regenerada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao regenerar ata", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase.from("meetings" as any).delete().eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reunião removida" });
      setSelectedMeeting(null);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a área de transferência!" });
  };

  const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
  const isValidLink = meetRegex.test(meetLink.trim());

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Video className="h-7 w-7 text-[hsl(174,62%,47%)]" />
        <div>
          <h1 className="text-2xl font-bold">Reuniões</h1>
          <p className="text-sm text-muted-foreground">Grave, transcreva e gere atas automáticas de reuniões do Google Meet</p>
        </div>
      </div>

      {/* Requirements notice */}
      <Alert className="border-white/10 bg-white/5">
        <Info className="h-4 w-4" />
        <AlertTitle>Requisitos para gerar atas automaticamente</AlertTitle>
        <AlertDescription className="text-muted-foreground space-y-1">
          <p>
            Sua conta Google precisa ter o plano <strong className="text-foreground">Google AI Pro</strong> (ou Google Workspace com Gemini) —
            o plano <strong className="text-foreground">Google One</strong> comum (só armazenamento) não inclui o Gemini no Meet e não vai funcionar.
          </p>
          <p>
            Em cada reunião, você (como organizador) precisa ativar manualmente <strong className="text-foreground">"Fazer anotações com o Gemini"</strong> e{" "}
            <strong className="text-foreground">"Transcrever a reunião"</strong> pelo menu de atividades do Google Meet — nós não entramos na chamada, só lemos
            o documento que o Gemini gera na sua Google Drive depois que a reunião termina.
          </p>
        </AlertDescription>
      </Alert>

      {/* Google connection status */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {isLoadingConnection ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão com o Google...
            </div>
          ) : googleConnection?.connected ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-emerald-400" />
                <span>
                  Conectado como <strong>{googleConnection.googleEmail}</strong>
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => disconnectGoogleMutation.mutate()}
                disabled={disconnectGoogleMutation.isPending}
                className="text-muted-foreground hover:text-red-400 text-xs"
              >
                <Unlink className="h-3.5 w-3.5 mr-1" /> Desconectar
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Conecte sua conta do Google (com o Gemini ativado no Meet) para gerar atas automaticamente.
              </div>
              <Button
                size="sm"
                onClick={() => connectGoogleMutation.mutate()}
                disabled={connectGoogleMutation.isPending}
                className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-black font-medium"
              >
                {connectGoogleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Conectar Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Register Meeting Card */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrar Reunião</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            <Input
              placeholder="Título da reunião (opcional)"
              value={meetTitle}
              onChange={(e) => setMeetTitle(e.target.value)}
              className="sm:w-64 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            <Button
              onClick={() => registerMeetingMutation.mutate()}
              disabled={!isValidLink || !googleConnection?.connected || registerMeetingMutation.isPending}
              className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-black font-medium"
            >
              {registerMeetingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Registrar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ative "Fazer anotações com o Gemini" e "Transcrever a reunião" no Google Meet. Cole aqui o link antes de começar (você precisa ser o organizador) — buscaremos a ata automaticamente no seu Google Drive assim que a reunião terminar.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Meetings List */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Histórico ({meetings.length})</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : meetings.length === 0 ? (
            <Card className="border-white/10 bg-white/5 p-6 text-center text-muted-foreground text-sm">
              Nenhuma reunião registrada ainda.
            </Card>
          ) : (
            meetings.map((m) => {
              const cfg = statusConfig[m.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              const isActive = selectedMeeting?.id === m.id;
              return (
                <Card
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className={`border-white/10 bg-white/5 cursor-pointer transition-colors hover:bg-white/10 ${isActive ? "ring-1 ring-[hsl(174,62%,47%)]" : ""}`}
                >
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1">{m.title || "Sem título"}</span>
                      <Badge className={`${cfg.color} text-[10px] shrink-0`}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${(m.status === "transcribing" || m.status === "summarizing") ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.meet_link}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Meeting Detail */}
        <div className="lg:col-span-2">
          {selectedMeeting ? (
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedMeeting.title || "Reunião"}</CardTitle>
                  <div className="flex items-center gap-2">
                    <AddToProjectMenu itemType="meeting" itemId={selectedMeeting.id} size="icon" />
                    {selectedMeeting.status === "done" && selectedMeeting.transcript && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => regenerateMutation.mutate(selectedMeeting.id)}
                        disabled={regenerateMutation.isPending}
                        className="border-white/10 text-xs"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                        Regenerar Ata
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(selectedMeeting.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedMeeting.error_message && (
                  <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 space-y-2">
                    <div>{selectedMeeting.error_message}</div>
                    {(selectedMeeting.error_message.toLowerCase().includes("google") || selectedMeeting.error_message.toLowerCase().includes("gemini") || selectedMeeting.error_message.toLowerCase().includes("drive")) && (
                      <ul className="list-disc pl-5 text-xs text-red-300/90 space-y-1">
                        <li>Confirme que "Fazer anotações com o Gemini" e "Transcrever a reunião" estavam ativados no Meet.</li>
                        <li>Você precisa ser o organizador da chamada — quem inicia o link, não apenas um convidado.</li>
                        <li>Verifique se sua conexão com o Google ainda está ativa (canto superior desta página).</li>
                      </ul>
                    )}
                  </div>
                )}

                {selectedMeeting.status === "pending" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Clock className="h-8 w-8 text-yellow-400" />
                    <p className="text-sm text-muted-foreground">Aguardando a ata do Gemini aparecer na sua Google Drive...</p>
                    <p className="text-xs text-muted-foreground">Isso costuma levar alguns minutos após o fim da reunião.</p>
                  </div>
                )}

                {selectedMeeting.status === "matched" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <FileSearch className="h-8 w-8 text-cyan-400" />
                    <p className="text-sm text-muted-foreground">Reunião localizada na sua Drive. Extraindo transcrição...</p>
                  </div>
                )}

                {(selectedMeeting.status === "transcribing" || selectedMeeting.status === "summarizing") && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <p className="text-sm text-muted-foreground">
                      {selectedMeeting.status === "transcribing" ? "Lendo o documento do Google Drive..." : "Gerando ata com IA..."}
                    </p>
                  </div>
                )}

                {selectedMeeting.status === "done" && (
                  <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="bg-white/5 border border-white/10">
                      <TabsTrigger value="summary">Ata</TabsTrigger>
                      <TabsTrigger value="transcript">Transcrição</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="mt-4">
                      <div className="flex justify-end mb-2">
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(selectedMeeting.summary)} className="text-xs">
                          <Copy className="h-3 w-3 mr-1" /> Copiar
                        </Button>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none bg-white/5 rounded-lg p-4 border border-white/10 max-h-[60vh] overflow-y-auto text-gray-100 prose-headings:text-white prose-strong:text-white prose-li:text-gray-200">
                        {selectedMeeting.summary ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedMeeting.summary}</ReactMarkdown>
                        ) : "Nenhuma ata disponível."}
                      </div>
                    </TabsContent>
                    <TabsContent value="transcript" className="mt-4">
                      <div className="flex justify-end mb-2">
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(selectedMeeting.transcript)} className="text-xs">
                          <Copy className="h-3 w-3 mr-1" /> Copiar
                        </Button>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10 max-h-[60vh] overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedMeeting.transcript || "Nenhuma transcrição disponível."}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/10 bg-white/5 flex items-center justify-center min-h-[300px]">
              <div className="text-center space-y-2">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Selecione uma reunião para ver detalhes</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
