// src/lib/status.runtime.ts
import type {
  OrgStatusConfig,
  KPIKey,
  NodeKind,
  RollupNode,
  RollupEdge,
  Status,
  NodeData,
} from "./types";

// ---- Normalize primitives ----
const clamp01 = (n: number | undefined | null): number | undefined =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined;

const pctTo01 = (pct: number | undefined) =>
  typeof pct === "number" ? clamp01(pct / 100) : undefined;

// ---- Build adjacency ----
export function buildAdjacency(nodes: RollupNode[], edges: RollupEdge[]) {
  const childrenOf: Record<string, string[]> = {};
  const parentOf: Record<string, string | undefined> = {};
  for (const n of nodes) childrenOf[n.id] = [];
  for (const e of edges) {
    if (!childrenOf[e.source]) childrenOf[e.source] = [];
    childrenOf[e.source].push(e.target);
    parentOf[e.target] = e.source;
  }
  return { childrenOf, parentOf };
}

export function ancestorChain(id: string, parentOf: Record<string, string | undefined>) {
  const out: string[] = [id];
  let cur = parentOf[id];
  while (cur) { out.push(cur); cur = parentOf[cur]; }
  return out;
}

// ---- KPI extraction per node kind (→ 0..1) ----
export function extractKPIs(kind: NodeKind, data?: NodeData): Partial<Record<KPIKey, number>> {
  if (!data) return {};
  switch (kind) {
    case "question": {
      const proficiency = pctTo01(data.averagePct ?? data.difficultyPct);
      return proficiency != null ? { proficiency } : {};
    }
    case "assessment": {
      const proficiency = pctTo01(data.averagePct);
      return proficiency != null ? { proficiency } : {};
    }
    case "objective": {
      const alignment = pctTo01(data.achievementPct);
      return alignment != null ? { alignment } : {};
    }
    case "course": {
      const completion = pctTo01(data.courseAvgPct);
      return completion != null ? { completion } : {};
    }
    case "standard": {
      // If you add freshnessDays later, map it to the 'freshness' KPI here.
      return {};
    }
  }
}

// ---- Weighted mean helper ----
const wmean = (pairs: { v: number; w: number }[]) => {
  const wsum = pairs.reduce((s, p) => s + p.w, 0);
  if (wsum <= 0) return undefined as number | undefined;
  const vsum = pairs.reduce((s, p) => s + p.v * p.w, 0);
  return vsum / wsum;
};

// ---- Aggregate child KPIs → parent KPI semantics ----
export function aggregateChildKPIs(kind: NodeKind, children: RollupNode[]): Partial<Record<KPIKey, number>> {
  const getWeight = (n: RollupNode) => {
    const d = n.data; if (!d) return 1;
    if (typeof d.weight === "number") return Math.min(1, Math.max(0, d.weight));
    // Support legacy weightPct if present:
    if (typeof (d as any).weightPct === "number") return Math.min(1, Math.max(0, (d as any).weightPct / 100));
    return 1;
  };

  const pull = (kpi: KPIKey) => {
    const vals = children
      .map((c) => ({ v: extractKPIs(c.kind, c.data)[kpi] }) )
      .map((x, i) => ({ v: x.v, w: getWeight(children[i]) }))
      .filter((p): p is { v: number; w: number } => typeof p.v === "number");
    const m = wmean(vals);
    return typeof m === "number" ? Number(m.toFixed(4)) : undefined;
  };

  switch (kind) {
    case "assessment":
      return { proficiency: pull("proficiency") };
    case "objective":
      return { alignment: pull("proficiency") ?? pull("alignment") };
    case "course":
      return { completion: pull("alignment") };
    case "standard":
      return { completion: pull("completion") ?? pull("alignment") };
    default:
      return {};
  }
}

// ---- Evaluate status per OrgStatusConfig rules ----
export function evaluateStatus(kind: NodeKind, kpis: Partial<Record<KPIKey, number>>, config: OrgStatusConfig): Status {
  for (const rule of config.rules) {
    if (rule.scope !== "any" && rule.scope !== kind) continue;
    const v = kpis[rule.kpi];
    if (v == null) {
      if (rule.thresholds.grayIfMissing) return "GRAY";
      continue;
    }
    const { green, amber } = rule.thresholds;
    if (rule.direction === "higher_is_better") {
      if (v >= green) return "GREEN";
      if (v >= amber) return "AMBER";
      return "RED";
    } else {
      if (v <= green) return "GREEN";
      if (v <= amber) return "AMBER";
      return "RED";
    }
  }
  return "GRAY";
}

// ---- Recompute upstream (returns a *new* array of RollupNode) ----
export function recomputeUpstream(
  nodes: RollupNode[],
  edges: RollupEdge[],
  changedId: string,
  config: OrgStatusConfig
): RollupNode[] {
  const { childrenOf, parentOf } = buildAdjacency(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, { ...n }]));
  const chain = ancestorChain(changedId, parentOf);

  for (const id of chain) {
    const n = byId.get(id)!;
    const childIds = childrenOf[id] ?? [];
    const children = childIds.map((cid) => byId.get(cid)!).filter(Boolean);

    const selfKPIs = extractKPIs(n.kind, n.data);
    const agg = children.length ? aggregateChildKPIs(n.kind, children) : {};
    const kpis = { ...selfKPIs, ...agg };

    const override = n.data?.statusOverride;
    const status = override ?? evaluateStatus(n.kind, kpis, config);

    (n as any).__kpis = kpis; // expose for UI
    n.status = status;

    byId.set(id, n);
  }

  return Array.from(byId.values());
}
