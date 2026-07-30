// Keeps CHANGELOG.md and the Oraculo agent's knowledge block in sync with
// pushes to main. Runs from .github/workflows/doc-oracle-sync.yml.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// Google's OpenAI-compatible endpoint (same one the app itself uses for the
// "google" provider — see supabase/functions/_shared/llmProvider.ts). Avoids
// needing a paid ANTHROPIC_API_KEY secret just for this CI automation.
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";

const REPO_ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BEFORE_SHA = process.env.SYNC_BEFORE_SHA;
const AFTER_SHA = process.env.SYNC_AFTER_SHA;
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, real date — never trust the model for this

const CHANGELOG_PATH = path.join(REPO_ROOT, "CHANGELOG.md");
const AGENT_CHAT_PATH = path.join(
  REPO_ROOT,
  "supabase/functions/agent-chat/index.ts"
);
const KB_START = "<CONHECIMENTO_DO_SISTEMA>";
const KB_END = "</CONHECIMENTO_DO_SISTEMA>";

const DIFF_PATHS = [
  "src/App.tsx",
  "src/pages",
  "src/components/layout",
  "src/components/oraculo",
  "src/data/docSections.tsx",
  "supabase/functions",
  "supabase/migrations",
];
const MAX_DIFF_CHARS = 60000;

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const marker = `sync_${Math.random().toString(36).slice(2)}`;
  writeFileSync(
    file,
    `${name}<<${marker}\n${value}\n${marker}\n`,
    { flag: "a" }
  );
}

function getDiff() {
  if (!BEFORE_SHA || !AFTER_SHA || /^0+$/.test(BEFORE_SHA)) {
    // First push to the branch (no "before" commit) — diff against the empty tree.
    const empty = git(["hash-object", "-t", "tree", "/dev/null"]).trim();
    return git(["diff", empty, AFTER_SHA, "--", ...DIFF_PATHS]);
  }
  return git(["diff", BEFORE_SHA, AFTER_SHA, "--", ...DIFF_PATHS]);
}

function extractBlock(source, start, end) {
  const startIdx = source.indexOf(start);
  const endIdx = source.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
  return {
    before: source.slice(0, startIdx + start.length),
    content: source.slice(startIdx + start.length, endIdx),
    after: source.slice(endIdx),
  };
}

async function main() {
  let diff = getDiff();
  if (!diff || !diff.trim()) {
    console.log("No relevant diff — nothing to sync.");
    setOutput("changed", "false");
    return;
  }
  let truncated = false;
  if (diff.length > MAX_DIFF_CHARS) {
    diff = diff.slice(0, MAX_DIFF_CHARS);
    truncated = true;
  }

  const agentChatSource = readFileSync(AGENT_CHAT_PATH, "utf8");
  const kbBlock = extractBlock(agentChatSource, KB_START, KB_END);
  if (!kbBlock) {
    throw new Error(
      `Could not find ${KB_START} / ${KB_END} markers in ${AGENT_CHAT_PATH} — the Oraculo prompt structure changed; skipping oracle sync, fix markers manually.`
    );
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set (repo secret missing).");
  }

  const tool = {
    type: "function",
    function: {
      name: "sync_docs",
      description:
        "Report the changelog entry for this diff and whether the Oraculo agent's system-knowledge block needs updating.",
      parameters: {
        type: "object",
        properties: {
          changelog_entry: {
            type: "string",
            description:
              "Concise changelog body in pt-BR Markdown (bullet list, no heading/date — the script adds those). Describe the change from a product perspective (what a user or admin would notice), not a line-by-line code diff. If the diff is purely internal/refactor with no product impact, say so briefly.",
          },
          oracle_needs_update: {
            type: "boolean",
            description:
              "True only if the diff changes something the Oraculo's CONHECIMENTO_DO_SISTEMA block currently describes or should describe: routes, page locations, how a module is accessed, or a described feature's behavior. False for internal refactors, styling, or backend changes invisible to the end user.",
          },
          oracle_new_block: {
            type: "string",
            description:
              "REQUIRED when oracle_needs_update is true, omitted otherwise. The FULL replacement text for the knowledge block (everything that goes between the <CONHECIMENTO_DO_SISTEMA> and </CONHECIMENTO_DO_SISTEMA> markers, exclusive of the markers themselves). Must be the complete block with your edits merged in — not just the changed lines — preserving the existing Markdown structure, headings and style. Only change what the diff actually justifies; do not invent routes or features not present in the code.",
          },
        },
        required: ["changelog_entry", "oracle_needs_update"],
      },
    },
  };

  const system = `Você mantém a documentação e o agente "Oráculo" da plataforma Agentes Posológicos sincronizados com o código real.
Hoje é ${TODAY}. Você recebe um diff git de um push recente para a branch main.

O bloco abaixo é o conteúdo ATUAL do CONHECIMENTO_DO_SISTEMA do Oráculo (delimitado por <CONHECIMENTO_DO_SISTEMA>...</CONHECIMENTO_DO_SISTEMA> no arquivo supabase/functions/agent-chat/index.ts). Ele descreve rotas, módulos e funcionalidades da plataforma para o agente que orienta os usuários.

<CONHECIMENTO_DO_SISTEMA>
${kbBlock.content}
</CONHECIMENTO_DO_SISTEMA>

Analise o diff fornecido e chame a ferramenta sync_docs com:
1. Um changelog conciso (pt-BR) do que mudou, do ponto de vista do produto.
2. Se o bloco de conhecimento do Oráculo ficou desatualizado (rota nova/renomeada, página movida, funcionalidade descrita de forma diferente do código atual) e, se sim, o bloco COMPLETO já corrigido.

Nunca invente rotas, telas ou funcionalidades que não estejam no diff ou no bloco atual. Se o diff não afeta nada do que o Oráculo descreve, responda oracle_needs_update: false.`;

  const resp = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Diff (${truncated ? "truncado, " : ""}caminhos: ${DIFF_PATHS.join(", ")}):\n\n\`\`\`diff\n${diff}\n\`\`\``,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "sync_docs" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("Model did not return the expected sync_docs tool call.");
  }
  let result;
  try {
    result = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error(`Model returned invalid JSON in tool call arguments: ${toolCall.function.arguments}`);
  }

  // 1) Changelog — insert dated entry right after the automation marker.
  const changelog = readFileSync(CHANGELOG_PATH, "utf8");
  const marker = "<!-- ENTRADAS_AUTOMATICAS -->";
  const markerIdx = changelog.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(`Marker "${marker}" not found in ${CHANGELOG_PATH}`);
  }
  const insertAt = markerIdx + marker.length;
  const entry = `\n\n## ${TODAY}\n\n${result.changelog_entry.trim()}\n`;
  const newChangelog =
    changelog.slice(0, insertAt) + entry + changelog.slice(insertAt);
  writeFileSync(CHANGELOG_PATH, newChangelog);

  // 2) Oraculo knowledge block — replace only the fenced region, in place.
  let oracleUpdated = false;
  if (result.oracle_needs_update && result.oracle_new_block) {
    const newBlock = result.oracle_new_block;
    if (newBlock.includes(KB_START) || newBlock.includes(KB_END)) {
      console.warn(
        "Model output contained marker strings inside the replacement block — skipping oracle update for safety."
      );
    } else {
      const newAgentChatSource =
        kbBlock.before + newBlock + kbBlock.after;
      writeFileSync(AGENT_CHAT_PATH, newAgentChatSource);
      oracleUpdated = true;
    }
  }

  setOutput("changed", "true");
  setOutput("oracle_updated", String(oracleUpdated));
  setOutput(
    "pr_body",
    [
      "Atualização automática de documentação gerada pelo workflow `doc-oracle-sync`.",
      "",
      `**Changelog adicionado (${TODAY}):**`,
      result.changelog_entry.trim(),
      "",
      oracleUpdated
        ? "**Oráculo:** o bloco de conhecimento do sistema (`CONHECIMENTO_DO_SISTEMA` em `supabase/functions/agent-chat/index.ts`) foi atualizado para refletir esta mudança."
        : "**Oráculo:** nenhuma atualização necessária no conhecimento do sistema para esta mudança.",
      "",
      "Revise antes de fazer merge — o conteúdo foi gerado por IA a partir do diff do push.",
    ].join("\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
