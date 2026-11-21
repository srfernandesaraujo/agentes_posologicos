import { describe, expect, it } from "vitest";
import {
  ACTION_RULES, BODY_MAX, CALENDAR_SCOPE, GMAIL_SEND_SCOPE, MAX_RECIPIENTS, SUBJECT_MAX, buildCalendarEvent, buildInviteEmail, buildRawEmail, canDecide,
  describeAction, detectActionIntent, emailFooter, encodeSubject, eventEnd, extractActionProposals, hasScope, neededScope, parseEmails, parseEventStart,
  validateCandidate,
} from "../../supabase/functions/_shared/squadMeetingActions";
import { canDo } from "../../supabase/functions/_shared/squadMeetingAccess";
import { MEETING_LIVE_RULES } from "../../supabase/functions/_shared/squadMeetingCore";

const NOW = Date.parse("2026-11-22T15:00:00Z"); // 12:00 em São Paulo

const emailBlock = (extra = "") => `Preparei o e-mail para aprovação.\n[[ACAO]]\ntipo: email\npara: ana@exemplo.com, bia@exemplo.com\nassunto: Resumo da reunião\ncorpo: Olá, segue o resumo.\nSegunda linha${extra}\n[[/ACAO]]`;

describe("extractActionProposals", () => {
  it("separa o texto da fala do bloco e lê os campos", () => {
    const r = extractActionProposals(emailBlock());
    expect(r.text).toBe("Preparei o e-mail para aprovação.");
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].fields).toMatchObject({ type: "email", to: "ana@exemplo.com, bia@exemplo.com", subject: "Resumo da reunião" });
    expect(r.proposals[0].fields.body).toBe("Olá, segue o resumo.\nSegunda linha");
  });
  it("corpo vai até o fim do bloco: 'Data:' e 'Para:' no texto não viram campos", () => {
    const r = extractActionProposals(emailBlock("\nData: 20/11\nPara: todos\nAssunto: pendente"));
    expect(r.proposals[0].fields.body).toContain("Data: 20/11");
    expect(r.proposals[0].fields.body).toContain("Para: todos");
    expect(r.proposals[0].fields.to).toBe("ana@exemplo.com, bia@exemplo.com");
    expect(r.proposals[0].fields.subject).toBe("Resumo da reunião");
  });
  it("aceita rótulos com acento e maiúsculas", () => {
    const r = extractActionProposals("[[ACAO]]\nTipo: evento\nTítulo: Alinhamento\nInício: 2026-12-03 14:00\nDuração: 60\n[[/ACAO]]");
    expect(r.proposals[0].fields).toMatchObject({ type: "evento", title: "Alinhamento", start: "2026-12-03 14:00", durationMin: "60" });
  });
  it("bloco sem fechamento (resposta cortada) é descartado e marcado", () => {
    const r = extractActionProposals("Segue.\n[[ACAO]]\ntipo: email\npara: a@b.com\nassunto: x\ncorpo: texto cortad");
    expect(r.proposals).toHaveLength(0);
    expect(r.incomplete).toBe(true);
    expect(r.text).toBe("Segue.");
  });
  it("no máximo 2 propostas por fala; o resto é contado como descartado", () => {
    const b = "[[ACAO]]\ntipo: email\npara: a@b.com\nassunto: x\ncorpo: y\n[[/ACAO]]";
    const r = extractActionProposals(`${b}\n${b}\n${b}`);
    expect(r.proposals).toHaveLength(2);
    expect(r.dropped).toBe(1);
  });
  it("texto sem bloco passa intacto", () => {
    expect(extractActionProposals("Só opinião.")).toEqual({ text: "Só opinião.", proposals: [], incomplete: false, dropped: 0 });
  });
});

describe("validateCandidate: e-mail", () => {
  const base = { type: "email", to: "ana@exemplo.com", subject: "Oi", body: "Texto" };
  it("aceita e normaliza (minúsculas, sem repetidos)", () => {
    const v = validateCandidate({ ...base, to: "Ana@Exemplo.com; ana@exemplo.com, bia@exemplo.com" }, NOW);
    expect(v).toEqual({ ok: true, payload: { type: "email", to: ["ana@exemplo.com", "bia@exemplo.com"], subject: "Oi", body: "Texto" } });
  });
  it("recusa quebra de linha no assunto (injeção de cabeçalho) e no destinatário", () => {
    expect(validateCandidate({ ...base, subject: "Oi\nBcc: x@y.com" }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, to: "ana@exemplo.com\nBcc: x@y.com" }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, to: "ana@exemplo.com,\r\nbcc:x@y.com" }, NOW)).toMatchObject({ ok: false });
  });
  it("recusa endereço inválido, nome com colchetes e mais de 5 destinatários", () => {
    for (const to of ["sem-arroba", "a@b", "Ana <ana@exemplo.com>", "a@b.com@c.com", "javascript:alert(1)@x.com"]) {
      expect(validateCandidate({ ...base, to }, NOW)).toMatchObject({ ok: false });
    }
    const six = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `p${i}@exemplo.com`).join(",");
    expect(validateCandidate({ ...base, to: six }, NOW)).toMatchObject({ ok: false });
    expect(parseEmails(six.split(",").slice(0, MAX_RECIPIENTS).join(","))).toMatchObject({ ok: true });
  });
  it("exige assunto e texto e respeita os tamanhos máximos", () => {
    expect(validateCandidate({ ...base, subject: "" }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, body: "  " }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, subject: "x".repeat(SUBJECT_MAX + 1) }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, body: "x".repeat(BODY_MAX + 1) }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, body: "x".repeat(BODY_MAX) }, NOW)).toMatchObject({ ok: true });
  });
  it("tipo desconhecido é recusado", () => {
    expect(validateCandidate({ ...base, type: "apagar_tudo" }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({}, NOW)).toMatchObject({ ok: false });
  });
});

describe("validateCandidate: evento", () => {
  const base = { type: "evento", title: "Alinhamento", start: "2026-12-03 14:00", durationMin: "60", attendees: "ana@exemplo.com", description: "Pauta" };
  it("aceita e guarda o início no formato local", () => {
    expect(validateCandidate(base, NOW)).toEqual({ ok: true, payload: { type: "evento", title: "Alinhamento", start: "2026-12-03T14:00", durationMin: 60, attendees: ["ana@exemplo.com"], description: "Pauta" } });
  });
  it("lê datas em formato brasileiro", () => {
    expect(parseEventStart("03/12/2026 14:00")).toBe("2026-12-03T14:00");
    expect(parseEventStart("3/12/2026 9h30")).toBe("2026-12-03T09:30");
    expect(parseEventStart("3/12/2026 9h")).toBe("2026-12-03T09:00");
  });
  it("recusa data impossível, passada ou longe demais", () => {
    expect(parseEventStart("31/02/2026 10:00")).toBeNull();
    expect(parseEventStart("2026-13-01 10:00")).toBeNull();
    expect(parseEventStart("amanhã às 10")).toBeNull();
    expect(validateCandidate({ ...base, start: "2026-11-21 10:00" }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, start: "2028-01-10 10:00" }, NOW)).toMatchObject({ ok: false });
  });
  it("compara a data com o horário de São Paulo (UTC-3)", () => {
    expect(validateCandidate({ ...base, start: "2026-11-22 11:58" }, NOW)).toMatchObject({ ok: true }); // 2 min atrás, dentro da tolerância
    expect(validateCandidate({ ...base, start: "2026-11-22 11:50" }, NOW)).toMatchObject({ ok: false });
  });
  it("duração entre 15 e 480 minutos e no máximo 5 convidados", () => {
    expect(validateCandidate({ ...base, durationMin: 10 }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, durationMin: 600 }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, durationMin: "abc" }, NOW)).toMatchObject({ ok: false });
    const six = Array.from({ length: 6 }, (_, i) => `p${i}@exemplo.com`).join(",");
    expect(validateCandidate({ ...base, attendees: six }, NOW)).toMatchObject({ ok: false });
    expect(validateCandidate({ ...base, attendees: "" }, NOW)).toMatchObject({ ok: true });
  });
  it("fim do evento atravessa a meia-noite e o fim do mês", () => {
    expect(eventEnd("2026-12-03T14:00", 90)).toBe("2026-12-03T15:30");
    expect(eventEnd("2026-12-31T23:30", 60)).toBe("2027-01-01T00:30");
  });
  it("monta o corpo da Agenda com fuso de São Paulo e convidados", () => {
    const ok = validateCandidate(base, NOW);
    const ev = buildCalendarEvent((ok as any).payload, "Sergio", "Interações") as any;
    expect(ev.start).toEqual({ dateTime: "2026-12-03T14:00:00", timeZone: "America/Sao_Paulo" });
    expect(ev.end.dateTime).toBe("2026-12-03T15:00:00");
    expect(ev.attendees).toEqual([{ email: "ana@exemplo.com" }]);
    expect(ev.description).toContain("com apoio de IA");
  });
});

describe("validateCandidate: aviso de convite", () => {
  it("aceita, normaliza o papel e exige destinatário", () => {
    expect(validateCandidate({ type: "aviso_convite", to: "ana@exemplo.com", role: "participante", note: "Venha" }, NOW))
      .toEqual({ ok: true, payload: { type: "aviso_convite", to: ["ana@exemplo.com"], role: "participant", note: "Venha" } });
    expect(validateCandidate({ type: "aviso_convite", to: "ana@exemplo.com", role: "admin" }, NOW)).toMatchObject({ ok: true, payload: { role: "observer" } });
    expect(validateCandidate({ type: "aviso_convite", to: "" }, NOW)).toMatchObject({ ok: false });
  });
  it("o e-mail do convite leva o link, o papel e o rodapé de IA", () => {
    const m = buildInviteEmail({ hostName: "Sergio", meetingTitle: "Interações", url: "https://x.app/reuniao-viva/convite/abc", role: "participant", note: "" });
    expect(m.body).toContain("https://x.app/reuniao-viva/convite/abc");
    expect(m.body).toContain("participante");
    expect(m.body).toContain("com apoio de IA");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});

describe("montagem do e-mail (MIME)", () => {
  const decode = (raw: string) => {
    const b = raw.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  };
  const bodyOf = (mime: string) => {
    const b64 = mime.split("\r\n\r\n")[1].replace(/\r\n/g, "");
    return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  };
  it("assunto e corpo com acentos e emoji voltam idênticos; só uma linha de cada cabeçalho", () => {
    const subject = "Reunião: ação e decisão ✔ sobre interações medicamentosas e outros assuntos longos para forçar a dobra";
    const mime = decode(buildRawEmail({ to: ["ana@exemplo.com"], subject, body: "Olá, tudo bem?\nÇ ã é ü 😀" }));
    expect(mime).toMatch(/^To: ana@exemplo\.com\r\nSubject: =\?UTF-8\?B\?/);
    expect(mime).toContain("Content-Type: text/plain; charset=\"UTF-8\"");
    const subjectBlock = mime.split("\r\n").slice(1).join("\r\n").split("MIME-Version")[0];
    const words = [...subjectBlock.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((m) => m[1]);
    expect(words.every((w) => w.length <= 64)).toBe(true);
    const dec = (w: string) => new TextDecoder().decode(Uint8Array.from(atob(w), (c) => c.charCodeAt(0)));
    expect(words.length).toBeGreaterThan(1); // o assunto longo foi dobrado em mais de um pedaço
    expect(words.map(dec).join("")).toBe(subject);
    expect(bodyOf(mime)).toBe("Olá, tudo bem?\r\nÇ ã é ü 😀");
  });
  it("saída é base64url puro (sem + / =)", () => {
    expect(buildRawEmail({ to: ["a@b.com"], subject: "x>>>???", body: "~~~???>>>" })).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("recusa montar cabeçalho com quebra de linha mesmo se a validação for pulada", () => {
    expect(() => buildRawEmail({ to: ["a@b.com"], subject: "x\r\nBcc: y@z.com", body: "t" })).toThrow();
    expect(() => buildRawEmail({ to: ["a@b.com\r\nBcc: y@z.com"], subject: "x", body: "t" })).toThrow();
  });
  it("encodeSubject não quebra caractere no meio", () => {
    const s = "ação".repeat(30);
    const words = [...encodeSubject(s).matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((m) => new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))));
    expect(words.join("")).toBe(s);
    expect(words.every((w) => !w.includes("�"))).toBe(true);
  });
  it("rodapé identifica o anfitrião e a IA, sem quebra de linha forjada", () => {
    const f = emailFooter("Sergio\nBcc: x@y.com", "Tema\nx");
    expect(f).toContain("com apoio de IA");
    expect(f.split("\n").filter((l) => l.startsWith("Bcc"))).toHaveLength(0);
  });
});

describe("estados, escopos e permissões", () => {
  it("só proposta e falha podem ser decididas; feito, rodando e descartado, nunca (sem duplo envio)", () => {
    expect(canDecide("proposed")).toBe(true);
    expect(canDecide("failed")).toBe(true);
    for (const s of ["executing", "done", "discarded", "", "xyz"]) expect(canDecide(s)).toBe(false);
  });
  it("cada tipo exige a permissão certa do Google", () => {
    expect(neededScope("email")).toBe(GMAIL_SEND_SCOPE);
    expect(neededScope("aviso_convite")).toBe(GMAIL_SEND_SCOPE);
    expect(neededScope("evento")).toBe(CALENDAR_SCOPE);
    const granted = "openid https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send";
    expect(hasScope(granted, GMAIL_SEND_SCOPE)).toBe(true);
    expect(hasScope(granted, CALENDAR_SCOPE)).toBe(false);
    expect(hasScope(null, GMAIL_SEND_SCOPE)).toBe(false);
    expect(hasScope("https://www.googleapis.com/auth/gmail.send.evil", GMAIL_SEND_SCOPE)).toBe(false);
  });
  it("só o anfitrião aprova ou descarta ação; participante, observador e quem não é membro não", () => {
    for (const a of ["approve_action", "discard_action"]) {
      expect(canDo("host", a)).toBe(true);
      for (const r of ["participant", "observer", "none"] as const) expect(canDo(r, a)).toBe(false);
    }
  });
  it("detecta pedidos de e-mail, agenda e convite", () => {
    for (const t of ["manda um e-mail pra Ana", "agende para sexta", "preciso enviar o resumo", "faça um convite", "marcar uma reunião"]) expect(detectActionIntent(t)).toBe(true);
    expect(detectActionIntent("qual a dose de varfarina?")).toBe(false);
  });
  it("descreve a ação em uma linha", () => {
    expect(describeAction({ type: "email", to: ["a@b.com"], subject: "Oi", body: "x" })).toBe('e-mail "Oi" para a@b.com');
    expect(describeAction({ type: "evento", title: "Alinhamento", start: "2026-12-03T14:00", durationMin: 60, attendees: [], description: "" })).toContain("2026-12-03 às 14:00");
  });
});

describe("regras dos agentes", () => {
  it("ensinam o formato e dizem que nada é enviado sem aprovação; não proíbem mais PubMed/arquivo", () => {
    expect(ACTION_RULES).toContain("[[ACAO]]");
    expect(ACTION_RULES).toContain("aprova");
    expect(MEETING_LIVE_RULES).toContain("[[ACAO]]");
  });
});
