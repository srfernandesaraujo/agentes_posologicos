import { useEffect, useState } from "react";
import { Archive, Check, Loader2, Pencil, Pin, PinOff, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSquadActions, useSquadMemories, type MemoryKind, type Squad, type SquadMemory } from "@/hooks/useSquads";

const KIND_LABEL: Record<MemoryKind, string> = {
  preference: "Preferência",
  correction: "Evitar",
  decision: "Decisão",
  fact: "Fato",
};
const CONTEXT_LIMIT = 20;
const MAX = 300;

function KindBadge({ kind }: { kind: MemoryKind }) {
  return <Badge variant="outline" className="shrink-0 border-white/20 text-xs text-white/70">{KIND_LABEL[kind]}</Badge>;
}

/** Item com edição em linha: o mesmo campo serve para sugestões e itens ativos. */
function MemoryRow({ item, squadId, mode }: { item: SquadMemory; squadId: string; mode: "suggested" | "active" | "archived" }) {
  const { updateMemoryItem } = useSquadActions();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.content);
  useEffect(() => setText(item.content), [item.content]);

  const run = async (patch: { content?: string; pinned?: boolean; status?: "active" | "archived" }, ok?: string) => {
    try {
      await updateMemoryItem.mutateAsync({ squadId, memoryId: item.id, ...patch });
      if (ok) toast.success(ok);
      setEditing(false);
    } catch (e: any) { toast.error(e.message || "Não foi possível salvar"); }
  };
  const busy = updateMemoryItem.isPending;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <KindBadge kind={item.kind} />
        {editing ? (
          <Input value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} aria-label="Texto do item" className="h-8 flex-1 bg-white/5 border-white/10" />
        ) : (
          <p className="min-w-0 flex-1 break-words text-sm text-white/90">{item.pinned && <Pin className="mr-1 inline h-3 w-3 text-amber-300" aria-label="Fixado" />}{item.content}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1">
        {editing ? (
          <>
            <Button size="sm" className="h-8 gap-1" disabled={busy || text.trim().length < 3} onClick={() => run({ content: text, ...(mode === "suggested" ? { status: "active" as const } : {}) }, mode === "suggested" ? "Guardado na memória" : "Item atualizado")}>
              <Check className="h-3.5 w-3.5" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setText(item.content); setEditing(false); }}>Cancelar</Button>
          </>
        ) : mode === "suggested" ? (
          <>
            <Button size="sm" className="h-8 gap-1" disabled={busy} onClick={() => run({ status: "active" }, "Guardado na memória")}><Check className="h-3.5 w-3.5" /> Guardar</Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={busy} onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-white/60" disabled={busy} onClick={() => run({ status: "archived" })}><X className="h-3.5 w-3.5" /> Descartar</Button>
          </>
        ) : mode === "active" ? (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} aria-label={item.pinned ? "Desafixar" : "Fixar"} title={item.pinned ? "Desafixar" : "Fixar (sempre entra no contexto)"} onClick={() => run({ pinned: !item.pinned })}>
              {item.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} aria-label="Editar" title="Editar" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} aria-label="Arquivar" title="Arquivar" onClick={() => run({ status: "archived" })}><Archive className="h-4 w-4" /></Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={busy} onClick={() => run({ status: "active" }, "Item restaurado")}><RotateCcw className="h-3.5 w-3.5" /> Restaurar</Button>
        )}
      </div>
    </div>
  );
}

export function MemoryPanel({ squad }: { squad: Squad }) {
  const { data: items = [], isLoading } = useSquadMemories(squad.id);
  const { addMemory, updateMemory } = useSquadActions();
  const [notes, setNotes] = useState(squad.memory || "");
  const [newText, setNewText] = useState("");
  const [newKind, setNewKind] = useState<MemoryKind>("preference");
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => setNotes(squad.memory || ""), [squad.id, squad.memory]);

  const suggested = items.filter((m) => m.status === "suggested");
  const active = items.filter((m) => m.status === "active").sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const archived = items.filter((m) => m.status === "archived");

  const add = async () => {
    try {
      await addMemory.mutateAsync({ squadId: squad.id, content: newText, kind: newKind });
      setNewText("");
      toast.success("Item adicionado à memória");
    } catch (e: any) { toast.error(e.message || "Não foi possível adicionar"); }
  };
  const saveNotes = async () => {
    try { await updateMemory.mutateAsync({ squadId: squad.id, memory: notes }); toast.success("Notas salvas"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-white/60">
        O squad aprende com os ajustes que você pede e com as perguntas que você responde. Ele só sugere: nada entra na memória sem a sua confirmação.
        Os itens ativos são entregues a todos os agentes em cada missão (até {CONTEXT_LIMIT}, fixados primeiro).
      </p>

      {suggested.length > 0 && (
        <section aria-label="Sugestões do squad" className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-300"><Sparkles className="h-4 w-4" /> O squad aprendeu isto. Guardar? ({suggested.length})</h3>
          {suggested.map((m) => <MemoryRow key={m.id} item={m} squadId={squad.id} mode="suggested" />)}
        </section>
      )}

      <section aria-label="Memória ativa" className="space-y-2">
        <h3 className="text-sm font-semibold">Memória ativa ({active.length}{active.length > CONTEXT_LIMIT ? `, ${CONTEXT_LIMIT} entram no contexto` : ""})</h3>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/50">
            Ainda não há itens. Peça ajustes em uma entrega ou responda uma pergunta do squad, e as sugestões aparecem aqui. Você também pode adicionar um item abaixo.
          </p>
        ) : active.map((m) => <MemoryRow key={m.id} item={m} squadId={squad.id} mode="active" />)}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Select value={newKind} onValueChange={(v) => setNewKind(v as MemoryKind)}>
            <SelectTrigger className="h-9 sm:w-40 bg-white/5 border-white/10" aria-label="Tipo do item"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(KIND_LABEL) as MemoryKind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={newText} maxLength={MAX} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newText.trim().length >= 3) add(); }}
            placeholder="Ex.: Fechamento com no máximo 4 frases" aria-label="Novo item da memória" className="h-9 flex-1 bg-white/5 border-white/10" />
          <Button onClick={add} disabled={addMemory.isPending || newText.trim().length < 3} className="h-9">
            {addMemory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
          </Button>
        </div>
      </section>

      {archived.length > 0 && (
        <section aria-label="Itens arquivados" className="space-y-2">
          <button className="text-sm text-white/50 underline-offset-2 hover:underline" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Ocultar" : "Mostrar"} arquivados ({archived.length})
          </button>
          {showArchived && archived.map((m) => <MemoryRow key={m.id} item={m} squadId={squad.id} mode="archived" />)}
        </section>
      )}

      <section aria-label="Notas livres" className="space-y-2 border-t border-white/10 pt-6">
        <h3 className="text-sm font-semibold">Notas livres do dono</h3>
        <p className="text-xs text-white/50">Texto longo e fixo (tom de voz, termos a evitar, contexto). Também é entregue a todos os agentes.</p>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={6000}
          placeholder="Ex.: Sempre usar tom didático e frases curtas. Nunca prometer cura. Citar a diretriz usada." className="min-h-[140px] bg-white/5 border-white/10" />
        <div className="flex items-center gap-3">
          <Button onClick={saveNotes} disabled={updateMemory.isPending || notes === (squad.memory || "")} className="gap-2">
            {updateMemory.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar notas
          </Button>
          <span className="text-xs text-white/40">{notes.length} / 6000</span>
        </div>
      </section>
    </div>
  );
}
