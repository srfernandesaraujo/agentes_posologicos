import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface N { id: string; flow_id: string; position_x: number; position_y: number; sort_order: number; is_synthesizer: boolean }
interface E { flow_id: string; source_node_id: string; target_node_id: string }

/** Nós e arestas de vários fluxos de uma vez (para desenhar as miniaturas). */
export function useFlowGraphs(flowIds: string[]) {
  const key = [...flowIds].sort();
  return useQuery({
    queryKey: ["flow-graphs", key],
    enabled: key.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [n, e] = await Promise.all([
        supabase.from("agent_flow_nodes").select("id, flow_id, position_x, position_y, sort_order, is_synthesizer").in("flow_id", key),
        supabase.from("agent_flow_edges").select("flow_id, source_node_id, target_node_id").in("flow_id", key),
      ]);
      const nodes = new Map<string, N[]>();
      const edges = new Map<string, E[]>();
      ((n.data || []) as N[]).forEach((x) => nodes.set(x.flow_id, [...(nodes.get(x.flow_id) || []), x]));
      ((e.data || []) as E[]).forEach((x) => edges.set(x.flow_id, [...(edges.get(x.flow_id) || []), x]));
      return { nodes, edges };
    },
  });
}

/** Miniatura do desenho do fluxo, com pontos correndo pelas ligações. */
export function FlowThumb({ nodes = [], edges = [] }: { nodes?: N[]; edges?: E[] }) {
  const W = 240, H = 84, pad = 14;
  const { pts, links } = useMemo(() => {
    const ns = [...nodes].sort((a, b) => a.sort_order - b.sort_order);
    if (ns.length === 0) return { pts: [] as { id: string; x: number; y: number; syn: boolean }[], links: [] as [number, number][] };
    const xs = ns.map((n) => n.position_x), ys = ns.map((n) => n.position_y);
    const spreadX = Math.max(...xs) - Math.min(...xs), spreadY = Math.max(...ys) - Math.min(...ys);
    const useGrid = spreadX + spreadY < 1; // sem posições salvas: distribui em linha
    const pts = ns.map((n, i) => ({
      id: n.id,
      syn: n.is_synthesizer,
      x: useGrid ? pad + (ns.length === 1 ? (W - 2 * pad) / 2 : (i / (ns.length - 1)) * (W - 2 * pad)) : pad + ((n.position_x - Math.min(...xs)) / (spreadX || 1)) * (W - 2 * pad),
      y: useGrid ? H / 2 : pad + ((n.position_y - Math.min(...ys)) / (spreadY || 1)) * (H - 2 * pad),
    }));
    const idx = new Map(pts.map((p, i) => [p.id, i]));
    let links = edges.map((e) => [idx.get(e.source_node_id), idx.get(e.target_node_id)] as const).filter((l): l is readonly [number, number] => l[0] !== undefined && l[1] !== undefined).map((l) => [l[0], l[1]] as [number, number]);
    if (links.length === 0) links = pts.slice(1).map((_, i) => [i, i + 1] as [number, number]);
    return { pts, links };
  }, [nodes, edges]);

  if (pts.length === 0) return <div className="grid h-[84px] place-items-center font-mono text-[11px] text-muted-foreground">fluxo vazio</div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[84px] w-full" role="img" aria-label={`Desenho do fluxo, ${pts.length} etapas`}>
      {links.map(([a, b], i) => (
        <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} stroke="hsl(var(--dom-equipes))" strokeOpacity=".7" strokeWidth="1.6" strokeDasharray="3 5" className="pos-flow-line" />
      ))}
      {pts.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r={p.syn ? 8 : 6} fill="hsl(var(--card))" stroke="hsl(var(--dom-equipes))" strokeWidth="2" />
          {p.syn && <circle cx={p.x} cy={p.y} r="3" fill="hsl(var(--dom-equipes))" />}
        </g>
      ))}
    </svg>
  );
}
