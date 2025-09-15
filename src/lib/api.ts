// src/lib/api.ts

// NEW: import canonical types + mappers
import type {
  RollupNode,
  RollupEdge,
  RollupResponse,
  DbNodeKind,
  NodeData,
} from "@/lib/types";
import { mapDbKindToUi } from "@/lib/types";


// ---------- Status / Rollup
export type Status = "GREEN" | "AMBER" | "RED" | "GRAY";

export type RollupNode = {
  id: string;           // stringified db id for ReactFlow
  label: string;        // UI label (from db.title)
  status: Status;       // if you compute/attach status later
  type?: string;        // "STANDARD" | "COURSE" | ...
};

export type RollupEdge = {
  id: string;
  source: string;
  target: string;
};

export type RollupResponse = {
  nodes: RollupNode[];
  edges: RollupEdge[];
  statusPalette?: Record<Status, string>;
};

// ---------- DB enums & payloads
export type NodeKind = DbNodeKind;

export type NodeCreateInput = {
  mapId: number;                 // REQUIRED (your schema)
  kind: NodeKind;
  title: string;
  code?: string;
  description?: string;
  x?: number;
  y?: number;
  meta?: Record<string, unknown>;
};

export type NodeUpdateInput = Partial<NodeCreateInput>;

export type NodeRow = {
  id: number;
  mapId: number;
  kind: NodeKind;
  title: string;
  code: string | null;
  description: string | null;
  x: string | null;              // numeric in db => returns as string
  y: string | null;
  meta: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EdgeCreateInput = {
  mapId: number;                 // REQUIRED
  sourceId: number;
  targetId: number;
  label?: string;
};

export type EdgeRow = {
  id: number;
  mapId: number;
  sourceId: number;
  targetId: number;
  label: string | null;
  createdAt?: string;
};

// ---------- Internal helpers
const DEFAULT_TIMEOUT_MS = 12_000;

function withTimeout(signal?: AbortSignal, ms = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Timeout", "TimeoutError")), ms);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", () => ctrl.abort(signal.reason), { once: true });
  }
  return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) };
}

async function readJsonSafe<T>(res: Response): Promise<T | undefined> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as any;
  try {
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

async function errorMessage(res: Response): Promise<string> {
  const data = await readJsonSafe<{ error?: string }>(res);
  return data?.error || res.statusText || String(res.status);
}

async function safeFetch<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs, ...rest } = init || {};
  const { signal, cleanup } = withTimeout(rest.signal, timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal });
    if (!res.ok) throw new Error(await errorMessage(res));
    const data = await readJsonSafe<T>(res);
    // @ts-expect-error allow undefined for 204
    return data ?? (undefined as T);
  } finally {
    cleanup();
  }
}

// ---------- Rollup (if you still have /api/rollup)
export async function getRollup(signal?: AbortSignal): Promise<RollupResponse> {
  return safeFetch<RollupResponse>("/api/rollup", { cache: "no-store", signal });
}

/* =========================
   Nodes (map-scoped)
   ========================= */

export async function listNodes(mapId: number, signal?: AbortSignal): Promise<NodeRow[]> {
  const u = new URLSearchParams({ mapId: String(mapId) }).toString();
  return safeFetch<NodeRow[]>(`/api/nodes?${u}`, { cache: "no-store", signal });
}

export async function createNode(input: NodeCreateInput, signal?: AbortSignal): Promise<NodeRow> {
  return safeFetch<NodeRow>("/api/nodes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal,
  });
}

export async function updateNode(
  id: number,
  input: NodeUpdateInput,
  signal?: AbortSignal
): Promise<NodeRow> {
  return safeFetch<NodeRow>(`/api/nodes/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal,
  });
}

export async function deleteNode(id: number, signal?: AbortSignal): Promise<{ ok: true }> {
  return safeFetch<{ ok: true }>(`/api/nodes/${id}`, {
    method: "DELETE",
    cache: "no-store",
    signal,
  });
}

/* =========================
   Edges (map-scoped)
   ========================= */

export async function listEdges(mapId: number, signal?: AbortSignal): Promise<EdgeRow[]> {
  return safeFetch<EdgeRow[]>(`/api/edges?mapId=${mapId}`, { cache: "no-store", signal });
}

export async function createEdge(input: EdgeCreateInput, signal?: AbortSignal): Promise<EdgeRow> {
  return safeFetch<EdgeRow>("/api/edges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal,
  });
}

export async function deleteEdge(id: number, signal?: AbortSignal): Promise<{ ok: true }> {
  return safeFetch<{ ok: true }>(`/api/edges/${id}`, {
    method: "DELETE",
    cache: "no-store",
    signal,
  });
}

// DB row -> UI node
export function toRollupNodes(rows: NodeRow[]): RollupNode[] {
  return rows.map((n) => ({
    id: String(n.id),
    label: n.title,
    status: "GRAY",
    kind: mapDbKindToUi(n.kind),
    data: (n.meta ?? {}) as NodeData,
    __dbPos: {
      x: n.x != null ? Number(n.x) : undefined,
      y: n.y != null ? Number(n.y) : undefined
    },
  }));
}

export function toRollupEdges(rows: EdgeRow[]): RollupEdge[] {
  return rows.map((e) => ({
    id: String(e.id),
    source: String(e.sourceId),
    target: String(e.targetId),
  }));
}

// ---- Adjacency helpers (parents/children from edges)
export type Adjacency = {
  parentsOf: Record<string, string[]>;
  childrenOf: Record<string, string[]>;
  roots: string[];
  leaves: string[];
};

/** Build parent/child lists from nodes+edges */
export function buildAdjacency(nodes: RollupNode[], edges: RollupEdge[]): Adjacency {
  const parentsOf: Record<string, string[]> = {};
  const childrenOf: Record<string, string[]> = {};

  for (const n of nodes) {
    parentsOf[n.id] = [];
    childrenOf[n.id] = [];
  }
  for (const e of edges) {
    if (!childrenOf[e.source]) childrenOf[e.source] = [];
    if (!parentsOf[e.target]) parentsOf[e.target] = [];
    childrenOf[e.source].push(e.target);
    parentsOf[e.target].push(e.source);
  }

  const roots = nodes.filter(n => (parentsOf[n.id]?.length ?? 0) === 0).map(n => n.id);
  const leaves = nodes.filter(n => (childrenOf[n.id]?.length ?? 0) === 0).map(n => n.id);

  return { parentsOf, childrenOf, roots, leaves };
}

/** Return nodes enriched with parents/children arrays (doesn't mutate input) */
export type RollupNodeWithAdj = RollupNode & { parents: string[]; children: string[] };

export function attachAdjacencyToNodes(
  nodes: RollupNode[],
  edges: RollupEdge[]
): RollupNodeWithAdj[] {
  const { parentsOf, childrenOf } = buildAdjacency(nodes, edges);
  return nodes.map(n => ({
    ...n,
    parents: parentsOf[n.id] ?? [],
    children: childrenOf[n.id] ?? [],
  }));
}