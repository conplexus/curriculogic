/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import dagre from "dagre";

// Let TS know we’re in a worker
declare const self: DedicatedWorkerGlobalScope;
export {};

type InNode = {
  id: string;
  width: number;
  height: number;
  rank: number;
};
type InEdge = { source: string; target: string };
type InMsg = {
  nodes: InNode[];
  edges: InEdge[];
  options?: { rankdir?: "LR" | "TB"; nodesep?: number; ranksep?: number };
};

self.onmessage = (event: MessageEvent<InMsg>) => {
  const { nodes, edges, options } = event.data;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options?.rankdir ?? "LR",
    nodesep: options?.nodesep ?? 48,
    ranksep: options?.ranksep ?? 120,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    // dagre reads width/height; ‘rank’ can be used via layering if needed
    g.setNode(n.id, { width: n.width, height: n.height, rank: n.rank });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  // Return a positions map keyed by node id
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const p = g.node(n.id);
    positions[n.id] = { x: p.x - (g.node(n.id).width ?? 0) / 2, y: p.y - (g.node(n.id).height ?? 0) / 2 };
  }

  self.postMessage({ positions });
};
