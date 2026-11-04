import { describe, it, expect } from "vitest";
import {
  planTasks, pickNextTask, pickReadyTasks, budgetState, clampCap, maskPii, screenInput, buildTaskUserMessage,
  checkForm, formDisplay, isScheduleDue, monthStartIso, buildRevisionInstructions,
  measureScript, parseDurationLimitSeconds, parseDurationRange, durationNote, reviewRequestsAdjustments,
  extractOwnerQuestion, buildOwnerRules,
  type SquadTemplate, type TaskLite,
} from "../../supabase/functions/_shared/squadCore";
import { TEMPLATE_CONTEUDO_YOUTUBE, getTemplate, listTemplates } from "../../supabase/functions/_shared/squadTemplates";

describe("planTasks", () => {
  it("gera um pipeline sequencial a partir do template de Conteúdo", () => {
    const tasks = planTasks(TEMPLATE_CONTEUDO_YOUTUBE);
    expect(tasks).toHaveLength(7);
    expect(tasks[0].dependsOnPosition).toBeNull();
    // Caio (2) e Íris (3) rodam em paralelo, ambos depois do roteiro (1); o parecer (4) espera os dois.
    expect(tasks.map((t) => t.dependsOnPositions)).toEqual([[], [0], [1], [1], [2, 3], [4], [5]]);
    expect(tasks.filter((t) => t.deliverable?.final)).toHaveLength(1);
    expect(tasks[tasks.length - 1].deliverable?.final).toBe(true);
  });

  it("rejeita etapa com agente inexistente", () => {
    const bad: SquadTemplate = { ...TEMPLATE_CONTEUDO_YOUTUBE, steps: [{ agent: "fantasma", title: "x", instructions: "y" }] };
    expect(() => planTasks(bad)).toThrow(/fantasma/);
  });

  it("todo template registrado tem agentes e etapas consistentes", () => {
    const t = getTemplate("conteudo-youtube")!;
    expect(() => planTasks(t)).not.toThrow();
    expect(t.maxCapUsd).toBeGreaterThanOrEqual(t.defaultCapUsd);
    expect(getTemplate("nao-existe")).toBeNull();
  });
});

describe("pickNextTask", () => {
  const t = (position: number, status: TaskLite["status"]): TaskLite => ({
    id: `t${position}`, position, status, depends_on_position: position === 0 ? null : position - 1,
  });
  it("começa pela primeira tarefa pendente", () => {
    const r = pickNextTask([t(0, "pending"), t(1, "pending")]);
    expect(r).toEqual({ kind: "task", task: expect.objectContaining({ id: "t0" }) });
  });
  it("só libera a tarefa cuja dependência terminou", () => {
    const r = pickNextTask([t(0, "done"), t(1, "pending"), t(2, "pending")]);
    expect(r).toEqual({ kind: "task", task: expect.objectContaining({ id: "t1" }) });
  });
  it("não inicia outra enquanto uma está rodando", () => {
    expect(pickNextTask([t(0, "done"), t(1, "running"), t(2, "pending")]).kind).toBe("busy");
  });
  it("sinaliza falha e conclusão", () => {
    expect(pickNextTask([t(0, "done"), t(1, "failed")]).kind).toBe("failed");
    expect(pickNextTask([t(0, "done"), t(1, "done")]).kind).toBe("finished");
  });
});

describe("paralelismo", () => {
  const mk = (position: number, status: TaskLite["status"], deps: number[]): TaskLite => ({
    id: `t${position}`, position, status, depends_on_position: deps[0] ?? null, depends_on_positions: deps,
  });
  const graph = (st: TaskLite["status"][]) => [mk(0, st[0], []), mk(1, st[1], [0]), mk(2, st[2], [0]), mk(3, st[3], [1, 2])];

  it("libera as duas irmãs ao mesmo tempo quando a dependência comum termina", () => {
    const r = pickReadyTasks(graph(["done", "pending", "pending", "pending"]));
    expect(r.kind).toBe("tasks");
    expect(r.kind === "tasks" && r.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });
  it("uma irmã rodando não impede de iniciar a outra", () => {
    const r = pickReadyTasks(graph(["done", "running", "pending", "pending"]));
    expect(r.kind === "tasks" && r.tasks.map((t) => t.id)).toEqual(["t2"]);
  });
  it("a etapa seguinte só sai quando TODAS as irmãs terminaram", () => {
    expect(pickReadyTasks(graph(["done", "done", "running", "pending"])).kind).toBe("busy");
    const r = pickReadyTasks(graph(["done", "done", "done", "pending"]));
    expect(r.kind === "tasks" && r.tasks.map((t) => t.id)).toEqual(["t3"]);
  });
  it("falha em uma irmã sinaliza falha", () => {
    expect(pickReadyTasks(graph(["done", "failed", "running", "pending"])).kind).toBe("failed");
  });
  it("sem dependências múltiplas, vale a dependência única (tarefas antigas)", () => {
    const old: TaskLite[] = [
      { id: "a", position: 0, status: "done", depends_on_position: null },
      { id: "b", position: 1, status: "pending", depends_on_position: 0, depends_on_positions: [] },
    ];
    const r = pickReadyTasks(old);
    expect(r.kind === "tasks" && r.tasks[0].id).toBe("b");
  });
  it("os três templates têm grupos paralelos válidos e a revisora espera o grupo", () => {
    for (const slug of ["conteudo-youtube", "edtech-metodologias-ativas", "mentoria-academica"]) {
      const tasks = planTasks(getTemplate(slug)!);
      expect(tasks.some((t) => t.dependsOnPositions.length === 1 && tasks.some((o) => o !== t && o.dependsOnPositions[0] === t.dependsOnPositions[0])), slug).toBe(true);
      const review = tasks.find((t) => t.title === "Parecer de revisão")!;
      expect(review.dependsOnPositions.length, slug).toBeGreaterThanOrEqual(1);
      for (const t of tasks) for (const d of t.dependsOnPositions) expect(d, slug).toBeLessThan(t.position);
    }
    const m = planTasks(getTemplate("mentoria-academica")!);
    expect(m.map((t) => t.dependsOnPositions)).toEqual([[], [0], [0], [0], [1, 2, 3], [4]]);
  });
});

describe("teto de custo", () => {
  it("classifica ok, aviso (80%) e estourado", () => {
    expect(budgetState(1, 4)).toBe("ok");
    expect(budgetState(3.2, 4)).toBe("warn");
    expect(budgetState(4, 4)).toBe("exceeded");
    expect(budgetState(0, 0)).toBe("exceeded");
  });
  it("clampCap usa padrão para valor inválido e respeita o máximo", () => {
    const tpl = { defaultCapUsd: 4, maxCapUsd: 20 };
    expect(clampCap(undefined, tpl)).toBe(4);
    expect(clampCap("abc", tpl)).toBe(4);
    expect(clampCap(-3, tpl)).toBe(4);
    expect(clampCap(7.5, tpl)).toBe(7.5);
    expect(clampCap(999, tpl)).toBe(20);
  });
});

describe("filtro de dados pessoais", () => {
  it("mascara CPF, e-mail, telefone, nascimento e prontuário", () => {
    const { text, findings } = maskPii(
      "Paciente CPF 123.456.789-09, email joao@exemplo.com, tel (84) 99876-5432, nascimento: 12/03/1980, prontuário nº 4455.12",
    );
    expect(text).not.toMatch(/123\.456\.789-09/);
    expect(text).not.toMatch(/joao@exemplo\.com/);
    expect(text).not.toMatch(/99876-5432/);
    expect(text).not.toMatch(/12\/03\/1980/);
    expect(text).not.toMatch(/4455\.12/);
    expect(text).toMatch(/nascimento: \[data removida\]/);
    expect(findings.map((f) => f.type).sort()).toEqual(["cpf", "email", "nascimento", "prontuario", "telefone"]);
  });
  it("não altera texto sem identificadores nem mexe em números comuns", () => {
    const s = "Dose de 500 mg a cada 8 horas por 7 dias, creatinina 1,2 em 2024.";
    expect(maskPii(s)).toEqual({ text: s, findings: [] });
  });
  it("só filtra em squads de dados de saúde", () => {
    const s = "contato maria@x.com";
    expect(screenInput(s, "normal").text).toBe(s);
    expect(screenInput(s, "dados_pessoais").text).toBe(s);
    expect(screenInput(s, "dados_saude").text).not.toMatch(/maria@x\.com/);
  });
});

describe("buildTaskUserMessage", () => {
  it("inclui missão, formulário, trabalho anterior e a tarefa atual", () => {
    const msg = buildTaskUserMessage({
      briefing: "Vídeo sobre varfarina",
      formData: { publico: "Pacientes", vazio: "" },
      step: { title: "Roteiro", instructions: "Escreva." },
      previous: [{ agentName: "Helena", title: "Plano", output: "plano aqui" }],
    });
    expect(msg).toContain("Vídeo sobre varfarina");
    expect(msg).toContain("publico: Pacientes");
    expect(msg).not.toContain("vazio");
    expect(msg).toContain("Plano (por Helena)");
    expect(msg.trim().endsWith("Escreva.")).toBe(true);
  });
  it("corta saídas anteriores muito longas", () => {
    const msg = buildTaskUserMessage({
      briefing: "x", formData: {}, step: { title: "t", instructions: "i" },
      previous: [{ agentName: "A", title: "T", output: "a".repeat(50000) }],
    });
    expect(msg.length).toBeLessThan(35000);
    expect(msg).toContain("trecho cortado");
  });
});

describe("templates registrados", () => {
  it.each(listTemplates().map((t) => [t.slug, t] as const))("%s tem formulário, pipeline e entrega final consistentes", (_slug, t) => {
    expect(t.formFields.filter((f) => f.isBriefing)).toHaveLength(1);
    expect(t.formFields.find((f) => f.isBriefing)!.required).toBe(true);
    for (const f of t.formFields) if (f.type === "select") expect(f.options?.length).toBeGreaterThan(1);
    const tasks = planTasks(t);
    expect(tasks.filter((x) => x.deliverable?.final)).toHaveLength(1);
    expect(tasks[tasks.length - 1].deliverable?.final).toBe(true);
    expect(t.agents.some((a) => a.slug === "revisora")).toBe(true);
  });
  it("a Mentoria é contínua e os de missão não", () => {
    expect(getTemplate("mentoria-academica")!.kind).toBe("continuous");
    expect(getTemplate("conteudo-youtube")!.kind).toBe("mission");
  });
});

describe("checkForm / formDisplay", () => {
  const t = TEMPLATE_CONTEUDO_YOUTUBE;
  it("aponta campos obrigatórios que faltam", () => {
    const r = checkForm(t.formFields, { tema: "  ", publico: "Estudantes" });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["Tema do vídeo", "Duração"]);
  });
  it("aceita formulário completo, descarta chaves desconhecidas e opções inválidas", () => {
    const r = checkForm(t.formFields, { tema: "Varfarina", publico: "Estudantes", duracao: "8 a 12 min", hack: "x" });
    expect(r.ok).toBe(true);
    expect(r.briefing).toBe("Varfarina");
    expect(r.clean).not.toHaveProperty("hack");
    const bad = checkForm(t.formFields, { tema: "x", publico: "Qualquer coisa", duracao: "8 a 12 min" });
    expect(bad.ok).toBe(false);
    expect(bad.missing).toEqual(["Público"]);
  });
  it("formDisplay usa rótulos e omite o campo-título e os vazios", () => {
    const d = formDisplay(t.formFields, { tema: "Varfarina", publico: "Estudantes", tom: "" });
    expect(d).toEqual({ "Público": "Estudantes" });
  });
});

describe("agendamento", () => {
  // Brasília = UTC-3. 10:00 UTC = 07:00 em Brasília. 2026-11-02 é segunda-feira.
  const mon7 = new Date("2026-11-02T10:05:00Z");
  it("dispara na hora e dia certos (horário de Brasília)", () => {
    expect(isScheduleDue({ frequency: "weekly", run_hour: 7, run_day_of_week: 1, last_run_at: null }, mon7)).toBe(true);
    expect(isScheduleDue({ frequency: "weekly", run_hour: 7, run_day_of_week: 2, last_run_at: null }, mon7)).toBe(false);
    expect(isScheduleDue({ frequency: "daily", run_hour: 8, run_day_of_week: null, last_run_at: null }, mon7)).toBe(false);
  });
  it("considera o dia local: 01:00 UTC de terça ainda é segunda à noite em Brasília", () => {
    const monNight = new Date("2026-11-03T01:30:00Z"); // 22:30 de segunda em Brasília
    expect(isScheduleDue({ frequency: "weekly", run_hour: 22, run_day_of_week: 1, last_run_at: null }, monNight)).toBe(true);
  });
  it("não repete dentro do intervalo mínimo", () => {
    const recent = new Date("2026-11-02T09:55:00Z").toISOString();
    expect(isScheduleDue({ frequency: "daily", run_hour: 7, run_day_of_week: null, last_run_at: recent }, mon7)).toBe(false);
    const lastWeek = new Date("2026-10-26T10:00:00Z").toISOString();
    expect(isScheduleDue({ frequency: "weekly", run_hour: 7, run_day_of_week: 1, last_run_at: lastWeek }, mon7)).toBe(true);
  });
  it("início do mês em Brasília", () => {
    expect(monthStartIso(new Date("2026-11-15T12:00:00Z"))).toBe("2026-11-01T03:00:00.000Z");
    // 01:00 UTC do dia 1 ainda é o último dia do mês anterior em Brasília
    expect(monthStartIso(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10-01T03:00:00.000Z");
  });
});

describe("revisão pedida pelo dono", () => {
  it("inclui o pedido e a entrega anterior", () => {
    const s = buildRevisionInstructions("Deixe mais curto", "TEXTO ANTIGO");
    expect(s).toContain("Deixe mais curto");
    expect(s).toContain("TEXTO ANTIGO");
  });
});

describe("contexto na mensagem da tarefa", () => {
  it("coloca a memória do squad antes da missão", () => {
    const msg = buildTaskUserMessage({
      briefing: "Tema X", formData: {}, context: "Prefiro tom formal", step: { title: "t", instructions: "i" }, previous: [],
    });
    expect(msg.indexOf("Prefiro tom formal")).toBeGreaterThanOrEqual(0);
    expect(msg.indexOf("Prefiro tom formal")).toBeLessThan(msg.indexOf("Tema X"));
  });
});

describe("medição de duração do roteiro", () => {
  const roteiro = `Ganchos
(CENA: Estudante olhando para um prato de couve refogada que ganha uma aura vilã.) NARRADOR (Bia): Imagina essa cena: você, estudioso, lendo sobre coagulação, e de repente, sua couve refogada vira a vilã! Drama? Talvez.

(TEMPO: 10-25 segundos) (CENA: Animação com a varfarina (a clássica) bloqueando a vitamina K.) NARRADOR (Bia): A varfarina é a rival da vitamina K. Ela altera o INR.

[Afirmações que precisam de checagem em fonte:]
A varfarina atua inibindo a recuperação da vitamina K. Muitas outras palavras aqui que não são faladas no vídeo.`;

  it("conta só as falas do narrador, sem cenas nem a seção de afirmações", () => {
    const m = measureScript(roteiro);
    expect(m.precise).toBe(true);
    // fala 1: 19 palavras; fala 2: 12 palavras
    expect(m.words).toBe(31);
  });
  it("cai para contagem aproximada quando não há marcação de narrador", () => {
    const m = measureScript("um texto simples sem marcadores com dez palavras no total ok");
    expect(m.precise).toBe(false);
    expect(m.words).toBe(11);
  });
  it("converte palavras em segundos nos dois ritmos", () => {
    const m = measureScript("NARRADOR: " + Array(150).fill("palavra").join(" "));
    expect(m.secondsNormal).toBe(60);
    expect(m.secondsFast).toBe(53);
  });
  it("interpreta o limite de duração do formulário", () => {
    expect(parseDurationLimitSeconds("Short (até 60 s)")).toBe(60);
    expect(parseDurationLimitSeconds("8 a 12 min")).toBe(720);
    expect(parseDurationLimitSeconds("Aula longa (20 min ou mais)")).toBeNull();
    expect(parseDurationLimitSeconds(undefined)).toBeNull();
  });
  it("classifica dentro, no limite e acima", () => {
    const mk = (words: number) => measureScript("NARRADOR: " + Array(words).fill("p").join(" "));
    expect(durationNote(mk(120), 60, "R")).toContain("dentro do limite");
    expect(durationNote(mk(160), 60, "R")).toContain("NO LIMITE");
    expect(durationNote(mk(200), 60, "R")).toContain("ACIMA do limite");
  });
});

describe("parecer pede ajustes?", () => {
  it("reconhece o veredito de ajustes em variações de formatação", () => {
    expect(reviewRequestsAdjustments("VEREDITO: AJUSTES NECESSÁRIOS\n1. ...")).toBe(true);
    expect(reviewRequestsAdjustments("**VEREDITO: AJUSTES NECESSÁRIOS**")).toBe(true);
    expect(reviewRequestsAdjustments("Veredito: **Ajustes** necessários")).toBe(true);
    expect(reviewRequestsAdjustments("VEREDITO: APROVADO")).toBe(false);
    expect(reviewRequestsAdjustments("")).toBe(false);
  });
});

describe("time e medições na mensagem da tarefa", () => {
  it("inclui a lista do time e as medições antes da tarefa", () => {
    const msg = buildTaskUserMessage({
      briefing: "x", formData: {}, step: { title: "t", instructions: "i" }, previous: [],
      team: [{ name: "Bia", role: "Roteirista" }], notes: ["Roteiro: 100 palavras"],
    });
    expect(msg).toContain("ÚNICAS pessoas");
    expect(msg).toContain("- Bia: Roteirista");
    expect(msg.indexOf("Roteiro: 100 palavras")).toBeLessThan(msg.indexOf("Sua tarefa agora"));
  });
});

describe("template de Conteúdo: verificações", () => {
  const tasks = planTasks(TEMPLATE_CONTEUDO_YOUTUBE);
  it("a revisora e a diretora recebem a medição de duração", () => {
    const review = tasks.find((t) => t.title === "Parecer de revisão")!;
    const final = tasks.find((t) => t.deliverable?.final)!;
    expect(review.checks?.measureDuration?.formKey).toBe("duracao");
    expect(final.checks?.measureDuration?.sourceTitles).toContain("Ajustes do roteiro");
  });
  it("a etapa de ajustes é condicional, vem depois do parecer e antes da entrega final", () => {
    const iReview = tasks.findIndex((t) => t.title === "Parecer de revisão");
    const iFix = tasks.findIndex((t) => t.title === "Ajustes do roteiro");
    const iFinal = tasks.findIndex((t) => t.deliverable?.final);
    expect(tasks[iFix].checks?.onlyIfAdjusts).toBe(true);
    expect(tasks[iFix].agentSlug).toBe("roteirista");
    expect(iReview).toBeLessThan(iFix);
    expect(iFix).toBeLessThan(iFinal);
  });
  it("todo prompt de agente proíbe inventar colegas", () => {
    for (const a of TEMPLATE_CONTEUDO_YOUTUBE.agents) expect(a.systemPrompt).toContain("Seu time");
  });
});

describe("contexto entre agentes não corta roteiro longo", () => {
  it("mantém inteiro um roteiro de ~12 mil caracteres", () => {
    const longo = "palavra ".repeat(1500);
    const msg = buildTaskUserMessage({
      briefing: "x", formData: {}, step: { title: "t", instructions: "i" },
      previous: [{ agentName: "Bia", title: "Roteiro", output: longo }],
    });
    expect(msg).not.toContain("trecho cortado");
    expect(msg.split("palavra").length - 1).toBe(1500);
  });
});

describe("faixa de duração e roteiro curto demais", () => {
  it("interpreta mínimo e máximo", () => {
    expect(parseDurationRange("8 a 12 min")).toEqual({ min: 480, max: 720 });
    expect(parseDurationRange("Short (até 60 s)")).toEqual({ min: null, max: 60 });
    expect(parseDurationRange("Aula longa (20 min ou mais)")).toBeNull();
  });
  it("avisa quando o roteiro está muito abaixo do mínimo (provável corte)", () => {
    const curto = measureScript("NARRADOR: " + Array(159).fill("p").join(" "));
    expect(durationNote(curto, { min: 480, max: 720 }, "Ajustes do roteiro")).toContain("ABAIXO do mínimo");
  });
  it("aceita roteiro dentro da faixa de 8 a 12 min", () => {
    const ok = measureScript("NARRADOR: " + Array(1500).fill("p").join(" "));
    expect(durationNote(ok, { min: 480, max: 720 }, "R")).toContain("dentro do limite");
  });
  it("sem NARRADOR, usa as falas entre aspas e ignora o resto", () => {
    const t = [
      '(BIA, sorrindo) "Você toma anticoagulante e morre de medo de comer um brócolis ou uma couve? Calma!" (Sugestão Caio: animação leve)',
      '(BIA) "Seja bem-vindo(a)! Anticoagulantes são medicamentos essenciais para muitas pessoas hoje."',
      '(BIA) "Vamos começar com a varfarina, um dos anticoagulantes mais conhecidos e antigos que existem."',
    ].join("\n\n");
    const m = measureScript(t);
    expect(m.precise).toBe(false);
    expect(m.words).toBeGreaterThan(30);
    expect(m.words).toBeLessThan(45);
  });
  it("a fala termina antes de uma sugestão do diretor de arte", () => {
    const t = "NARRADOR: Olá pessoal, hoje vamos falar de anticoagulantes. (Sugestão Caio: animação com uma balança e muitas outras palavras que não são faladas)";
    expect(measureScript(t).words).toBe(7);
  });
});

describe("perguntas ao dono", () => {
  const bloco = `[[PERGUNTA_AO_DONO]]
Pergunta: O material diz para manter a vitamina K constante e também para evitar vegetais verdes. Qual vale?
Opções: Manter constante, sem eliminar | Evitar vegetais verdes | Deixar a decisão para o médico
Por quê: Muda a mensagem principal do vídeo.
[[/PERGUNTA_AO_DONO]]`;

  it("extrai pergunta, opções e motivo", () => {
    const q = extractOwnerQuestion(bloco)!;
    expect(q.question).toContain("Qual vale?");
    expect(q.options).toEqual(["Manter constante, sem eliminar", "Evitar vegetais verdes", "Deixar a decisão para o médico"]);
    expect(q.why).toContain("mensagem principal");
    expect(q.cleaned).toBe("");
  });
  it("aceita bloco sem fechamento, opções em lista e sem rótulo de pergunta", () => {
    const q = extractOwnerQuestion("[[PERGUNTA_AO_DONO]]\nQual público devo considerar?\nOpções:\n- Pacientes\n- Estudantes");
    expect(q!.question).toBe("Qual público devo considerar?");
    expect(q!.options).toEqual(["Pacientes", "Estudantes"]);
  });
  it("devolve o texto restante quando a pergunta vem junto de conteúdo", () => {
    const q = extractOwnerQuestion("Segue o plano.\n\n" + bloco)!;
    expect(q.cleaned).toBe("Segue o plano.");
  });
  it("não vê pergunta onde não há bloco", () => {
    expect(extractOwnerQuestion("Plano normal sem dúvidas.")).toBeNull();
    expect(extractOwnerQuestion("[[PERGUNTA_AO_DONO]]\n\n[[/PERGUNTA_AO_DONO]]")).toBeNull();
  });
  it("limita a 4 opções", () => {
    const q = extractOwnerQuestion("[[PERGUNTA_AO_DONO]]\nPergunta: x?\nOpções: a | b | c | d | e | f\n[[/PERGUNTA_AO_DONO]]")!;
    expect(q.options).toHaveLength(4);
  });
  it("as regras mudam conforme possa ou não perguntar, e trazem as respostas anteriores", () => {
    const pode = buildOwnerRules({ canAsk: true, remaining: 2, qa: [] });
    expect(pode).toContain("PERGUNTA_AO_DONO");
    expect(pode).toContain("até 2 pergunta");
    const nao = buildOwnerRules({ canAsk: false, remaining: 0, qa: [{ question: "Q1?", answer: "Manter constante" }] });
    expect(nao).toContain("Não faça perguntas");
    expect(nao).toContain("Resposta do dono: Manter constante");
  });
  it("a mensagem da tarefa inclui as regras de perguntas antes da tarefa", () => {
    const msg = buildTaskUserMessage({
      briefing: "x", formData: {}, step: { title: "Plano", instructions: "i" }, previous: [],
      owner: { canAsk: true, remaining: 2, qa: [] },
    });
    expect(msg.indexOf("Perguntas ao dono")).toBeLessThan(msg.indexOf("Sua tarefa agora"));
  });
  it("todos os planos dos templates orientam a perguntar em caso de contradição", () => {
    for (const t of listTemplates()) {
      const plan = planTasks(t)[0];
      expect(plan.instructions, t.slug).toContain("pergunte ao dono");
    }
  });
});
