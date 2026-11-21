// Reunião Viva (Fase 4): ações propostas pelos agentes e aprovadas pelo anfitrião num cartão. Lógica pura, sem banco nem rede.
// O agente só PROPÕE (bloco [[ACAO]]...[[/ACAO]] no fim da fala). O servidor valida por código, guarda a proposta e só executa
// (Gmail, Agenda) depois que o anfitrião aprova, com a conta Google dele. O texto vindo de arquivos ou da conversa é dado, nunca ordem.

export type ActionType = "email" | "evento" | "aviso_convite";
export type ActionStatus = "proposed" | "executing" | "done" | "failed" | "discarded";

export const MAX_RECIPIENTS = 5;
export const MAX_ACTIONS_PER_MEETING = 10;
export const MAX_PROPOSALS_PER_MESSAGE = 2;
export const SUBJECT_MAX = 150;
export const BODY_MAX = 5000;
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1500;
export const NOTE_MAX = 500;
export const EVENT_TZ = "America/Sao_Paulo";
/** São Paulo não tem horário de verão desde 2019: UTC-3 o ano todo. */
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface EmailPayload { type: "email"; to: string[]; subject: string; body: string }
export interface EventPayload { type: "evento"; title: string; start: string; durationMin: number; attendees: string[]; description: string }
export interface InvitePayload { type: "aviso_convite"; to: string[]; role: "participant" | "observer"; note: string }
export type ActionPayload = EmailPayload | EventPayload | InvitePayload;
export type Validation = { ok: true; payload: ActionPayload } | { ok: false; reason: string };

// ---------- o que o agente escreve ----------

/** O pedido do dono fala de e-mail, agenda ou convite? Dá mais espaço de resposta ao agente (o corpo do e-mail não cabe em 90 palavras). */
export function detectActionIntent(text: string): boolean {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /(e-?mail|enviar|envie|mande|manda|agenda|agendar|agende|marcar|marque|evento|convite|convidar|lembrete|avisar|avise)/.test(t);
}

export const ACTION_RULES =
  "AÇÕES (opcional): você pode PROPOR um e-mail, um evento na agenda ou um convite para a reunião, mas só quando o dono pedir ou quando a reunião combinar isso. " +
  "Nada é enviado por você: o dono revisa e aprova num cartão. Proponha com um bloco no FIM da fala (máx. 1 por fala), sem inventar endereços (use só e-mails que o dono ou a conversa citaram):\n" +
  "[[ACAO]]\ntipo: email\npara: pessoa@exemplo.com\nassunto: ...\ncorpo: ...\n[[/ACAO]]\n" +
  "[[ACAO]]\ntipo: evento\ntitulo: ...\ninicio: 2026-12-03 14:00\nduracao: 60\nconvidados: pessoa@exemplo.com\ndescricao: ...\n[[/ACAO]]\n" +
  "[[ACAO]]\ntipo: aviso_convite\npara: pessoa@exemplo.com\npapel: participante\nnota: ...\n[[/ACAO]]\n" +
  "Fora do bloco, diga em uma frase o que preparou e que depende da aprovação. Nunca diga que já enviou.";

const KEY_ALIASES: Record<string, string> = {
  tipo: "type", para: "to", destinatarios: "to", destinatario: "to", assunto: "subject", corpo: "body", texto: "body", mensagem: "body",
  titulo: "title", inicio: "start", data: "start", duracao: "durationMin", convidados: "attendees", descricao: "description", papel: "role", nota: "note",
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const MULTILINE = new Set(["body", "description", "note"]);

export interface RawProposal { fields: Record<string, string> }
export interface Extracted { text: string; proposals: RawProposal[]; incomplete: boolean; dropped: number }

function parseFields(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let current: string | null = null;
  for (const line of block.replace(/\r/g, "").split("\n")) {
    const m = line.match(/^\s*([A-Za-zÀ-ÿ_]{2,20})\s*:\s?(.*)$/);
    const key = m ? KEY_ALIASES[norm(m[1])] : undefined;
    // Campo de várias linhas (corpo, descrição, nota) vai até o fim do bloco: linhas como "Data: 20/11" dentro do texto não viram campo novo.
    if (m && key && !(current && MULTILINE.has(current))) {
      current = key;
      fields[key] = m[2];
    } else if (current) {
      // Continuação do campo anterior. Em campos de uma linha, a quebra fica no texto e a validação recusa (evita "Bcc:" escondido no assunto).
      fields[current] += "\n" + line;
    }
  }
  for (const k of Object.keys(fields)) fields[k] = MULTILINE.has(k) ? fields[k].replace(/\s+$/g, "") : fields[k].replace(/[ \t]+$/g, "").replace(/\n+$/g, "");
  return fields;
}

/** Tira os blocos [[ACAO]] do texto da fala e devolve as propostas cruas. Bloco sem fechamento (resposta cortada) é descartado e marcado. */
export function extractActionProposals(text: string): Extracted {
  const proposals: RawProposal[] = [];
  let dropped = 0;
  let out = String(text || "").replace(/\[\[ACAO\]\]([\s\S]*?)\[\[\/ACAO\]\]/gi, (_all, inner: string) => {
    if (proposals.length < MAX_PROPOSALS_PER_MESSAGE) proposals.push({ fields: parseFields(inner) });
    else dropped++;
    return "";
  });
  let incomplete = false;
  const open = out.search(/\[\[ACAO\]\]/i);
  if (open >= 0) { incomplete = true; out = out.slice(0, open); }
  return { text: out.replace(/\n{3,}/g, "\n\n").trim(), proposals, incomplete, dropped };
}

// ---------- validação ----------

const hasLineBreak = (s: string) => new RegExp("[\r\n\u2028\u2029]").test(s);
const EMAIL_RE = /^[^\s@<>",;()\[\]\\:]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Lista de e-mails separados por vírgula, ponto e vírgula ou espaço. Recusa "Nome <a@b.com>" e qualquer coisa que não seja um endereço simples. */
export function parseEmails(value: unknown, max = MAX_RECIPIENTS): { ok: true; list: string[] } | { ok: false; reason: string } {
  const raw = Array.isArray(value) ? value.map(String).join(",") : String(value ?? "");
  if (hasLineBreak(raw.trim())) return { ok: false, reason: "os endereços de e-mail não podem ter quebra de linha" };
  const parts = raw.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const list: string[] = [];
  for (const p of parts) {
    const e = p.toLowerCase();
    if (e.length > 254 || !EMAIL_RE.test(e)) return { ok: false, reason: `endereço de e-mail inválido: ${p.slice(0, 60)}` };
    if (!list.includes(e)) list.push(e);
  }
  if (list.length > max) return { ok: false, reason: `no máximo ${max} destinatários` };
  return { ok: true, list };
}

/** "2026-12-03 14:00", "2026-12-03T14:00", "03/12/2026 14:00" ou "03/12/2026 14h30" → "2026-12-03T14:00" (horário de São Paulo). */
export function parseEventStart(value: unknown): string | null {
  const s = String(value ?? "").trim();
  let y: number, mo: number, d: number, h: number, mi: number;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +m[4]; mi = +m[5]; }
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::|h)(\d{2})?$/i);
    if (!m) return null;
    d = +m[1]; mo = +m[2]; y = +m[3]; h = +m[4]; mi = m[5] ? +m[5] : 0;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null; // 31/02 etc.
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p2(mo)}-${p2(d)}T${p2(h)}:${p2(mi)}`;
}

const startToUtcMs = (local: string) => {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)!;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + SP_OFFSET_MS;
};

/** Fim do evento, no mesmo formato do início. */
export function eventEnd(start: string, durationMin: number): string {
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)!;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + durationMin * 60_000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}T${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`;
}

const clean = (v: unknown) => String(v ?? "").replace(/\u0000/g, "").trim();
const fail = (reason: string): Validation => ({ ok: false, reason });

/** Valida os campos (do agente ou editados pelo anfitrião) e devolve o conteúdo normalizado. */
export function validateCandidate(c: Record<string, unknown>, now: number): Validation {
  const type = norm(clean(c.type)).replace(/[^a-z_]/g, "");
  if (type === "email" || type === "e_mail") {
    const to = parseEmails(c.to);
    if ("reason" in to) return fail(to.reason);
    if (!to.list.length) return fail("falta o destinatário do e-mail");
    const subject = clean(c.subject);
    if (!subject) return fail("falta o assunto");
    if (hasLineBreak(subject)) return fail("o assunto não pode ter quebra de linha");
    if (subject.length > SUBJECT_MAX) return fail(`o assunto passa de ${SUBJECT_MAX} caracteres`);
    const body = clean(c.body);
    if (!body) return fail("falta o texto do e-mail");
    if (body.length > BODY_MAX) return fail(`o texto passa de ${BODY_MAX} caracteres`);
    return { ok: true, payload: { type: "email", to: to.list, subject, body } };
  }
  if (type === "evento") {
    const title = clean(c.title);
    if (!title) return fail("falta o título do evento");
    if (hasLineBreak(title) || title.length > TITLE_MAX) return fail(`o título deve ter uma linha e até ${TITLE_MAX} caracteres`);
    const start = parseEventStart(c.start);
    if (!start) return fail("data e hora inválidas (use, por exemplo, 2026-12-03 14:00)");
    const ms = startToUtcMs(start);
    if (ms < now - 5 * 60_000) return fail("a data do evento já passou");
    if (ms > now + 400 * 24 * 3600_000) return fail("a data do evento está longe demais (máximo de um ano)");
    const dur = Math.round(Number(String(c.durationMin ?? "").replace(/[^\d.]/g, "")));
    if (!Number.isFinite(dur) || dur < 15 || dur > 480) return fail("a duração deve ficar entre 15 e 480 minutos");
    const at = parseEmails(c.attendees);
    if ("reason" in at) return fail(at.reason);
    const description = clean(c.description);
    if (description.length > DESCRIPTION_MAX) return fail(`a descrição passa de ${DESCRIPTION_MAX} caracteres`);
    return { ok: true, payload: { type: "evento", title, start, durationMin: dur, attendees: at.list, description } };
  }
  if (type === "aviso_convite" || type === "convite") {
    const to = parseEmails(c.to);
    if ("reason" in to) return fail(to.reason);
    if (!to.list.length) return fail("falta o e-mail de quem vai receber o convite");
    const role = /participante|participant/.test(norm(clean(c.role))) ? "participant" : "observer";
    const note = clean(c.note);
    if (note.length > NOTE_MAX) return fail(`a nota passa de ${NOTE_MAX} caracteres`);
    return { ok: true, payload: { type: "aviso_convite", to: to.list, role, note } };
  }
  return fail("tipo de ação desconhecido (use email, evento ou aviso_convite)");
}

// ---------- montagem do que será enviado ----------

const b64 = (bytes: Uint8Array) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const toB64Url = (s: string) => b64(new TextEncoder().encode(s)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Assunto em "encoded-word" UTF-8 (RFC 2047), dobrado em pedaços de até 45 bytes sem quebrar caractere. */
export function encodeSubject(subject: string): string {
  const enc = new TextEncoder();
  const words: string[] = [];
  let chunk = "";
  for (const ch of subject) {
    if (enc.encode(chunk + ch).length > 45) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64(enc.encode(w))}?=`).join("\r\n ");
}

/** Mensagem RFC 2822 em base64url, no formato que a API do Gmail espera. O remetente é a conta autenticada. */
export function buildRawEmail(p: { to: string[]; subject: string; body: string }): string {
  if (hasLineBreak(p.subject) || p.to.some((e) => hasLineBreak(e) || !EMAIL_RE.test(e))) throw new Error("Cabeçalho de e-mail inválido");
  const body = b64(new TextEncoder().encode(p.body.replace(/\r?\n/g, "\r\n"))).replace(/(.{76})/g, "$1\r\n");
  const msg = `To: ${p.to.join(", ")}\r\nSubject: ${encodeSubject(p.subject)}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${body}`;
  return toB64Url(msg);
}

export function emailFooter(hostName: string, meetingTitle: string): string {
  const who = hostName.replace(/[\r\n]+/g, " ").slice(0, 60) || "o anfitrião";
  return `\n\n--\nEnviado por ${who} com apoio de IA, a partir da reunião "${meetingTitle.replace(/[\r\n]+/g, " ").slice(0, 100)}".`;
}

export function buildInviteEmail(p: { hostName: string; meetingTitle: string; url: string; role: "participant" | "observer"; note: string }): { subject: string; body: string } {
  const papel = p.role === "participant" ? "participante (você poderá escrever e chamar os agentes)" : "observador (você acompanha a conversa)";
  const subject = `Convite para a reunião: ${p.meetingTitle}`.slice(0, SUBJECT_MAX).replace(/[\r\n]+/g, " ");
  const body = `Olá!\n\n${p.note ? p.note + "\n\n" : ""}Você foi convidado(a) para a reunião "${p.meetingTitle}" como ${papel}.\n\nEntre por este link (é preciso ter conta no Posologia; o link vale por 7 dias):\n${p.url}`;
  return { subject, body: body + emailFooter(p.hostName, p.meetingTitle) };
}

/** Corpo da chamada events.insert da Google Agenda. `sendUpdates=all` avisa os convidados por e-mail. */
export function buildCalendarEvent(p: EventPayload, hostName: string, meetingTitle: string): Record<string, unknown> {
  return {
    summary: p.title,
    description: (p.description ? p.description + "\n\n" : "") + `Criado por ${hostName.replace(/[\r\n]+/g, " ").slice(0, 60) || "o anfitrião"} com apoio de IA, a partir da reunião "${meetingTitle.slice(0, 100)}".`,
    start: { dateTime: `${p.start}:00`, timeZone: EVENT_TZ },
    end: { dateTime: `${eventEnd(p.start, p.durationMin)}:00`, timeZone: EVENT_TZ },
    attendees: p.attendees.map((email) => ({ email })),
  };
}

// ---------- estados e permissões ----------

/** Só proposta nova ou falha (para tentar de novo) pode ser aprovada ou descartada. Nunca o que já foi feito ou está rodando. */
export const canDecide = (status: string): boolean => status === "proposed" || status === "failed";

export function neededScope(type: ActionType): string {
  return type === "evento" ? CALENDAR_SCOPE : GMAIL_SEND_SCOPE;
}

export function hasScope(granted: string | null | undefined, needed: string): boolean {
  return String(granted || "").split(/\s+/).includes(needed);
}

/** Resumo de uma linha da ação, para o aviso na conversa. */
export function describeAction(p: ActionPayload): string {
  if (p.type === "email") return `e-mail "${p.subject}" para ${p.to.join(", ")}`;
  if (p.type === "evento") return `evento "${p.title}" em ${p.start.replace("T", " às ")}`;
  return `convite para a reunião, enviado a ${p.to.join(", ")}`;
}
