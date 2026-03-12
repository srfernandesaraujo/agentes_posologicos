import { useMemo } from "react";

interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  level: number;
  emoji?: string;
}

// Color palettes for different branch levels
const BRANCH_COLORS = [
  { bg: "rgba(45, 212, 191, 0.15)", border: "rgba(45, 212, 191, 0.5)", text: "#2dd4bf", line: "rgba(45, 212, 191, 0.4)" },
  { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.5)", text: "#a855f7", line: "rgba(168, 85, 247, 0.4)" },
  { bg: "rgba(251, 146, 60, 0.15)", border: "rgba(251, 146, 60, 0.5)", text: "#fb923c", line: "rgba(251, 146, 60, 0.4)" },
  { bg: "rgba(96, 165, 250, 0.15)", border: "rgba(96, 165, 250, 0.5)", text: "#60a5fa", line: "rgba(96, 165, 250, 0.4)" },
  { bg: "rgba(244, 114, 182, 0.15)", border: "rgba(244, 114, 182, 0.5)", text: "#f472b6", line: "rgba(244, 114, 182, 0.4)" },
  { bg: "rgba(74, 222, 128, 0.15)", border: "rgba(74, 222, 128, 0.5)", text: "#4ade80", line: "rgba(74, 222, 128, 0.4)" },
];

function extractEmoji(text: string): { emoji: string; clean: string } {
  const emojiRegex = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}✅📌🧠💊🔬📊⚡🎯💡🔑🎓📝🏥💉🩺🧪📋⚠️🌟✨🔥💪🧬🩸📈🔴🟢🟡🔵⭐➡️])\s*/u;
  const match = text.match(emojiRegex);
  if (match) {
    return { emoji: match[1], clean: text.slice(match[0].length).trim() };
  }
  return { emoji: "", clean: text.trim() };
}

function parseMindMapText(text: string): MindMapNode | null {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 3) return null;

  let rootLabel = "";
  let rootEmoji = "";
  const topLevelNodes: MindMapNode[] = [];
  let currentL1: MindMapNode | null = null;
  let currentL2: MindMapNode | null = null;
  let currentL3: MindMapNode | null = null;
  let nodeId = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect tree branch characters
    const hasBranch = /[├└│|]──|[├└│|]—|[├└]/.test(rawLine);
    const indent = rawLine.search(/\S/);
    
    // Clean line of tree characters
    const cleanLine = line
      .replace(/^[│|]\s*/, "")
      .replace(/^[├└]──\s*/, "")
      .replace(/^[├└]—\s*/, "")
      .replace(/^[-•▸►]\s*/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .trim();

    if (!cleanLine) continue;

    const { emoji, clean } = extractEmoji(cleanLine);

    // Root detection: first significant line or line with brain emoji
    if (!rootLabel && (line.includes("🧠") || line.includes("📌") || (!hasBranch && indent < 4))) {
      rootLabel = clean || cleanLine;
      rootEmoji = emoji || "🧠";
      continue;
    }

    // Level detection based on indent and branch characters
    if (!hasBranch && indent < 6 && cleanLine.length > 3) {
      // Top-level section header
      const { emoji: e, clean: c } = extractEmoji(cleanLine);
      currentL1 = { id: `n${nodeId++}`, label: c || cleanLine, emoji: e, children: [], level: 1 };
      currentL2 = null;
      currentL3 = null;
      topLevelNodes.push(currentL1);
      continue;
    }

    if (hasBranch || indent >= 4) {
      const depthIndicator = (rawLine.match(/│/g) || []).length + (indent > 12 ? 2 : indent > 6 ? 1 : 0);
      
      if (depthIndicator >= 2 || indent > 12) {
        // Level 3+
        const node: MindMapNode = { id: `n${nodeId++}`, label: clean || cleanLine, emoji, children: [], level: 3 };
        if (currentL2) {
          currentL2.children.push(node);
        } else if (currentL1) {
          currentL1.children.push(node);
        }
        currentL3 = node;
      } else if (depthIndicator >= 1 || indent > 6) {
        // Level 2
        const node: MindMapNode = { id: `n${nodeId++}`, label: clean || cleanLine, emoji, children: [], level: 2 };
        if (currentL1) {
          currentL1.children.push(node);
        } else {
          topLevelNodes.push(node);
        }
        currentL2 = node;
        currentL3 = null;
      } else {
        // Level 1 branch
        const node: MindMapNode = { id: `n${nodeId++}`, label: clean || cleanLine, emoji, children: [], level: 1 };
        if (currentL1) {
          currentL1.children.push(node);
        } else {
          topLevelNodes.push(node);
        }
        currentL2 = node;
        currentL3 = null;
      }
    }
  }

  if (!rootLabel && topLevelNodes.length > 0) {
    rootLabel = "Mapa Mental";
    rootEmoji = "🧠";
  }

  if (!rootLabel) return null;

  return {
    id: "root",
    label: rootLabel,
    emoji: rootEmoji,
    children: topLevelNodes,
    level: 0,
  };
}

function MindMapNodeComponent({
  node,
  colorIndex = 0,
  isRoot = false,
}: {
  node: MindMapNode;
  colorIndex?: number;
  isRoot?: boolean;
}) {
  const color = BRANCH_COLORS[colorIndex % BRANCH_COLORS.length];

  if (isRoot) {
    return (
      <div className="flex flex-col items-center gap-6">
        {/* Root node */}
        <div className="relative px-6 py-4 rounded-2xl border-2 border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/20 shadow-lg shadow-[hsl(var(--accent))]/10 max-w-md text-center">
          <span className="text-2xl mr-2">{node.emoji}</span>
          <span className="text-base font-bold text-white leading-tight">{node.label}</span>
        </div>

        {/* Branches */}
        {node.children.length > 0 && (
          <div className="relative w-full">
            {/* Vertical connector from root */}
            <div className="absolute left-1/2 -top-6 w-px h-6 bg-white/20" />
            
            <div className="grid gap-4" style={{
              gridTemplateColumns: `repeat(${Math.min(node.children.length, 3)}, 1fr)`,
            }}>
              {node.children.map((child, i) => (
                <MindMapNodeComponent key={child.id} node={child} colorIndex={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Branch node */}
      <div
        className="rounded-xl px-4 py-3 border transition-all hover:scale-[1.02]"
        style={{
          backgroundColor: color.bg,
          borderColor: color.border,
        }}
      >
        <div className="flex items-start gap-2">
          {node.emoji && <span className="text-lg shrink-0 mt-0.5">{node.emoji}</span>}
          <span className="text-sm font-semibold leading-snug" style={{ color: color.text }}>
            {node.label}
          </span>
        </div>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="ml-3 pl-3 space-y-1.5" style={{ borderLeft: `2px solid ${color.line}` }}>
          {node.children.map((child, i) => (
            <div key={child.id} className="relative">
              {/* Horizontal connector */}
              <div
                className="absolute -left-3 top-3 w-3 h-px"
                style={{ backgroundColor: color.line }}
              />
              {child.children.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <div
                    className="rounded-lg px-3 py-2 text-xs font-medium border"
                    style={{
                      backgroundColor: color.bg,
                      borderColor: `${color.border}80`,
                      color: color.text,
                    }}
                  >
                    {child.emoji && <span className="mr-1">{child.emoji}</span>}
                    {child.label}
                  </div>
                  <div className="ml-3 pl-3 space-y-1" style={{ borderLeft: `1px dashed ${color.line}` }}>
                    {child.children.map((grandchild) => (
                      <div key={grandchild.id} className="relative">
                        <div
                          className="absolute -left-3 top-2 w-3 h-px"
                          style={{ backgroundColor: color.line }}
                        />
                        <div className="rounded-md px-2.5 py-1.5 text-xs text-white/70 bg-white/5 border border-white/10">
                          {grandchild.emoji && <span className="mr-1">{grandchild.emoji}</span>}
                          {grandchild.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md px-3 py-2 text-xs text-white/70 bg-white/5 border border-white/10">
                  {child.emoji && <span className="mr-1">{child.emoji}</span>}
                  {child.label}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function detectMindMap(text: string): boolean {
  // Check if text has mind map tree structure
  const treeChars = (text.match(/[├└│]──|[├└│]—/g) || []).length;
  const hasEmoji = /🧠|📌/.test(text);
  return treeChars >= 3 || (hasEmoji && treeChars >= 2);
}

export default function MindMapRenderer({ content }: { content: string }) {
  const tree = useMemo(() => parseMindMapText(content), [content]);

  if (!tree || tree.children.length === 0) {
    return null;
  }

  return (
    <div className="my-4 p-6 rounded-2xl bg-gradient-to-br from-[hsl(220,25%,8%)] to-[hsl(220,25%,12%)] border border-white/10 shadow-xl overflow-x-auto">
      <MindMapNodeComponent node={tree} isRoot />
    </div>
  );
}
