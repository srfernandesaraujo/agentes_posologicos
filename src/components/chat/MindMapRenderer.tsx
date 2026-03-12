import { useMemo, useRef, useEffect, useState, useCallback } from "react";

interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  level: number;
  emoji?: string;
}

interface LayoutNode {
  id: string;
  label: string;
  emoji?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  colorIdx: number;
  level: number;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  side: "left" | "right";
}

const PALETTE = [
  { node: "#7c6bc4", border: "#6b5aad", line: "#7c6bc4", bg: "#e8e0f7" },
  { node: "#a68b6e", border: "#8e7660", line: "#a68b6e", bg: "#f0e6d8" },
  { node: "#5a9e6f", border: "#4a8a5e", line: "#5a9e6f", bg: "#d8f0e0" },
  { node: "#c4697c", border: "#ad5a6b", line: "#c4697c", bg: "#f7e0e8" },
  { node: "#6b8ec4", border: "#5a7aad", line: "#6b8ec4", bg: "#e0e8f7" },
  { node: "#c49e6b", border: "#ad8a5a", line: "#c49e6b", bg: "#f7f0e0" },
];

const NODE_H = 34;
const NODE_PAD_X = 20;
const NODE_PAD_Y = 10;
const LEVEL_GAP_X = 160;
const SIBLING_GAP_Y = 8;
const ROOT_W = 200;
const ROOT_H = 44;
const CHAR_W = 7.2;
const MIN_NODE_W = 80;
const MAX_NODE_W = 220;

function measureText(text: string): number {
  return Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, text.length * CHAR_W + NODE_PAD_X * 2));
}

function extractEmoji(text: string): { emoji: string; clean: string } {
  const emojiRegex = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}✅📌🧠💊🔬📊⚡🎯💡🔑🎓📝🏥💉🩺🧪📋⚠️🌟✨🔥💪🧬🩸📈🔴🟢🟡🔵⭐➡️])\s*/u;
  const match = text.match(emojiRegex);
  if (match) return { emoji: match[1], clean: text.slice(match[0].length).trim() };
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
  let nodeId = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const hasBranch = /[├└│|]──|[├└│|]—|[├└]/.test(rawLine);
    const indent = rawLine.search(/\S/);

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

    if (!rootLabel && (line.includes("🧠") || line.includes("📌") || (!hasBranch && indent < 4))) {
      rootLabel = clean || cleanLine;
      rootEmoji = emoji || "🧠";
      continue;
    }

    if (!hasBranch && indent < 6 && cleanLine.length > 3) {
      const { emoji: e, clean: c } = extractEmoji(cleanLine);
      currentL1 = { id: `n${nodeId++}`, label: c || cleanLine, emoji: e, children: [], level: 1 };
      currentL2 = null;
      topLevelNodes.push(currentL1);
      continue;
    }

    if (hasBranch || indent >= 4) {
      const depthIndicator = (rawLine.match(/│/g) || []).length + (indent > 12 ? 2 : indent > 6 ? 1 : 0);

      if (depthIndicator >= 2 || indent > 12) {
        const node: MindMapNode = { id: `n${nodeId++}`, label: clean || cleanLine, emoji, children: [], level: 3 };
        if (currentL2) currentL2.children.push(node);
        else if (currentL1) currentL1.children.push(node);
      } else if (depthIndicator >= 1 || indent > 6) {
        const node: MindMapNode = { id: `n${nodeId++}`, label: clean || cleanLine, emoji, children: [], level: 2 };
        if (currentL1) currentL1.children.push(node);
        else topLevelNodes.push(node);
        currentL2 = node;
      } else {
        const node: MindMapNode = { id: `n${nodeId++}`, label: clean || cleanLine, emoji, children: [], level: 1 };
        if (currentL1) currentL1.children.push(node);
        else topLevelNodes.push(node);
        currentL2 = node;
      }
    }
  }

  if (!rootLabel && topLevelNodes.length > 0) {
    rootLabel = "Mapa Mental";
    rootEmoji = "🧠";
  }
  if (!rootLabel) return null;

  return { id: "root", label: rootLabel, emoji: rootEmoji, children: topLevelNodes, level: 0 };
}

// Recursively compute subtree height
function subtreeHeight(node: MindMapNode): number {
  if (node.children.length === 0) return NODE_H;
  let total = 0;
  for (const c of node.children) {
    total += subtreeHeight(c);
  }
  total += (node.children.length - 1) * SIBLING_GAP_Y;
  return total;
}

// Layout nodes in a horizontal tree
function layoutTree(
  node: MindMapNode,
  x: number,
  yCenter: number,
  side: "left" | "right",
  colorIdx: number,
  level: number
): LayoutNode {
  const w = level === 0 ? ROOT_W : measureText(node.label);
  const h = level === 0 ? ROOT_H : NODE_H;

  const layoutChildren: LayoutNode[] = [];
  if (node.children.length > 0) {
    const childX = side === "right" ? x + w + LEVEL_GAP_X : x - LEVEL_GAP_X;
    const totalH = node.children.reduce((s, c) => s + subtreeHeight(c), 0) + (node.children.length - 1) * SIBLING_GAP_Y;
    let currentY = yCenter - totalH / 2;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childH = subtreeHeight(child);
      const childCenter = currentY + childH / 2;
      const childW = measureText(child.label);
      const childXPos = side === "right" ? childX : childX - childW;
      layoutChildren.push(layoutTree(child, childXPos, childCenter, side, colorIdx, level + 1));
      currentY += childH + SIBLING_GAP_Y;
    }
  }

  return {
    id: node.id,
    label: node.label,
    emoji: node.emoji,
    x,
    y: yCenter - h / 2,
    width: w,
    height: h,
    children: layoutChildren,
    colorIdx,
    level,
  };
}

function collectEdges(node: LayoutNode, side: "left" | "right", edges: Edge[]) {
  const palette = PALETTE[node.colorIdx % PALETTE.length];
  for (const child of node.children) {
    const parentCx = side === "right" ? node.x + node.width : node.x;
    const parentCy = node.y + node.height / 2;
    const childCx = side === "right" ? child.x : child.x + child.width;
    const childCy = child.y + child.height / 2;
    edges.push({ x1: parentCx, y1: parentCy, x2: childCx, y2: childCy, color: palette.line, side });
    collectEdges(child, side, edges);
  }
}

function collectNodes(node: LayoutNode, list: LayoutNode[]) {
  list.push(node);
  for (const child of node.children) collectNodes(child, list);
}

function getBounds(nodes: LayoutNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { minX, minY, maxX, maxY };
}

export function detectMindMap(text: string): boolean {
  const treeChars = (text.match(/[├└│]──|[├└│]—/g) || []).length;
  const hasEmoji = /🧠|📌/.test(text);
  return treeChars >= 3 || (hasEmoji && treeChars >= 2);
}

export default function MindMapRenderer({ content }: { content: string }) {
  const tree = useMemo(() => parseMindMapText(content), [content]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.85);

  const layout = useMemo(() => {
    if (!tree || tree.children.length === 0) return null;

    // Split children into left and right halves
    const half = Math.ceil(tree.children.length / 2);
    const rightChildren = tree.children.slice(0, half);
    const leftChildren = tree.children.slice(half);

    const rootX = -ROOT_W / 2;
    const rootY = -ROOT_H / 2;

    // Layout right side
    const rightLayouts: LayoutNode[] = [];
    {
      const totalH = rightChildren.reduce((s, c) => s + subtreeHeight(c), 0) + Math.max(0, rightChildren.length - 1) * SIBLING_GAP_Y;
      let currentY = -totalH / 2;
      rightChildren.forEach((child, i) => {
        const h = subtreeHeight(child);
        const center = currentY + h / 2;
        const w = measureText(child.label);
        const x = ROOT_W / 2 + LEVEL_GAP_X;
        rightLayouts.push(layoutTree(child, x, center, "right", i, 1));
        currentY += h + SIBLING_GAP_Y;
      });
    }

    // Layout left side
    const leftLayouts: LayoutNode[] = [];
    {
      const totalH = leftChildren.reduce((s, c) => s + subtreeHeight(c), 0) + Math.max(0, leftChildren.length - 1) * SIBLING_GAP_Y;
      let currentY = -totalH / 2;
      leftChildren.forEach((child, i) => {
        const h = subtreeHeight(child);
        const center = currentY + h / 2;
        const w = measureText(child.label);
        const x = -ROOT_W / 2 - LEVEL_GAP_X - w;
        leftLayouts.push(layoutTree(child, x, center, "left", half + i, 1));
        currentY += h + SIBLING_GAP_Y;
      });
    }

    // Collect all edges
    const edges: Edge[] = [];
    const rootNode: LayoutNode = {
      id: "root", label: tree.label, emoji: tree.emoji,
      x: rootX, y: rootY, width: ROOT_W, height: ROOT_H,
      children: [], colorIdx: 0, level: 0,
    };

    // Root to right
    for (const rn of rightLayouts) {
      const palette = PALETTE[rn.colorIdx % PALETTE.length];
      edges.push({
        x1: ROOT_W / 2, y1: 0,
        x2: rn.x, y2: rn.y + rn.height / 2,
        color: palette.line, side: "right",
      });
      collectEdges(rn, "right", edges);
    }

    // Root to left
    for (const ln of leftLayouts) {
      const palette = PALETTE[ln.colorIdx % PALETTE.length];
      edges.push({
        x1: -ROOT_W / 2, y1: 0,
        x2: ln.x + ln.width, y2: ln.y + ln.height / 2,
        color: palette.line, side: "left",
      });
      collectEdges(ln, "left", edges);
    }

    // Collect all nodes
    const allNodes: LayoutNode[] = [rootNode];
    for (const rn of rightLayouts) collectNodes(rn, allNodes);
    for (const ln of leftLayouts) collectNodes(ln, allNodes);

    const bounds = getBounds(allNodes);
    const pad = 60;
    const viewBox = {
      x: bounds.minX - pad,
      y: bounds.minY - pad,
      w: bounds.maxX - bounds.minX + pad * 2,
      h: bounds.maxY - bounds.minY + pad * 2,
    };

    return { rootNode, allNodes, edges, viewBox };
  }, [tree]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setScale(s => Math.max(0.3, Math.min(2, s + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  if (!layout) return null;

  const { allNodes, edges, viewBox } = layout;

  return (
    <div className="my-4 rounded-2xl border border-border/50 shadow-xl overflow-hidden bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--muted))]">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/30">
        <span className="text-xs text-muted-foreground font-medium">🧠 Mapa Mental Interativo</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(s => Math.max(0.3, s - 0.15))}
            className="w-7 h-7 rounded-lg bg-background border border-border text-foreground text-sm font-bold hover:bg-accent/20 transition-colors"
          >−</button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(2, s + 0.15))}
            className="w-7 h-7 rounded-lg bg-background border border-border text-foreground text-sm font-bold hover:bg-accent/20 transition-colors"
          >+</button>
          <button
            onClick={() => { setScale(0.85); setOffset({ x: 0, y: 0 }); }}
            className="ml-1 px-2 h-7 rounded-lg bg-background border border-border text-xs text-muted-foreground hover:bg-accent/20 transition-colors"
          >Reset</button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="relative select-none"
        style={{
          height: Math.min(600, Math.max(400, viewBox.h * 0.7)),
          cursor: isDragging ? "grabbing" : "grab",
          overflow: "hidden",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
            <filter id="rootGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#4ade80" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Edges with cubic bezier curves */}
          {edges.map((edge, i) => {
            const dx = Math.abs(edge.x2 - edge.x1) * 0.55;
            const cp1x = edge.side === "right" ? edge.x1 + dx : edge.x1 - dx;
            const cp2x = edge.side === "right" ? edge.x2 - dx : edge.x2 + dx;
            const path = `M ${edge.x1} ${edge.y1} C ${cp1x} ${edge.y1}, ${cp2x} ${edge.y2}, ${edge.x2} ${edge.y2}`;
            return (
              <path
                key={`e${i}`}
                d={path}
                fill="none"
                stroke={edge.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })}

          {/* Nodes */}
          {allNodes.map((node) => {
            const isRoot = node.level === 0;
            const palette = PALETTE[node.colorIdx % PALETTE.length];
            const rx = isRoot ? 22 : 16;

            if (isRoot) {
              return (
                <g key={node.id} filter="url(#rootGlow)">
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={rx}
                    fill="#22c55e"
                    stroke="#16a34a"
                    strokeWidth={2}
                  />
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + node.height / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={13}
                    fontWeight={700}
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {node.label.length > 28 ? node.label.slice(0, 26) + "…" : node.label}
                  </text>
                </g>
              );
            }

            return (
              <g key={node.id} filter="url(#nodeShadow)">
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={rx}
                  fill={palette.bg}
                  stroke={palette.border}
                  strokeWidth={1.5}
                />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={palette.node}
                  fontSize={node.level === 1 ? 11.5 : 10.5}
                  fontWeight={node.level === 1 ? 600 : 500}
                  fontFamily="'Inter', sans-serif"
                >
                  {node.label.length > 30 ? node.label.slice(0, 28) + "…" : node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
