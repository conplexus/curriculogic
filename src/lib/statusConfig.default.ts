// src/lib/statusConfig.default.ts
import type { OrgStatusConfig, Thresholds } from "./types";
import { DEFAULT_PALETTE } from "./palette";

export const DEFAULT_STATUS_CONFIG: OrgStatusConfig = {
  palette: DEFAULT_PALETTE,
  rules: [
    // For leaf-level questions: % correct
    { scope: "question", kpi: "proficiency", direction: "higher_is_better",
      thresholds: { green: 0.85, amber: 0.6, grayIfMissing: true } as Thresholds },

    // Assessment-level rollup: % correct across questions
    { scope: "assessment", kpi: "proficiency", direction: "higher_is_better",
      thresholds: { green: 0.8, amber: 0.5, grayIfMissing: true } },

    // Objective alignment: % mapped assessments/questions achieved
    { scope: "objective", kpi: "alignment", direction: "higher_is_better",
      thresholds: { green: 0.9, amber: 0.7, grayIfMissing: true } },

    // Course completion: % of objectives achieved
    { scope: "course", kpi: "completion", direction: "higher_is_better",
      thresholds: { green: 0.9, amber: 0.7, grayIfMissing: true } },

    // Standard freshness: days since last update (lower is better)
    { scope: "standard", kpi: "freshness", direction: "lower_is_better",
      thresholds: { green: 30, amber: 90, grayIfMissing: true } },
  ],
};
