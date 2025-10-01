// src/lib/layout.ts
import dagre from "dagre";
import type { Node as RFNode, Edge as RFEdge } from "reactflow";

export const NODE_W = 320;
export const NODE_H = 132;
export const RANKSEP = 120;
export const NODESEP = 48;

export const typeRank: Record<string, number> = {
  standard: 0,
  course: 1,
  objective: 2,
  assessment: 3,
  question: 4,
};

export function layoutSync(nodes: RFNode[], edges: RFEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: NODESEP, ranksep: RANKSEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const rankKey = (n.data as any)?.kind || (n.data as any)?.type || n.type;
    g.setNode(n.id, { width: NODE_W, height: NODE_H, rank: typeRank[rankKey] ?? 99 });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    n.position = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 };
    n.style = { ...(n.style || {}), width: NODE_W, height: NODE_H };
    return n;
  });
}
