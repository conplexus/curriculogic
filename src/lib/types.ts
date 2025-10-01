// src/lib/types.ts

/** Traffic-light status used across the app */
export type Status = "GREEN" | "AMBER" | "RED" | "GRAY";

/** UI/Graph node kinds (lowercase) */
export type NodeKind = "standard" | "course" | "objective" | "assessment" | "question";

/** DB node kinds (uppercase) */
export type DbNodeKind = "STANDARD" | "COURSE" | "OBJECTIVE" | "ASSESSMENT" | "ITEM";

/** Some views also render grouping containers */
export type RenderKind = NodeKind | "group";

/** Discriminated editor/meta payload (all optional for backward-compat) */
export type NodeData = {
  // shared
  description?: string;
  weight?: number;            // 0..1
  statusOverride?: Status | null;

  // ----- standard
  compliancePct?: number;     // 0..100
  owner?: string;

  // ----- course
  term?: string;
  year?: number;
  credits?: number;
  courseAvgPct?: number;      // 0..100

  // ----- objective
  achievementPct?: number;    // 0..100
  bloomLevel?: string;

  // ----- assessment
  date?: string;              // yyyy-mm-dd
  maxPoints?: number;
  cohortSize?: number;
  weightPct?: number;         // 0..100 (UI convenience)
  averagePct?: number;        // 0..100
  derivesFromQuestions?: boolean;

  // ----- question (item)
  prompt?: string;
  difficultyPct?: number;     // p-value %
  discriminationIdx?: number; // -1..1
  // Note: question can also have averagePct/maxPoints (above)
};

/** Graph node used by ReactFlow view */
export type RollupNode = {
  id: string;
  label: string;          // UI label (maps from DB "title")
  status: Status;
  type?: RenderKind;
  kind: NodeKind;         // UI kind (lowercase)
  parentId?: string;
  data?: NodeData;        // maps from DB "meta" JSONB
};

export type RollupEdge = {
  id: string;
  source: string;
  target: string;
};

export type StatusPalette = Record<Status, string>;

export type KPIKey = "proficiency" | "completion" | "alignment" | "freshness";
export type Direction = "higher_is_better" | "lower_is_better";

export type Thresholds = {
  green: number;
  amber: number;
  grayIfMissing?: boolean;
};

export interface StatusRule {
  scope: NodeKind | "any";
  kpi: KPIKey;
  direction: Direction;
  thresholds: Thresholds;
}

export interface OrgStatusConfig {
  palette: StatusPalette;
  rules: StatusRule[];
}

export interface RollupResponse {
  nodes: RollupNode[];
  edges: RollupEdge[];
  statusPalette?: Partial<StatusPalette>;
}

/* =========================
   DB ⇄ UI kind mappers
   ========================= */

export function mapDbKindToUi(kind: DbNodeKind): NodeKind {
  switch (kind) {
    case "STANDARD": return "standard";
    case "COURSE": return "course";
    case "OBJECTIVE": return "objective";
    case "ASSESSMENT": return "assessment";
    case "ITEM": return "question";
  }
}

export function mapUiKindToDb(kind: NodeKind): DbNodeKind {
  switch (kind) {
    case "standard": return "STANDARD";
    case "course": return "COURSE";
    case "objective": return "OBJECTIVE";
    case "assessment": return "ASSESSMENT";
    case "question": return "ITEM";
  }
}

/* =========================
   UI helpers (badges/details)
   ========================= */

export function displayPerformancePct(kind: NodeKind, data?: NodeData): number | undefined {
  if (!data) return undefined;
  if (kind === "course") return data.courseAvgPct;
  if (kind === "assessment" || kind === "question") return data.averagePct;
  return undefined;
}

export function displayAchievementPct(kind: NodeKind, data?: NodeData): number | undefined {
  if (!data) return undefined;
  if (kind === "objective") return data.achievementPct;
  if (kind === "standard") return data.compliancePct;
  return undefined;
}

/** Weight as 0..1, falling back to weightPct/100 if present */
export function normalizedWeight(data?: NodeData): number | undefined {
  if (!data) return undefined;
  if (typeof data.weight === "number") return data.weight;
  if (typeof data.weightPct === "number") return clamp01(data.weightPct / 100);
  return undefined;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return undefined as unknown as number;
  return Math.min(1, Math.max(0, n));
}

export type TargetModel = "threshold_rate" | "mean_score";

export type ObjectiveMetrics = {
  meanPct: number | null;          // 0..1
  attainmentRate: number | null;   // 0..1
  nItems: number;
  nAssessments: number;
};

export type StandardMetrics = {
  modelA_attain: number | null;
  modelB_mean: number | null;
  nObjectives: number;
  nCourses: number;
};
