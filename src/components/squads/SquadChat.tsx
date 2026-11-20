import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Loader2, Send, Settings2, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useChatActions, useChatMessages, useChatUsage, TEAM_THREAD, type ChatMessage } from "@/hooks/useSquadChat";
import { agentLook } from "@/lib/squadOffice";
import type { Squad, SquadAgent } from "@/hooks/useSquads";

const MAX_CHARS = 2000;

/** Valores de conversa são centavos: mostra mais casas quando o número é pequeno. */
function usd(n: number): string {
  const digits = n > 0 && n < 0.1 ? 4 : 2;
  return `US$ ${n.toFixed(digits).replace(".", ",")}`;
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const look = agentLook(name);
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ width: size, height: size, background: look.shirt }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Bubble({ m, agent }: { m: ChatMessage; agent?: SquadAgent }) {
  if (m.author === "system") {
    const cls = m.meta?.error ? "border-red-400/40 text-red-300" : m.meta?.cap ? "border-amber-400/40 text-amber-300" : "border-white/15 text-white/50";
    return <div className="flex justify-center"><span className={`rounded-full border border-dashed px-3 py-1 text-center text-xs ${cls}`}>{m.content}</span></div>;
  }
  if (m.author === "user") {
    const masked = (m.meta?.masked_pii?.length || m.meta?.masked_secrets?.length) as number | undefined;
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] space-y-1">
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-teal-600 px-3.5 py-2 text-sm text-white">{m.content}</div>
          {masked ? <div className="text-right text-[11px] text-amber-300/80">Dados pessoais ou segredos foram mascarados antes do envio ao modelo.</div> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <Avatar name={agent?.name || "?"} />
      <div className="min-w-0 max-w-[88%] space-y-1">
        <div className="text-xs text-white/50"><span className="font-semibold text-white/80">{agent?.name || "Agente"}</span>{agent ? ` · ${agent.role}` : ""}</div>
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white/10 px-3.5 py-2 text-sm text-white/90">{m.content}</div>
        <div className="font-mono text-[10px] text-white/30">{m.model ? `${m.model} · ` : ""}{usd(Number(m.cost_usd))}</div>
      </div>
    </div>
  );
}

export function SquadChat({ squad, agents }: { squad: Squad; agents: SquadAgent[] }) {
  const [thread, setThread] = useState<string>(TEAM_THREAD);
  const [text, setText] = useState("");
  const { data: all = [], isLoading } = useChatMessages(squad.id);
  const { data: usage } = useChatUsage(squad.id);
  const { send, setCap, clear } = useChatActions(squad.id);
  const endRef = useRef<HTMLDivElement>(null);
  const [capDraft, setCapDraft] = useState("");
  const [capOpen, setCapOpen] = useState(false);

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const messages = useMemo(() => all.filter((m) => m.thread === thread), [all, thread]);
  const current = thread === TEAM_THREAD ? null : agentById.get(thread) || null;
  const exceeded = usage?.state === "exceeded";

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, send.isPending, thread]);
  useEffect(() => { if (usage) setCapDraft(String(usage.capUsd)); }, [usage?.capUsd]);

  const submit = async () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setText("");
    try {
      await send.mutateAsync({ thread, text: t });
    } catch (e: any) {
      setText(t);
      toast.error(e.message || "Não foi possível enviar");
    }
  };

  const mention = (name: string) => setText((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}@${name} `);
  const saveCap = async () => {
    const n = Number(capDraft.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { toast.error("Informe um valor maior que zero"); return; }
    try { await setCap.mutateAsync(n); toast.success("Teto da conversa atualizado"); setCapOpen(false); }
    catch (e: any) { toast.error(e.message || "Não foi possível salvar"); }
  };
  const wipe = async () => {
    try { await clear.mutateAsync(thread); toast.success("Conversa apagada"); }
    catch (e: any) { toast.error(e.message || "Não foi possível apagar"); }
  };

  return (
    <div className="space-y-4">
      <div className="grid overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] md:grid-cols-[210px_minmax(0,1fr)]">
        {/* conversas */}
        <nav aria-label="Conversas do squad" className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
          <button type="button" onClick={() => setThread(TEAM_THREAD)} aria-pressed={thread === TEAM_THREAD}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${thread === TEAM_THREAD ? "bg-teal-500/20" : "hover:bg-white/5"}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-black"><Hash className="h-4 w-4" /></span>
            <span><span className="block font-semibold leading-tight">time</span><span className="hidden text-xs text-white/50 md:block">todos os agentes</span></span>
          </button>
          <div className="hidden px-2.5 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-white/40 md:block">Mensagem direta</div>
          {agents.map((a) => (
            <button key={a.id} type="button" onClick={() => setThread(a.id)} aria-pressed={thread === a.id}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${thread === a.id ? "bg-teal-500/20" : "hover:bg-white/5"}`}>
              <Avatar name={a.name} />
              <span><span className="block font-semibold leading-tight">{a.name}</span><span className="hidden text-xs text-white/50 md:block">{a.role}</span></span>
            </button>
          ))}
        </nav>

        {/* conversa */}
        <div className="flex min-h-[460px] min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <div>
              <div className="font-semibold">{current ? current.name : "#time"}</div>
              <div className="text-xs text-white/50">
                {current ? `${current.role} · mensagem direta` : "Escreva sem @ e o roteador escolhe quem responde; use @Nome para chamar alguém"}
              </div>
            </div>
            {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="gap-1.5 text-white/40 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /> Apagar conversa</Button></AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apagar esta conversa?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/60">As mensagens {current ? `com ${current.name}` : "do #time"} serão apagadas. O que está na memória do time não muda. Não dá para desfazer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/20 bg-transparent">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={wipe}>Apagar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4" style={{ maxHeight: "58vh" }} aria-live="polite">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
            ) : messages.length === 0 ? (
              <div className="mx-auto max-w-md space-y-2 py-10 text-center text-sm text-white/50">
                <p>{current ? `Pergunte, discorde ou peça uma opinião a ${current.name}.` : "Converse com o time sem abrir uma missão."}</p>
                <p className="text-xs text-white/35">Os agentes conhecem a memória do time e o resultado da última missão. Por enquanto eles só conversam: não alteram entregas.</p>
              </div>
            ) : (
              messages.map((m) => <Bubble key={m.id} m={m} agent={m.agent_id ? agentById.get(m.agent_id) : undefined} />)
            )}
            {send.isPending && (
              <div className="flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {current ? `${current.name} está escrevendo…` : "O time está pensando…"}</div>
            )}
            <div ref={endRef} />
          </div>

          <div className="space-y-2 border-t border-white/10 p-3">
            {thread === TEAM_THREAD && (
              <div className="flex flex-wrap gap-1.5">
                {agents.map((a) => (
                  <button key={a.id} type="button" onClick={() => mention(a.name)} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white/70 hover:border-teal-400/60">@{a.name}</button>
                ))}
              </div>
            )}
            {exceeded ? (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">O teto mensal da conversa foi atingido. Aumente o teto abaixo para continuar.</p>
            ) : (
              <div className="flex items-end gap-2">
                <Textarea value={text} maxLength={MAX_CHARS} rows={2} placeholder={current ? `Escreva para ${current.name}…` : "Escreva para o time… use @ para chamar alguém"}
                  aria-label="Mensagem" className="min-h-[44px] flex-1 resize-none bg-white/5 border-white/10"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
                <Button onClick={submit} disabled={!text.trim() || send.isPending} className="h-[44px] gap-1.5" aria-label="Enviar mensagem">
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* custo e teto */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-white/60">Conversa deste mês</span>
            <span className="font-mono text-xs text-white/70">{usage ? `${usd(usage.spentUsd)} de ${usd(usage.capUsd)}` : "…"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={usage?.pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do teto mensal da conversa">
            <div className={`h-full ${usage?.state === "exceeded" ? "bg-red-400" : usage?.state === "warn" ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${Math.max(usage?.pct ?? 0, usage?.spentUsd ? 2 : 0)}%` }} />
          </div>
        </div>
        <Popover open={capOpen} onOpenChange={setCapOpen}>
          <PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-1.5 border-white/20 bg-transparent"><Settings2 className="h-4 w-4" /> Ajustar teto</Button></PopoverTrigger>
          <PopoverContent className="w-72 space-y-3 border-white/10 bg-[hsl(220,25%,10%)] text-white">
            <p className="text-sm text-white/70">Teto mensal da conversa deste squad, em dólares. Fica separado do teto das missões.</p>
            <Input value={capDraft} inputMode="decimal" aria-label="Teto mensal em dólares" onChange={(e) => setCapDraft(e.target.value)} className="bg-white/5 border-white/10" />
            <Button size="sm" onClick={saveCap} disabled={setCap.isPending} className="w-full">Salvar teto</Button>
          </PopoverContent>
        </Popover>
        <p className="flex w-full items-start gap-1.5 text-xs text-white/40"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Cada resposta mostra o modelo e o custo. Aos 80% do teto aparece um aviso e aos 100% a conversa pausa até você aumentar o teto. A conversa usa as suas chaves de IA.</p>
      </div>
    </div>
  );
}
