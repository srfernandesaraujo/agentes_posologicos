import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Megaphone, Sparkles, FileDown, Loader2, Bot, MessageCircleQuestion, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportConversationPdf } from "@/lib/exportConversationPdf";

interface RoomMessage {
  id: string;
  room_id: string;
  sender_name: string;
  sender_email: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  is_broadcast?: boolean;
  is_question?: boolean;
  is_anonymous?: boolean;
}

export default function LiveClass() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);
  const [broadcasts, setBroadcasts] = useState<RoomMessage[]>([]);
  const [questions, setQuestions] = useState<RoomMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: room, isLoading } = useQuery({
    queryKey: ["live-class-room", pin, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_rooms")
        .select("*")
        .eq("pin", pin!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!pin && !!user,
  });

  // Load all messages for owner
  useEffect(() => {
    if (!room?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });
      if (error) return;
      const all = (data || []) as any as RoomMessage[];
      setBroadcasts(all.filter((m) => m.is_broadcast));
      setQuestions(all.filter((m) => m.is_question));
    })();
  }, [room?.id]);

  // Realtime
  useEffect(() => {
    if (!room?.id) return;
    const ch = supabase
      .channel(`live-class-${room.id}`)
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (payload: any) => {
          const m = payload.new as RoomMessage;
          if (m.is_broadcast) setBroadcasts((p) => p.some((x) => x.id === m.id) ? p : [...p, m]);
          if (m.is_question) setQuestions((p) => p.some((x) => x.id === m.id) ? p : [...p, m]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room?.id]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [broadcasts.length]);

  const toggleLive = async (next: boolean) => {
    if (!room) return;
    const updates: any = { live_mode: next };
    if (!next) updates.current_broadcast_prompt = null;
    const { error } = await (supabase as any).from("virtual_rooms").update(updates).eq("id", room.id);
    if (error) return toast.error("Erro ao alterar modo");
    qc.invalidateQueries({ queryKey: ["live-class-room", pin] });
    toast.success(next ? "Modo Aula ao Vivo ativado" : "Modo Aula ao Vivo desativado");
  };

  const broadcastPrompt = async () => {
    if (!prompt.trim() || !room?.agent_id || sending) return;
    const text = prompt.trim();
    setPrompt("");
    setSending(true);
    try {
      // 1. Insert professor's broadcast prompt
      const { error: uErr } = await (supabase as any).from("room_messages").insert({
        room_id: room.id,
        sender_name: "Professor",
        sender_email: user?.email || "",
        role: "user",
        content: text,
        is_broadcast: true,
      });
      if (uErr) throw uErr;

      // 2. Call agent-chat (virtual room mode, no auth needed)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          agentId: room.agent_id,
          input: `[Professor]: ${text}`,
          isCustomAgent: true,
          isVirtualRoom: true,
          roomId: room.id,
          conversationHistory: broadcasts.slice(-6).map((m) => ({
            role: m.role,
            // Edge function rejects history items >10k chars; truncate aggressively
            content: (m.content || "").slice(0, 8000),
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Erro do agente");

      // 3. Insert assistant broadcast
      await (supabase as any).from("room_messages").insert({
        room_id: room.id,
        sender_name: "Assistente",
        sender_email: user?.email || "",
        role: "assistant",
        content: data?.output || "Sem resposta.",
        is_broadcast: true,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao transmitir");
    } finally {
      setSending(false);
    }
  };

  const aggregate = async () => {
    if (questions.length === 0) { toast.info("Nenhuma dúvida ainda."); return; }
    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("aggregate-questions", {
        body: { questions: questions.map((q) => q.content) },
      });
      if (error) throw error;
      setSummary(data?.summary || "Sem resumo.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao resumir");
    } finally {
      setSummarizing(false);
    }
  };

  const exportPdf = () => {
    if (broadcasts.length === 0) { toast.info("Nada para exportar ainda."); return; }
    exportConversationPdf(
      `Aula ao Vivo - ${room?.name || pin}`,
      broadcasts.map((m) => ({ role: m.role, content: m.content, created_at: m.created_at }))
    );
  };

  const shareUrl = useMemo(() => `${window.location.origin}/sala/${pin}`, [pin]);

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[hsl(220,25%,5%)]"><Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>;
  if (!room) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[hsl(220,25%,5%)] text-white">
      <p className="text-white/60">Sala não encontrada ou você não é o dono.</p>
      <Button variant="outline" onClick={() => navigate("/salas-virtuais")}>Voltar</Button>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-[hsl(220,25%,5%)] text-white">
      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/salas-virtuais")} className="text-white/50 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20"><Megaphone className="h-5 w-5 text-red-400" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-sm font-bold truncate">{room.name} — Painel do Professor</h1>
          <p className="text-xs text-white/40">PIN {room.pin} • Link: {shareUrl}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
            <span className="text-xs text-white/70">Aula ao Vivo</span>
            <Switch checked={!!room.live_mode} onCheckedChange={toggleLive} />
          </div>
          <Button onClick={exportPdf} variant="outline" size="sm" className="gap-2 border-white/20 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
            <FileDown className="h-4 w-4" /> Apostila PDF
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Broadcasts */}
        <div className="flex flex-1 flex-col">
          <ScrollArea className="flex-1 px-4 py-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {broadcasts.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-white/30">
                  <Bot className="h-12 w-12" />
                  <p className="text-center">Ative o modo "Aula ao Vivo" e envie um prompt para a turma.<br/>Todos verão a resposta sincronizada.</p>
                </div>
              )}
              {broadcasts.map((m) => (
                <div key={m.id} className={`rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "border border-red-400/30 bg-red-500/10" : "border border-white/10 bg-white/[0.05]"}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-white/40">
                    <Badge variant="outline" className="border-white/20 text-white/70">{m.role === "user" ? "Professor" : "Agente"}</Badge>
                    <span>{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-white/90">{m.content}</p>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-white/10 p-4">
            <div className="mx-auto flex max-w-3xl gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); broadcastPrompt(); } }}
                placeholder={room.live_mode ? "Digite o prompt que será transmitido para a turma..." : "Ative o modo Aula ao Vivo para transmitir."}
                rows={2}
                disabled={!room.live_mode || sending}
                className="resize-none border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
              />
              <Button
                onClick={broadcastPrompt}
                disabled={!room.live_mode || sending || !prompt.trim() || !room.agent_id}
                className="shrink-0 bg-red-500 text-white hover:bg-red-600 gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                Transmitir
              </Button>
            </div>
          </div>
        </div>

        {/* Questions sidebar */}
        <aside className="hidden w-80 flex-col border-l border-white/10 bg-white/[0.02] lg:flex">
          <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="h-4 w-4 text-[hsl(174,62%,47%)]" />
              <span className="text-sm font-medium">Dúvidas anônimas ({questions.length})</span>
            </div>
            <Button size="sm" variant="ghost" onClick={aggregate} disabled={summarizing} className="gap-1 text-xs text-white/70 hover:text-white">
              {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Resumir
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-3 p-3">
              {summary && (
                <div className="rounded-lg border border-[hsl(174,62%,47%)]/30 bg-[hsl(174,62%,47%)]/5 p-3 text-xs">
                  <p className="mb-1 flex items-center gap-1 text-[hsl(174,62%,47%)]"><Sparkles className="h-3 w-3" /> Resumo da IA</p>
                  <div className="prose prose-xs prose-invert max-w-none text-white/80">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                  </div>
                </div>
              )}
              {questions.length === 0 && <p className="px-2 py-8 text-center text-xs text-white/30">Nenhuma dúvida ainda.</p>}
              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80">
                  {q.content}
                  <p className="mt-1 text-[10px] text-white/30">{new Date(q.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}