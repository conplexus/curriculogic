/// <reference lib="webworker" />
// src/workers/layoutWorker.ts
import dagre from "dagre";

type WNode = { id: string; width: number; height: number; rank?: number };
type WEdge = { source: string; target: string };
type Req = {
  nodes: WNode[];
  edges: WEdge[];
  options?: { rankdir?: "LR" | "TB"; nodesep?: number; ranksep?: number };
};
type Res = { positions: Record<string, { x: number; y: number }> };

self.onmessage = (evt: MessageEvent<Req>) => {
  const { nodes, edges, options } = evt.data;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options?.rankdir ?? "LR",
    nodesep: options?.nodesep ?? 48,
    ranksep: options?.ranksep ?? 120,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, {
      width: n.width,
      height: n.height,
      rank: n.rank ?? 0,
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const positions: Res["positions"] = {};
  for (const n of nodes) {
    const p = g.node(n.id);
    positions[n.id] = { x: p.x - n.width / 2, y: p.y - n.height / 2 };
  }

  (self as any).postMessage({ positions } as Res);
};
