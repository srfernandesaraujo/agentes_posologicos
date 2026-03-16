import { useState, useEffect } from "react";
import { Video, Send, RefreshCw, FileText, Copy, Clock, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  pending: { label: "Pendente", icon: Clock, color: "bg-yellow-500/20 text-yellow-400" },
  recording: { label: "Gravando", icon: Loader2, color: "bg-red-500/20 text-red-400" },
  transcribing: { label: "Transcrevendo", icon: Loader2, color: "bg-blue-500/20 text-blue-400" },
  summarizing: { label: "Gerando Ata", icon: Loader2, color: "bg-purple-500/20 text-purple-400" },
  done: { label: "Concluído", icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-400" },
  error: { label: "Erro", icon: AlertCircle, color: "bg-red-500/20 text-red-400" },
};

export default function Meetings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [meetLink, setMeetLink] = useState("");
  const [meetTitle, setMeetTitle] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

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

  const sendBotMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meeting-bot", {
        body: { meet_link: meetLink.trim(), title: meetTitle || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Bot enviado!", description: "O bot está entrando na reunião. Aceite-o no Google Meet." });
      setMeetLink("");
      setMeetTitle("");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      if (data?.meeting) setSelectedMeeting(data.meeting);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao enviar bot", description: e.message, variant: "destructive" });
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

      {/* Send Bot Card */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Enviar Bot para Reunião</CardTitle>
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
              onClick={() => sendBotMutation.mutate()}
              disabled={!isValidLink || sendBotMutation.isPending}
              className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-black font-medium"
            >
              {sendBotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar Bot
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole o link do Google Meet. O bot entrará como participante — o organizador precisa aceitá-lo rapidamente e, se o Meet solicitar, liberar a gravação.
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
                        <StatusIcon className={`h-3 w-3 mr-1 ${(m.status === "recording" || m.status === "transcribing" || m.status === "summarizing") ? "animate-spin" : ""}`} />
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
                  <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                    {selectedMeeting.error_message}
                  </div>
                )}

                {selectedMeeting.status === "recording" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-red-400" />
                    <p className="text-sm text-muted-foreground">Gravando reunião... Aguarde o encerramento.</p>
                    <p className="text-xs text-muted-foreground">O status será atualizado automaticamente.</p>
                  </div>
                )}

                {(selectedMeeting.status === "transcribing" || selectedMeeting.status === "summarizing") && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <p className="text-sm text-muted-foreground">
                      {selectedMeeting.status === "transcribing" ? "Transcrevendo áudio..." : "Gerando ata com IA..."}
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
                      <div className="prose prose-invert prose-sm max-w-none bg-white/5 rounded-lg p-4 border border-white/10 max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
                        {selectedMeeting.summary || "Nenhuma ata disponível."}
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

                {selectedMeeting.status === "pending" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Clock className="h-8 w-8 text-yellow-400" />
                    <p className="text-sm text-muted-foreground">Aguardando o bot entrar na reunião...</p>
                  </div>
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
