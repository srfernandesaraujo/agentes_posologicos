// Reunião Viva (Fase 3): convidados humanos. Lógica pura de acesso, sem banco nem rede, para poder ser testada.
// Modelo: o anfitrião (dono do squad) paga e usa as próprias chaves; o convidado entra por link, com conta, como
// "participante" (escreve e chama agentes) ou "observador" (só lê). O convidado nunca lê as tabelas direto: tudo passa pela
// função `squad-meeting`, que confere o papel a cada ação e devolve só campos seguros.

export type MeetingRole = "host" | "participant" | "observer" | "none";
export type InviteRole = "participant" | "observer";

export const MEETING_MAX_GUESTS = 5;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_NAME_MAX = 40;

/** Ações permitidas por papel. Qualquer ação fora da lista é recusada (lista de permissão, não de bloqueio). */
const ALLOWED: Record<MeetingRole, ReadonlySet<string>> = {
  host: new Set([
    "view", "say", "tick", "control", "end", "upload_file", "delete_file",
    "create_invite", "revoke_invite", "list_members", "remove_member",
  ]),
  participant: new Set(["view", "say", "leave"]),
  observer: new Set(["view", "leave"]),
  none: new Set(),
};

export function canDo(role: MeetingRole, action: string): boolean {
  return ALLOWED[role]?.has(action) ?? false;
}

export function resolveRole(userId: string, ownerId: string, members: { user_id: string; role: string }[]): MeetingRole {
  if (userId && userId === ownerId) return "host";
  const m = members.find((x) => x.user_id === userId);
  if (m?.role === "participant") return "participant";
  if (m?.role === "observer") return "observer";
  return "none";
}

/** Qualquer valor desconhecido vira observador: o papel mais fraco. */
export function normalizeInviteRole(v: unknown): InviteRole {
  return v === "participant" ? "participant" : "observer";
}

/** Token de convite: 32 bytes aleatórios em base64url. Só o hash fica no banco. */
export function newInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashInviteToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function looksLikeInviteToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{40,50}$/.test(v);
}

export interface InviteRow { meeting_id: string; role: string; revoked_at: string | null; expires_at: string }
export type InviteCheck = { ok: true; role: InviteRole } | { ok: false; status: number; code: string; message: string };

/** O convite vale? Mesma mensagem para inexistente, revogado e expirado: não ajuda quem testa tokens. */
export function checkInvite(inv: InviteRow | null | undefined, meeting: { id: string; status: string } | null | undefined, now: number): InviteCheck {
  const invalid: InviteCheck = { ok: false, status: 404, code: "invite_invalid", message: "Este convite não é válido ou expirou." };
  if (!inv || !meeting) return invalid;
  if (inv.meeting_id !== meeting.id) return invalid;
  if (inv.revoked_at) return invalid;
  if (new Date(inv.expires_at).getTime() <= now) return invalid;
  if (meeting.status !== "open") return { ok: false, status: 409, code: "meeting_ended", message: "Esta reunião já foi encerrada." };
  return { ok: true, role: normalizeInviteRole(inv.role) };
}

/** Quem já é membro sempre pode reentrar; novos convidados respeitam o limite. */
export function canAddGuest(currentGuests: number, alreadyMember: boolean): boolean {
  return alreadyMember || currentGuests < MEETING_MAX_GUESTS;
}

/** Nome mostrado na conversa e para os agentes. Sem colchetes nem quebra de linha: não dá para forjar "[Helena]: ..." no texto da conversa. */
export function guestDisplayName(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const t = c.replace(/[\[\]\r\n\t:<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, GUEST_NAME_MAX).trim();
    if (t.length >= 2) return t;
  }
  return "Convidado";
}

/** Campos de uma mensagem que o convidado pode ver (sem custo, modelo, provedor, tokens nem dados internos). */
export function guestSafeMessage<T extends Record<string, any>>(m: T, viewerId: string) {
  const mt = (m.meta?.meeting || {}) as Record<string, any>;
  return {
    id: m.id, author: m.author, agent_id: m.agent_id ?? null, content: m.content, created_at: m.created_at,
    meta: {
      ...(m.meta?.minutes_doc ? { minutes_doc: m.meta.minutes_doc } : {}),
      ...(m.meta?.sources ? { sources: m.meta.sources } : {}),
      ...(m.meta?.calc ? { calc: m.meta.calc } : {}),
      meeting: {
        ...(mt.tool ? { tool: mt.tool } : {}), ...(mt.minutes ? { minutes: true } : {}), ...(mt.file ? { file: mt.file } : {}),
        ...(mt.author_name ? { author_name: mt.author_name } : {}), ...(mt.author_role ? { author_role: mt.author_role } : {}),
        ...(mt.author_id && mt.author_id === viewerId ? { mine: true } : {}),
      },
    },
  };
}
