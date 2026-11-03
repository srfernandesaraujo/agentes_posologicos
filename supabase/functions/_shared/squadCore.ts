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

export interface TemplateStep {
  agent: string;
  title: string;
  instructions: string;
  deliverable?: DeliverableSpec;
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
}

export interface PlannedTask {
  position: number;
  agentSlug: string;
  title: string;
  instructions: string;
  /** Posição da tarefa de que esta depende (null na primeira). Pipeline sequencial na Fase 0. */
  dependsOnPosition: number | null;
  deliverable: DeliverableSpec | null;
}

export function planTasks(template: SquadTemplate): PlannedTask[] {
  const slugs = new Set(template.agents.map((a) => a.slug));
  return template.steps.map((s, i) => {
    if (!slugs.has(s.agent)) {
      throw new Error(`Template ${template.slug}: etapa "${s.title}" usa agente inexistente "${s.agent}"`);
    }
    return {
      position: i,
      agentSlug: s.agent,
      title: s.title,
      instructions: s.instructions,
      dependsOnPosition: i === 0 ? null : i - 1,
      deliverable: s.deliverable ?? null,
    };
  });
}

// ---------- Escolha da próxima tarefa ----------

export interface TaskLite {
  id: string;
  position: number;
  status: "pending" | "running" | "done" | "failed";
  depends_on_position: number | null;
}

export type NextTask =
  | { kind: "task"; task: TaskLite }
  | { kind: "busy" } // já existe uma tarefa em execução
  | { kind: "failed" }
  | { kind: "finished" };

export function pickNextTask(tasks: TaskLite[]): NextTask {
  if (tasks.some((t) => t.status === "failed")) return { kind: "failed" };
  if (tasks.some((t) => t.status === "running")) return { kind: "busy" };
  if (tasks.length > 0 && tasks.every((t) => t.status === "done")) return { kind: "finished" };
  const byPos = new Map(tasks.map((t) => [t.position, t]));
  const ordered = [...tasks].sort((a, b) => a.position - b.position);
  for (const t of ordered) {
    if (t.status !== "pending") continue;
    const dep = t.depends_on_position;
    if (dep == null || byPos.get(dep)?.status === "done") return { kind: "task", task: t };
  }
  return { kind: "busy" };
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

const MAX_PREV_CHARS = 6000;

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
}): string {
  const parts: string[] = [];
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
  parts.push(`# Sua tarefa agora: ${p.step.title}\n${p.step.instructions.trim()}`);
  return parts.join("\n\n");
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
