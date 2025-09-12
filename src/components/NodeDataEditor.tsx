"use client";

import { useMemo, useState } from "react";
import type { NodeKind, Status } from "@/lib/types";

type BaseValues = {
  label: string;
  description?: string;
  weight?: number;           // 0..1 (rollup weight)
  statusOverride?: Status | null;
};

type StandardValues = BaseValues & {
  compliancePct?: number;    // 0..100 (computed or manual)
  owner?: string;
};

type CourseValues = BaseValues & {
  term?: string;
  year?: number;
  credits?: number;
  courseAvgPct?: number;     // 0..100 (manual or computed)
};

type ObjectiveValues = BaseValues & {
  achievementPct?: number;   // 0..100
  bloomLevel?: string;       // e.g. Remember/Understand/…
};

type AssessmentValues = BaseValues & {
  date?: string;             // yyyy-mm-dd
  maxPoints?: number;
  cohortSize?: number;
  weightPct?: number;        // 0..100 (UI convenience; convert to 0..1)
  averagePct?: number;       // 0..100 (enter if not deriving from questions)
  derivesFromQuestions?: boolean; // if true, backend should compute
};

type QuestionValues = BaseValues & {
  prompt?: string;
  maxPoints?: number;
  averagePct?: number;       // 0..100 (question average)
  discriminationIdx?: number; // -1..1 (optional analytics)
  difficultyPct?: number;     // p-value in %
};

type KindValues =
  | ({ kind: "standard" } & StandardValues)
  | ({ kind: "course" } & CourseValues)
  | ({ kind: "objective" } & ObjectiveValues)
  | ({ kind: "assessment" } & AssessmentValues)
  | ({ kind: "question" } & QuestionValues);

export type NodeDataEditorProps = {
  kind: NodeKind;
  initial: Partial<KindValues>;
  onSubmit?: (clean: KindValues) => void;  // <- make optional
  onCancel?: () => void;
  title?: string;
};

/** Small helpers */
const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;

const pctIn = (v?: number) => (v ?? v === 0 ? clamp(Number(v), 0, 100) : undefined);
const posNum = (v?: number) => (v ?? v === 0 ? Math.max(0, Number(v)) : undefined);
const toWeight01 = (weightPct?: number) =>
  weightPct ?? weightPct === 0 ? clamp(Number(weightPct) / 100, 0, 1) : undefined;

export default function NodeDataEditor({
  kind,
  initial,
  onSubmit = () => {},   // <- default no-op
  onCancel = () => {},
  title = "Edit Node Data",
}: NodeDataEditorProps) {
  // Local form state
  const [values, setValues] = useState<Partial<KindValues>>({
    kind,
    ...initial,
  });

  // Shared field setter
  const set = <K extends keyof KindValues>(key: K, v: KindValues[K]) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const header = useMemo(() => {
    const map: Record<NodeKind, string> = {
      standard: "Standard",
      course: "Course",
      objective: "Objective",
      assessment: "Assessment",
      question: "Question",
    };
    return map[kind];
  }, [kind]);

  const submit = () => {
    // Normalize / sanitize based on kind before sending up
    const base: BaseValues = {
      label: String((values as any).label || "").trim(),
      description: ((values as any).description || "").trim() || undefined,
      weight: typeof (values as any).weight === "number"
        ? clamp(Number((values as any).weight), 0, 1)
        : toWeight01((values as any).weightPct), // allow UIs to pass % temporarily
      statusOverride: (values as any).statusOverride ?? null,
    };

    if (!base.label) return; // you may want to toast/guard higher up

    let clean: KindValues;
    switch (kind) {
      case "standard": {
        clean = {
          kind,
          ...base,
          compliancePct: pctIn((values as any).compliancePct),
          owner: ((values as any).owner || "").trim() || undefined,
        };
        break;
      }
      case "course": {
        clean = {
          kind,
          ...base,
          term: ((values as any).term || "").trim() || undefined,
          year: (values as any).year ? Number((values as any).year) : undefined,
          credits: (values as any).credits ? Number((values as any).credits) : undefined,
          courseAvgPct: pctIn((values as any).courseAvgPct),
        };
        break;
      }
      case "objective": {
        clean = {
          kind,
          ...base,
          achievementPct: pctIn((values as any).achievementPct),
          bloomLevel: ((values as any).bloomLevel || "").trim() || undefined,
        };
        break;
      }
      case "assessment": {
        clean = {
          kind,
          ...base,
          date: ((values as any).date || "").trim() || undefined,
          maxPoints: posNum((values as any).maxPoints),
          cohortSize: posNum((values as any).cohortSize),
          weightPct: pctIn((values as any).weightPct),
          averagePct: pctIn((values as any).averagePct),
          derivesFromQuestions: Boolean((values as any).derivesFromQuestions),
        };
        // If derivesFromQuestions is true, ignore manual averagePct on save
        if (clean.derivesFromQuestions) {
          clean.averagePct = undefined;
        }
        break;
      }
      case "question": {
        clean = {
          kind,
          ...base,
          prompt: ((values as any).prompt || "").trim() || undefined,
          maxPoints: posNum((values as any).maxPoints),
          averagePct: pctIn((values as any).averagePct),
          discriminationIdx:
            (values as any).discriminationIdx === 0 || (values as any).discriminationIdx
              ? Number((values as any).discriminationIdx)
              : undefined,
          difficultyPct: pctIn((values as any).difficultyPct),
        };
        break;
      }
      default: {
        // exhaustive check
        clean = { kind, ...base } as KindValues;
      }
    }
    onSubmit(clean);
  };

  // Shared styles (light/dark)
  const container =
    "w-full max-w-2xl rounded-2xl border shadow-lg p-6 " +
    "bg-white border-neutral-200 text-neutral-900 " +
    "dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100";

  const sectionTitle = "text-sm font-semibold text-neutral-700 mb-2 dark:text-neutral-200";
  const labelCls = "text-xs font-medium text-neutral-600 dark:text-neutral-300";
  const inputCls =
    "w-full rounded-lg border px-3 py-2 outline-none " +
    "bg-white border-neutral-300 text-neutral-900 " +
    "placeholder:text-neutral-400 " +
    "focus:ring-2 focus:ring-indigo-500 " +
    "dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-500";

  const row = "grid grid-cols-1 md:grid-cols-2 gap-3";

  return (
    <div className={container} role="dialog" aria-modal="true">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {header} • Light/Dark aware • Fields adapt to node kind
        </p>
      </div>

      {/* Core section */}
      <div className="mb-5">
        <div className={sectionTitle}>Core</div>
        <div className={row}>
          <div>
            <label className={labelCls}>Label / Name</label>
            <input
              className={inputCls}
              defaultValue={(values as any).label || ""}
              onChange={(e) => set("label" as any, e.target.value)}
              placeholder="e.g., PHRM101, Objective 1.3, Midterm Exam"
              required
            />
          </div>
          <div>
            <label className={labelCls}>Weight (0–1)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              className={inputCls}
              defaultValue={(values as any).weight ?? ""}
              onChange={(e) => set("weight" as any, e.target.value === "" ? undefined : Number(e.target.value))}
              placeholder="0.25"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea
              className={inputCls}
              rows={3}
              defaultValue={(values as any).description || ""}
              onChange={(e) => set("description" as any, e.target.value)}
              placeholder="Optional context, mapping notes, definitions…"
            />
          </div>
        </div>
      </div>

      {/* Kind-specific sections */}
      {kind === "standard" && (
        <div className="mb-5">
          <div className={sectionTitle}>Standard Details</div>
          <div className={row}>
            <div>
              <label className={labelCls}>Compliance (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).compliancePct ?? ""}
                onChange={(e) => set("compliancePct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 92.5"
              />
            </div>
            <div>
              <label className={labelCls}>Owner</label>
              <input
                className={inputCls}
                defaultValue={(values as any).owner || ""}
                onChange={(e) => set("owner" as any, e.target.value)}
                placeholder="Dean / Committee / Coordinator"
              />
            </div>
          </div>
        </div>
      )}

      {kind === "course" && (
        <div className="mb-5">
          <div className={sectionTitle}>Course Details</div>
          <div className={row}>
            <div>
              <label className={labelCls}>Term</label>
              <input
                className={inputCls}
                defaultValue={(values as any).term || ""}
                onChange={(e) => set("term" as any, e.target.value)}
                placeholder="Fall / Spring"
              />
            </div>
            <div>
              <label className={labelCls}>Year</label>
              <input
                type="number"
                className={inputCls}
                defaultValue={(values as any).year ?? ""}
                onChange={(e) => set("year" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="2025"
              />
            </div>
            <div>
              <label className={labelCls}>Credits</label>
              <input
                type="number"
                step="0.5"
                className={inputCls}
                defaultValue={(values as any).credits ?? ""}
                onChange={(e) => set("credits" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="3"
              />
            </div>
            <div>
              <label className={labelCls}>Course Average (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).courseAvgPct ?? ""}
                onChange={(e) => set("courseAvgPct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 84.2"
              />
            </div>
          </div>
        </div>
      )}

      {kind === "objective" && (
        <div className="mb-5">
          <div className={sectionTitle}>Objective Details</div>
          <div className={row}>
            <div>
              <label className={labelCls}>Achievement (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).achievementPct ?? ""}
                onChange={(e) => set("achievementPct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 78.0"
              />
            </div>
            <div>
              <label className={labelCls}>Bloom Level</label>
              <input
                className={inputCls}
                defaultValue={(values as any).bloomLevel || ""}
                onChange={(e) => set("bloomLevel" as any, e.target.value)}
                placeholder="Remember / Understand / Apply / Analyze / Evaluate / Create"
              />
            </div>
          </div>
        </div>
      )}

      {kind === "assessment" && (
        <div className="mb-5">
          <div className={sectionTitle}>Assessment Details</div>
          <div className={row}>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                className={inputCls}
                defaultValue={(values as any).date || ""}
                onChange={(e) => set("date" as any, e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Cohort Size</label>
              <input
                type="number"
                className={inputCls}
                defaultValue={(values as any).cohortSize ?? ""}
                onChange={(e) => set("cohortSize" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 92"
              />
            </div>
            <div>
              <label className={labelCls}>Max Points</label>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).maxPoints ?? ""}
                onChange={(e) => set("maxPoints" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="100"
              />
            </div>
            <div>
              <label className={labelCls}>Weight (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).weightPct ?? ""}
                onChange={(e) => set("weightPct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 20"
              />
            </div>
            <div>
              <label className={labelCls}>Average (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                disabled={(values as any).derivesFromQuestions}
                defaultValue={(values as any).averagePct ?? ""}
                onChange={(e) => set("averagePct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="Enter only if not deriving from questions"
              />
            </div>
            <div className="flex items-center gap-2 mt-6 md:mt-0">
              <input
                id="derive"
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                defaultChecked={Boolean((values as any).derivesFromQuestions)}
                onChange={(e) => set("derivesFromQuestions" as any, e.target.checked)}
              />
              <label htmlFor="derive" className={labelCls}>
                Derive average from Question children
              </label>
            </div>
          </div>
        </div>
      )}

      {kind === "question" && (
        <div className="mb-5">
          <div className={sectionTitle}>Question Details</div>
          <div className={row}>
            <div className="md:col-span-2">
              <label className={labelCls}>Prompt</label>
              <textarea
                className={inputCls}
                rows={2}
                defaultValue={(values as any).prompt || ""}
                onChange={(e) => set("prompt" as any, e.target.value)}
                placeholder="Enter the stem / prompt (avoid PII)"
              />
            </div>
            <div>
              <label className={labelCls}>Max Points</label>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).maxPoints ?? ""}
                onChange={(e) => set("maxPoints" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 1"
              />
            </div>
            <div>
              <label className={labelCls}>Average (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).averagePct ?? ""}
                onChange={(e) => set("averagePct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 72.3"
              />
            </div>
            <div>
              <label className={labelCls}>Discrimination Index</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                defaultValue={(values as any).discriminationIdx ?? ""}
                onChange={(e) => set("discriminationIdx" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="-1.00 … 1.00"
              />
            </div>
            <div>
              <label className={labelCls}>Difficulty (p-value, %)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className={inputCls}
                defaultValue={(values as any).difficultyPct ?? ""}
                onChange={(e) => set("difficultyPct" as any, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="e.g., 64.0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50
                     dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500
                     focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-neutral-900"
        >
          Save
        </button>
      </div>
    </div>
  );
}
