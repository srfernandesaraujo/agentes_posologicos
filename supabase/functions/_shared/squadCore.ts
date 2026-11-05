// Lógica pura (sem APIs do Deno) do motor de squads: tipos de template, planejamento de
// tarefas, controle de teto de custo, filtro de dados pessoais e montagem de prompts.
// Fica em _shared para ser importável tanto pela edge function `squad-engine` quanto
// pelos testes em src/lib (mesmo padrão de drugLabelFacts.ts e evidenceGrade.ts).

export type SquadKind = "mission" | "continuous";
export type SquadSensitivity = "normal" | "dados_pessoais" | "dados_saude";
export type SquadRoom = "dir" | "ops" | "lib" | "meet" | "copa";

export interface TemplateAgent {
  slug: string;
  name: string;
  role: string;
  room: SquadRoom;
  systemPrompt: string;
}

export interface DeliverableSpec {
  title: string;
  kind: string;
  /** Entrega final da missão: fica "aguardando o dono" em vez de "concluída". */
  final?: boolean;
}

/** Verificações feitas pelo sistema (código), não pelo modelo. */
export interface StepChecks {
  /** Mede a duração de um roteiro e entrega o número ao agente, junto com o limite pedido no formulário. */
  measureDuration?: { sourceTitles: string[]; formKey: string };
  /** Conta as palavras de um texto longo (capítulo, artigo) e entrega o número, junto com a faixa pedida no formulário. */
  measureWords?: { sourceTitles: string[]; formKey: string };
  /** Etapa de correção: só roda se o parecer da revisora pediu ajustes. Senão, é pulada. */
  onlyIfAdjusts?: boolean;
}

export interface TemplateStep {
  agent: string;
  title: string;
  instructions: string;
  deliverable?: DeliverableSpec;
  checks?: StepChecks;
  /** Roda ao mesmo tempo que a etapa anterior (mesma dependência). A etapa seguinte ao grupo espera todas. */
  parallelWithPrevious?: boolean;
}

export interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** O valor deste campo é o título/resumo da missão. Exatamente um campo por template. */
  isBriefing?: boolean;
}

export interface SquadTemplate {
  slug: string;
  name: string;
  kind: SquadKind;
  sensitivity: SquadSensitivity;
  environment: string;
  defaultCapUsd: number;
  maxCapUsd: number;
  estimatedCostUsd: { min: number; max: number };
  formFields: FormField[];
  agents: TemplateAgent[];
  steps: TemplateStep[];
  /** Squad persistente de missão: a última versão desta entrega entra como contexto nas missões seguintes (ex.: bíblia do livro). */
  carryDeliverable?: { title: string; heading: string; maxChars?: number };
}

export interface PlannedTask {
  position: number;
  agentSlug: string;
  title: string;
  instructions: string;
  /** Posição da tarefa de que esta depende (null na primeira). Pipeline sequencial na Fase 0. */
  dependsOnPosition: number | null;
  /** Todas as posições de que esta tarefa depende (vazio na primeira). Permite etapas em paralelo. */
  dependsOnPositions: number[];
  deliverable: DeliverableSpec | null;
  checks: StepChecks | null;
}

export function planTasks(template: SquadTemplate): PlannedTask[] {
  const slugs = new Set(template.agents.map((a) => a.slug));
  // Grupos paralelos: [start..end]. Cada membro depende do que o primeiro do grupo dependia;
  // a etapa seguinte ao grupo depende de todos os membros.
  const groupStart: number[] = [];
  template.steps.forEach((st, i) => {
    groupStart[i] = st.parallelWithPrevious && i > 0 ? groupStart[i - 1] : i;
  });
  return template.steps.map((s, i) => {
    if (!slugs.has(s.agent)) {
      throw new Error(`Template ${template.slug}: etapa "${s.title}" usa agente inexistente "${s.agent}"`);
    }
    const start = groupStart[i];
    const deps = start === 0 ? [] : prevGroupPositions(groupStart, start);
    return {
      position: i,
      agentSlug: s.agent,
      title: s.title,
      instructions: s.instructions,
      dependsOnPosition: deps.length ? deps[0] : null,
      dependsOnPositions: deps,
      deliverable: s.deliverable ?? null,
      checks: s.checks ?? null,
    };
  });
}

/** Posições do grupo que termina logo antes de `before` (um grupo de 1 = a etapa anterior). */
function prevGroupPositions(groupStart: number[], before: number): number[] {
  const start = groupStart[before - 1];
  const out: number[] = [];
  for (let p = start; p < before; p++) out.push(p);
  return out;
}

// ---------- Escolha da próxima tarefa ----------

export interface TaskLite {
  id: string;
  position: number;
  status: "pending" | "running" | "done" | "failed";
  depends_on_position: number | null;
  /** Todas as dependências (opcional; sem ela vale depends_on_position). */
  depends_on_positions?: number[] | null;
}

export type NextTask =
  | { kind: "task"; task: TaskLite }
  | { kind: "busy" } // já existe uma tarefa em execução
  | { kind: "failed" }
  | { kind: "finished" };

function depsOf(t: TaskLite): number[] {
  if (t.depends_on_positions && t.depends_on_positions.length) return t.depends_on_positions;
  return t.depends_on_position == null ? [] : [t.depends_on_position];
}

export type ReadyTasks =
  | { kind: "tasks"; tasks: TaskLite[] }
  | { kind: "busy" }
  | { kind: "failed" }
  | { kind: "finished" };

/**
 * Todas as tarefas prontas para rodar agora (dependências concluídas). Em paralelo, várias podem estar
 * prontas ao mesmo tempo; tarefas já em execução não impedem iniciar outras prontas.
 */
export function pickReadyTasks(tasks: TaskLite[]): ReadyTasks {
  if (tasks.some((t) => t.status === "failed")) return { kind: "failed" };
  if (tasks.length > 0 && tasks.every((t) => t.status === "done")) return { kind: "finished" };
  const byPos = new Map(tasks.map((t) => [t.position, t]));
  const ready = [...tasks]
    .sort((a, b) => a.position - b.position)
    .filter((t) => t.status === "pending" && depsOf(t).every((p) => byPos.get(p)?.status === "done"));
  return ready.length ? { kind: "tasks", tasks: ready } : { kind: "busy" };
}

/** Compatível com o uso sequencial: só a primeira pronta, e nada se algo já roda. */
export function pickNextTask(tasks: TaskLite[]): NextTask {
  if (tasks.some((t) => t.status === "failed")) return { kind: "failed" };
  if (tasks.some((t) => t.status === "running")) return { kind: "busy" };
  const r = pickReadyTasks(tasks);
  if (r.kind === "tasks") return { kind: "task", task: r.tasks[0] };
  return r;
}

// ---------- Teto de custo ----------

export type BudgetState = "ok" | "warn" | "exceeded";

export function budgetState(costUsd: number, capUsd: number, warnAt = 0.8): BudgetState {
  if (!(capUsd > 0)) return "exceeded";
  if (costUsd >= capUsd) return "exceeded";
  if (costUsd >= capUsd * warnAt) return "warn";
  return "ok";
}

/** Valor pedido no formulário → teto efetivo, respeitando padrão e máximo do template. */
export function clampCap(requested: unknown, template: Pick<SquadTemplate, "defaultCapUsd" | "maxCapUsd">): number {
  const n = typeof requested === "number" ? requested : Number(requested);
  if (!Number.isFinite(n) || n <= 0) return template.defaultCapUsd;
  return Math.min(Math.round(n * 100) / 100, template.maxCapUsd);
}

// ---------- Filtro de dados pessoais (squads de saúde) ----------

export interface PiiFinding {
  type: string;
  count: number;
}

const PII_RULES: Array<{ type: string; label: string; re: RegExp }> = [
  { type: "cpf", label: "[CPF removido]", re: /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g },
  { type: "email", label: "[e-mail removido]", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: "telefone", label: "[telefone removido]", re: /(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)/g },
  {
    type: "nascimento",
    label: "$1[data removida]",
    re: /(nasc(?:imento|ido|ida|\.)?[^\d\n]{0,15})\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/gi,
  },
  {
    type: "prontuario",
    label: "$1[número removido]",
    re: /((?:prontu[aá]rio|matr[ií]cula|registro hospitalar)\s*(?:n[º°o.]*)?\s*:?\s*)\d[\d.\-\/]{2,}/gi,
  },
];

export interface PiiResult {
  text: string;
  findings: PiiFinding[];
}

/**
 * Mascara identificadores óbvios. Só pega padrões (CPF, e-mail, telefone, data de nascimento,
 * prontuário): nomes próprios NÃO são detectados, por isso o formulário continua exigindo a
 * confirmação do usuário de que os dados estão anonimizados.
 */
export function maskPii(input: string): PiiResult {
  let text = input;
  const findings: PiiFinding[] = [];
  for (const rule of PII_RULES) {
    let count = 0;
    text = text.replace(rule.re, (...args) => {
      count++;
      // grupos de captura: $1 só existe nas regras com grupo
      const g1 = typeof args[1] === "string" && rule.label.includes("$1") ? args[1] : "";
      return rule.label.replace("$1", g1);
    });
    if (count > 0) findings.push({ type: rule.type, count });
  }
  return { text, findings };
}

export function screenInput(text: string, sensitivity: SquadSensitivity): PiiResult {
  if (sensitivity !== "dados_saude") return { text, findings: [] };
  return maskPii(text);
}

// ---------- Prompts ----------

export interface PreviousOutput {
  agentName: string;
  title: string;
  output: string;
}

// Contexto entre agentes: o limite precisa caber um roteiro longo inteiro (vídeo de 12 min tem ~10 mil caracteres).
// Um limite baixo aqui fez revisora e designer enxergarem só metade do roteiro (bug corrigido em 2026-11-04).
const MAX_PREV_CHARS = 30000;

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "\n[... trecho cortado por tamanho ...]";
}

export function buildTaskUserMessage(p: {
  briefing: string;
  formData: Record<string, unknown>;
  step: { title: string; instructions: string };
  previous: PreviousOutput[];
  /** Memória do squad + resultado da execução anterior (squads contínuos). */
  context?: string;
  /** Quem realmente existe no squad: impede que os agentes inventem colegas. */
  team?: { name: string; role: string }[];
  /** Medições feitas pelo sistema (ex.: duração do roteiro). */
  notes?: string[];
  /** Perguntas já respondidas pelo dono e se este agente ainda pode perguntar. */
  owner?: OwnerQaContext;
}): string {
  const parts: string[] = [];
  if (p.team && p.team.length) parts.push(buildTeamRoster(p.team));
  if (p.context && p.context.trim()) {
    parts.push(`# Memória do squad (preferências e contexto do dono)\n${clip(p.context.trim(), MAX_PREV_CHARS)}`);
  }
  parts.push(`# Missão\n${p.briefing.trim()}`);
  const fields = Object.entries(p.formData || {}).filter(([, v]) => v !== "" && v != null);
  if (fields.length) {
    parts.push(`# Detalhes do formulário\n` + fields.map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n"));
  }
  if (p.previous.length) {
    parts.push(
      `# Trabalho já feito pelo time\n` +
        p.previous.map((o) => `## ${o.title} (por ${o.agentName})\n${clip(o.output, MAX_PREV_CHARS)}`).join("\n\n"),
    );
  }
  if (p.notes && p.notes.length) {
    parts.push(`# Medições automáticas (feitas pelo sistema por código, não por estimativa; use estes números)\n${p.notes.join("\n")}`);
  }
  if (p.owner) parts.push(buildOwnerRules(p.owner));
  parts.push(`# Sua tarefa agora: ${p.step.title}\n${p.step.instructions.trim()}`);
  return parts.join("\n\n");
}

export function buildTeamRoster(team: { name: string; role: string }[]): string {
  return (
    `# Seu time (são as ÚNICAS pessoas que existem neste squad)\n` +
    team.map((t) => `- ${t.name}: ${t.role}`).join("\n") +
    `\nNunca atribua trabalho a papéis que não estão nesta lista e nunca fale de "editor", "designer" ou "revisor" que não esteja aqui. ` +
    `O dono do squad é quem lerá a entrega final e decide.`
  );
}

// ---------- Medições feitas por código ----------

export interface ScriptMeasure {
  words: number;
  /** Segundos em ritmo normal (150 palavras/min) e rápido (170 palavras/min). */
  secondsNormal: number;
  secondsFast: number;
  /** false quando não achou falas marcadas como NARRADOR e contou o texto todo (superestima). */
  precise: boolean;
}

const WPM_NORMAL = 150;
const WPM_FAST = 170;

function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Conta as palavras FALADAS de um roteiro: as falas marcadas "NARRADOR ...:" até o próximo marcador
 * de cena, tempo ou seção. A seção "[Afirmações ...]" e as marcações de cena não contam.
 */
export function measureScript(text: string): ScriptMeasure {
  const cut = text.split(/\[\s*Afirma[çc][õo]es/i)[0];
  const spoken: string[] = [];
  const re = /NARRADOR[^:\n]*:\s*([\s\S]*?)(?=\n\s*\n|\(\s*(?:CENA|TEMPO|PONTO|Sugest[aã]o|HIP[OÓ]TESE|VISUAL)|NARRADOR[^:\n]*:|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cut))) spoken.push(m[1]);
  const precise = spoken.length > 0;
  let words: number;
  if (precise) {
    words = countWords(spoken.join(" "));
  } else {
    // Sem marcação de narrador: tenta as falas entre aspas; sem aspas, conta o texto todo (superestima).
    const quoted: string[] = [];
    const qre = /["\u201C]([^"\u201D]{25,})["\u201D]/g;
    let q: RegExpExecArray | null;
    while ((q = qre.exec(cut))) quoted.push(q[1]);
    words = quoted.length >= 3 ? countWords(quoted.join(" ")) : countWords(cut);
  }
  return {
    words,
    secondsNormal: Math.round((words / WPM_NORMAL) * 60),
    secondsFast: Math.round((words / WPM_FAST) * 60),
    precise,
  };
}

/** "Short (até 60 s)" → 60; "8 a 12 min" → 720 (o teto da faixa); sem limite claro → null. */
export function parseDurationLimitSeconds(label: unknown): number | null {
  const s = String(label ?? "");
  const sec = s.match(/(\d+)\s*s\b/i);
  if (sec) return Number(sec[1]);
  const range = s.match(/(\d+)\s*a\s*(\d+)\s*min/i);
  if (range) return Number(range[2]) * 60;
  return null;
}

/** "Short (até 60 s)" → {max:60}; "8 a 12 min" → {min:480, max:720}; sem limite claro → null. */
export function parseDurationRange(label: unknown): { min: number | null; max: number } | null {
  const s = String(label ?? "");
  const sec = s.match(/(\d+)\s*s\b/i);
  if (sec) return { min: null, max: Number(sec[1]) };
  const range = s.match(/(\d+)\s*a\s*(\d+)\s*min/i);
  if (range) return { min: Number(range[1]) * 60, max: Number(range[2]) * 60 };
  return null;
}

export function durationNote(m: ScriptMeasure, limit: number | { min: number | null; max: number }, sourceTitle: string): string {
  const limitSeconds = typeof limit === "number" ? limit : limit.max;
  const minSeconds = typeof limit === "number" ? null : limit.min;
  if (minSeconds && m.secondsNormal < minSeconds * 0.8) {
    return `Roteiro "${sourceTitle}": ${m.words} palavras narradas, cerca de ${m.secondsNormal} s em ritmo normal. Duração pedida: ${minSeconds} a ${limitSeconds} s. ` +
      `RESULTADO: ABAIXO do mínimo pedido. O roteiro está curto demais ou foi cortado/incompleto; é preciso conferir se o texto está inteiro.`;
  }
  const base = `Roteiro "${sourceTitle}": ${m.words} palavras narradas${m.precise ? "" : " (contagem aproximada do texto todo)"}, ` +
    `cerca de ${m.secondsNormal} s em ritmo normal (${WPM_NORMAL} palavras/min) e ${m.secondsFast} s em ritmo rápido (${WPM_FAST}/min). Limite pedido: ${limitSeconds} s.`;
  if (m.secondsFast > limitSeconds) return `${base} RESULTADO: ACIMA do limite, mesmo em ritmo rápido. É preciso cortar.`;
  if (m.secondsNormal > limitSeconds) return `${base} RESULTADO: NO LIMITE, só cabe em ritmo rápido. Recomenda-se cortar.`;
  return `${base} RESULTADO: dentro do limite.`;
}

/** O parecer da revisora pediu ajustes? (convenção "VEREDITO: AJUSTES NECESSÁRIOS") */
export function reviewRequestsAdjustments(reviewText: string): boolean {
  return /VEREDITO\s*:?\s*\**\s*AJUSTES/i.test(reviewText);
}

// ---------- Formulário do template ----------

/** Rótulos legíveis no lugar das chaves, para o prompt dos agentes. */
export function formDisplay(fields: FormField[], formData: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.isBriefing) continue;
    const v = formData?.[f.key];
    if (v !== undefined && v !== null && String(v).trim() !== "") out[f.label] = v;
  }
  return out;
}

export interface FormCheck {
  ok: boolean;
  missing: string[];
  briefing: string;
  clean: Record<string, string>;
}

/** Valida o formulário contra o template; só aceita chaves conhecidas, textos limitados e opções válidas. */
export function checkForm(fields: FormField[], raw: Record<string, unknown>, maxChars = 8000): FormCheck {
  const missing: string[] = [];
  const clean: Record<string, string> = {};
  for (const f of fields) {
    let v = typeof raw?.[f.key] === "string" ? (raw[f.key] as string).trim() : "";
    if (v.length > maxChars) v = v.slice(0, maxChars);
    if (f.type === "select" && v && f.options && !f.options.includes(v)) v = "";
    if (f.required && !v) missing.push(f.label);
    if (v) clean[f.key] = v;
  }
  const briefingField = fields.find((f) => f.isBriefing);
  const briefing = briefingField ? clean[briefingField.key] || "" : "";
  return { ok: missing.length === 0, missing, briefing, clean };
}

// ---------- Revisão pedida pelo dono ----------

export function buildRevisionInstructions(comment: string, previousFinal: string): string {
  return (
    `O dono da missão leu a entrega final e pediu ajustes. Reescreva a entrega final incorporando o pedido, ` +
    `mantendo o que já estava bom e sem inventar informações novas.\n\n` +
    `## Pedido do dono\n${comment.trim()}\n\n## Entrega anterior\n${clip(previousFinal, MAX_PREV_CHARS)}`
  );
}

// ---------- Agendamento (squads contínuos) ----------

export type Frequency = "daily" | "weekly";
export interface ScheduleLite {
  frequency: Frequency;
  run_hour: number; // hora de Brasília (UTC-3, sem horário de verão desde 2019)
  run_day_of_week: number | null; // 0=domingo, em horário de Brasília
  last_run_at: string | null;
}

const BRT_OFFSET_MS = -3 * 3600 * 1000;
const MIN_INTERVAL_MS: Record<Frequency, number> = {
  daily: 20 * 3600 * 1000,
  weekly: 6 * 24 * 3600 * 1000,
};

function brt(now: Date): { hour: number; dow: number } {
  const shifted = new Date(now.getTime() + BRT_OFFSET_MS);
  return { hour: shifted.getUTCHours(), dow: shifted.getUTCDay() };
}

export function isScheduleDue(s: ScheduleLite, now: Date): boolean {
  if (s.last_run_at && now.getTime() - new Date(s.last_run_at).getTime() < MIN_INTERVAL_MS[s.frequency]) return false;
  const t = brt(now);
  if (t.hour !== s.run_hour) return false;
  if (s.frequency === "weekly" && s.run_day_of_week != null && t.dow !== s.run_day_of_week) return false;
  return true;
}

/** Início do mês corrente em horário de Brasília, como ISO UTC (para somar o gasto mensal). */
export function monthStartIso(now: Date): string {
  const shifted = new Date(now.getTime() + BRT_OFFSET_MS);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return new Date(startShifted - BRT_OFFSET_MS).toISOString();
}

// ---------- Perguntas ao dono (bloqueantes) ----------

export const MAX_OWNER_QUESTIONS = 2;

export interface OwnerQuestion {
  question: string;
  options: string[];
  why: string;
  /** O texto sem o bloco de pergunta (útil quando a pergunta não era permitida). */
  cleaned: string;
}

/**
 * Procura o bloco [[PERGUNTA_AO_DONO]] ... [[/PERGUNTA_AO_DONO]] na resposta de um agente.
 * Campos: "Pergunta:", "Opções: a | b | c", "Por quê:". Tolerante a variações e a bloco sem fechamento.
 */
export function extractOwnerQuestion(text: string): OwnerQuestion | null {
  const m = text.match(/\[\[\s*PERGUNTA_AO_DONO\s*\]\]([\s\S]*?)(?:\[\[\s*\/\s*PERGUNTA_AO_DONO\s*\]\]|$)/i);
  if (!m) return null;
  const body = m[1].trim();
  const field = (re: RegExp): string => {
    const f = body.match(re);
    return f ? f[1].trim() : "";
  };
  const question = field(/^\s*Pergunta\s*:\s*([\s\S]*?)(?=^\s*(?:Op[çc][õo]es|Por\s*qu[êe])\s*:|(?![\s\S]))/im) ||
    body.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
  if (!question) return null;
  const optionsRaw = field(/^\s*Op[çc][õo]es\s*:\s*([\s\S]*?)(?=^\s*(?:Pergunta|Por\s*qu[êe])\s*:|(?![\s\S]))/im);
  const options = optionsRaw
    .split(/\||\n/)
    .map((o) => o.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((o) => o.length > 0 && o.length <= 160)
    .slice(0, 4);
  const why = field(/^\s*Por\s*qu[êe]\s*:\s*([\s\S]*?)(?=^\s*(?:Pergunta|Op[çc][õo]es)\s*:|(?![\s\S]))/im);
  const cleaned = text.replace(/\[\[\s*PERGUNTA_AO_DONO\s*\]\][\s\S]*?(?:\[\[\s*\/\s*PERGUNTA_AO_DONO\s*\]\]|$)/i, "").trim();
  return { question: question.slice(0, 600), options, why: why.slice(0, 600), cleaned };
}

export interface OwnerQaContext {
  /** O agente pode perguntar agora? (não em execução agendada e dentro do limite) */
  canAsk: boolean;
  remaining: number;
  qa: { question: string; answer: string }[];
}

export function buildOwnerRules(o: OwnerQaContext): string {
  const parts: string[] = [];
  if (o.qa.length) {
    parts.push(
      `# Respostas do dono às perguntas desta missão (valem como verdade, acima de qualquer suposição)\n` +
        o.qa.map((x, i) => `${i + 1}. Pergunta: ${x.question}\n   Resposta do dono: ${x.answer}`).join("\n"),
    );
  }
  if (o.canAsk) {
    parts.push(
      `# Perguntas ao dono\nVocê pode fazer até ${o.remaining} pergunta(s) ao dono nesta missão, SÓ quando houver contradição ou uma lacuna ` +
        `essencial que você não pode assumir com segurança. Conta como contradição: duas orientações clínicas conflitantes no material; OU o pedido/objetivo do dono ` +
        `pedir algo que o material de apoio (ou o conhecimento clínico estabelecido) desmente, sobretudo se puder causar dano ao público final. ` +
        `Nesse caso NÃO corrija sozinho nem "assuma a opção mais segura": pergunte, pois decidir isso é do dono. Dúvidas pequenas e sem risco: assuma a opção mais segura e registre como suposição. ` +
        `Para perguntar, responda APENAS com este bloco, sem mais nada:\n[[PERGUNTA_AO_DONO]]\nPergunta: <uma pergunta objetiva>\nOpções: <opção 1> | <opção 2> | <opção 3>\n` +
        `Por quê: <por que isso muda o resultado>\n[[/PERGUNTA_AO_DONO]]`,
    );
  } else {
    parts.push(`# Perguntas ao dono\nNão faça perguntas ao dono nesta tarefa (execução agendada ou limite de perguntas atingido). Assuma a opção mais segura e registre a suposição na entrega.`);
  }
  return parts.join("\n\n");
}

// ---------- Memória compartilhada do squad ----------

export type MemoryKind = "preference" | "correction" | "decision" | "fact";
export const MEMORY_KINDS: MemoryKind[] = ["preference", "correction", "decision", "fact"];
export const MEMORY_MAX_CHARS = 300;
export const MEMORY_CONTEXT_LIMIT = 20;
export const MEMORY_PER_EXTRACTION = 3;

export interface MemoryItem {
  id?: string;
  kind: MemoryKind;
  content: string;
  pinned?: boolean;
  status?: "suggested" | "active" | "archived";
  created_at?: string;
}

const MEMORY_LABELS: Record<MemoryKind, string> = {
  preference: "Preferências",
  correction: "Correções recorrentes (evitar)",
  decision: "Decisões já tomadas",
  fact: "Fatos do contexto",
};

/** Memórias ativas que entram no contexto: fixadas primeiro, depois as mais recentes, até o limite. */
export function selectMemoriesForContext(items: MemoryItem[], limit = MEMORY_CONTEXT_LIMIT): MemoryItem[] {
  return items
    .filter((m) => (m.status ?? "active") === "active")
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    })
    .slice(0, limit);
}

/** Texto de memória entregue aos agentes: notas livres do dono + itens confirmados, agrupados por tipo. */
export function buildMemoryContext(notes: string, items: MemoryItem[]): string {
  const parts: string[] = [];
  if (notes.trim()) parts.push(`## Notas do dono\n${notes.trim()}`);
  const chosen = selectMemoriesForContext(items);
  if (chosen.length) {
    const groups = MEMORY_KINDS
      .map((k) => ({ k, rows: chosen.filter((m) => m.kind === k) }))
      .filter((g) => g.rows.length)
      .map((g) => `### ${MEMORY_LABELS[g.k]}\n${g.rows.map((m) => `- ${m.content}`).join("\n")}`);
    parts.push(
      `## Memória aprendida (confirmada pelo dono)\nValem como preferências do dono para este squad. Não sobrepõem o material de apoio da missão nem as regras de segurança clínica.\n${groups.join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Já existe (quase) o mesmo item? Igual ou um contido no outro, depois de normalizar. */
export function isDuplicateMemory(content: string, existing: { content: string }[]): boolean {
  const n = norm(content);
  if (!n) return true;
  return existing.some((e) => {
    const m = norm(e.content);
    return m === n || (n.length >= 12 && m.includes(n)) || (m.length >= 12 && n.includes(m));
  });
}

export interface MemoryExtractionInput {
  source: "changes" | "answer";
  /** Comentário de ajustes do dono, ou a resposta dada a uma pergunta. */
  ownerText: string;
  /** Contexto curto: título da entrega ou a pergunta feita. */
  about: string;
  existing: { content: string }[];
}

export function buildMemoryExtractionPrompt(i: MemoryExtractionInput): { system: string; user: string } {
  const system =
    `Você extrai memória duradoura para um squad de agentes de IA. Recebe uma fala do dono do squad e decide se ela revela algo que valha para MISSÕES FUTURAS deste squad.\n` +
    `Regras:\n` +
    `- Extraia de 0 a ${MEMORY_PER_EXTRACTION} itens. Na dúvida, não extraia: devolva [].\n` +
    `- Só preferências de estilo, formato, tom, termos a evitar, critérios de qualidade ou fatos fixos sobre o dono e o público. Ignore pedidos que valem só para o tema desta missão (ex.: "troque o exemplo do segundo bloco").\n` +
    `- Cada item é uma frase curta e autoexplicativa (até ${MEMORY_MAX_CHARS} caracteres), sem nomes de pessoas reais, sem dados de pacientes, sem CPF, e-mail ou telefone.\n` +
    `- Nunca registre orientações clínicas como fato; registre apenas a preferência do dono sobre como o squad deve trabalhar.\n` +
    `- Tipos: "preference" (como fazer), "correction" (o que evitar, erro recorrente), "decision" (decisão já tomada pelo dono), "fact" (fato fixo do contexto).\n` +
    `- Não repita itens que já existem.\n` +
    `Responda APENAS com um array JSON, sem texto fora dele. Formato: [{"kind":"preference","content":"..."}]`;
  const existing = i.existing.length ? `\nJá existe na memória:\n${i.existing.slice(0, 30).map((e) => `- ${e.content}`).join("\n")}` : "";
  const user =
    `${i.source === "changes" ? "O dono pediu ajustes na entrega" : "O dono respondeu a uma pergunta do squad"}: ${i.about}\n\n` +
    `Fala do dono:\n"""\n${i.ownerText.slice(0, 2000)}\n"""${existing}`;
  return { system, user };
}

/** Lê a resposta do modelo: aceita array JSON (com ou sem cercas de código), valida, dedupe e limita. */
export function parseMemoryExtraction(text: string, existing: { content: string }[] = []): MemoryItem[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let raw: unknown;
  try { raw = JSON.parse(m[0]); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: MemoryItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const kind = (MEMORY_KINDS as string[]).includes((r as any).kind) ? ((r as any).kind as MemoryKind) : "preference";
    const content = typeof (r as any).content === "string" ? maskPii((r as any).content).text.replace(/\s+/g, " ").trim().slice(0, MEMORY_MAX_CHARS) : "";
    if (content.length < 8) continue;
    if (isDuplicateMemory(content, [...existing, ...out])) continue;
    out.push({ kind, content });
    if (out.length >= MEMORY_PER_EXTRACTION) break;
  }
  return out;
}

// ---------- Medição de palavras (textos longos) ----------

/** Conta palavras de um texto em markdown, ignorando marcas de formatação e linhas só de símbolos. */
export function countTextWords(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export interface WordRange { min: number; max: number }

const num = (s: string) => Number(s.replace(/\./g, ""));

/** Lê faixas como "Médio (2.500 a 3.500 palavras)" ou "Longo (5.000 palavras ou mais)". */
export function parseWordRange(label: unknown): WordRange | null {
  const s = String(label ?? "");
  const between = s.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:a|à|até|-|–)\s*(\d{1,3}(?:\.\d{3})+|\d+)/i);
  if (between) {
    const [a, b] = [num(between[1]), num(between[2])];
    return a <= b ? { min: a, max: b } : null;
  }
  const more = s.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:palavras\s*)?(?:ou mais|\+)/i);
  if (more) return { min: num(more[1]), max: Infinity };
  return null;
}

export function wordsNote(count: number, range: WordRange, sourceTitle: string): string {
  const asked = range.max === Infinity ? `${range.min} ou mais` : `${range.min} a ${range.max}`;
  const base = `Texto "${sourceTitle}": ${count} palavras (contagem do sistema). Extensão pedida: ${asked} palavras.`;
  if (count < range.min * 0.9) return `${base} RESULTADO: ABAIXO da faixa. O texto está curto demais ou foi cortado; é preciso conferir se está inteiro.`;
  if (count < range.min) return `${base} RESULTADO: um pouco abaixo da faixa.`;
  if (count > range.max * 1.1) return `${base} RESULTADO: ACIMA da faixa. É preciso cortar.`;
  if (count > range.max) return `${base} RESULTADO: um pouco acima da faixa.`;
  return `${base} RESULTADO: dentro da faixa.`;
}
