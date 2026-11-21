import { useState } from "react";
import { Copy, Link2, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROLE_LABEL, inviteUrl, useInviteActions, useMeetingPeople, type GuestRole } from "@/hooks/useMeetingGuests";

/** Convidar pessoas para a reunião ao vivo: gera links (participante ou observador), mostra quem entrou e permite remover. */
export function MeetingInviteButton({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useMeetingPeople(meetingId, open);
  const { create, revoke, remove } = useInviteActions(meetingId);
  // O link só aparece uma vez, logo depois de criado (no banco fica só o hash).
  const [fresh, setFresh] = useState<{ id: string; url: string; role: GuestRole } | null>(null);

  const make = async (role: GuestRole) => {
    try {
      const r = await create.mutateAsync(role);
      setFresh({ id: r.invite.id, url: inviteUrl(r.invite.token), role });
    } catch (e: any) { toast.error(e.message || "Não foi possível criar o link"); }
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    catch { toast.error("Não consegui copiar. Selecione o link e copie à mão."); }
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e.message || "Não foi possível concluir"); }
  };

  const members = data?.members || [];
  const invites = (data?.invites || []).filter((i) => i.id !== fresh?.id);

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 gap-1 border-white/20 bg-transparent text-xs" onClick={() => setOpen(true)}>
        <UserPlus className="h-3.5 w-3.5" /> Convidar{members.length ? ` (${members.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convidar para a reunião</DialogTitle>
            <DialogDescription>
              Quem abrir o link precisa ter conta no Posologia. Você paga o uso dos agentes com as suas chaves. O convidado vê só esta reunião.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5" disabled={create.isPending} onClick={() => make("participant")}>
                  {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Link de participante
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={create.isPending} onClick={() => make("observer")}>
                  <Link2 className="h-3.5 w-3.5" /> Link de observador
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Participante escreve e chama agentes. Observador só acompanha. Pauta, silêncio, arquivos e encerramento ficam só com você. Cada link vale 7 dias e até 5 convidados.</p>
            </div>

            {fresh && (
              <div className="space-y-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 p-3">
                <div className="text-xs font-semibold">Novo link de {ROLE_LABEL[fresh.role].toLowerCase()}. Copie agora: ele não aparece de novo.</div>
                <div className="flex gap-2">
                  <input readOnly value={fresh.url} aria-label="Link de convite" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded border bg-background px-2 py-1 font-mono text-xs" />
                  <Button size="sm" className="gap-1" onClick={() => copy(fresh.url)}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                </div>
              </div>
            )}

            {invites.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold">Links ativos</div>
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs">
                    <span>{ROLE_LABEL[i.role]} · vale até {new Date(i.expires_at).toLocaleDateString("pt-BR")}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={revoke.isPending} onClick={() => run(() => revoke.mutateAsync(i.id), "Link revogado")}>Revogar</Button>
                  </div>
                ))}
              </div>
            )}
            {fresh && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={revoke.isPending}
                onClick={() => run(async () => { await revoke.mutateAsync(fresh.id); setFresh(null); }, "Link revogado")}>Revogar o link novo</Button>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-semibold">Quem está na reunião</div>
              {members.length === 0 ? <p className="text-xs text-muted-foreground">Ninguém entrou ainda.</p> : members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs">
                  <span>{m.display_name} · {ROLE_LABEL[m.role]}</span>
                  <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs" disabled={remove.isPending} onClick={() => run(() => remove.mutateAsync(m.user_id), "Convidado removido")}><X className="h-3 w-3" /> Remover</Button>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">Quem você remove pode voltar enquanto tiver um link ativo. Revogue o link para impedir.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
