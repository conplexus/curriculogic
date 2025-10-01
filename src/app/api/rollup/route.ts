// src/app/api/rollup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import {
  nodes, edges, standardCourseWeights,
  questions, questionObjectives, objectives,
  assessments, questionResults as itemResults, // your table name
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

/**
 * Returns a combined rollup for a STANDARD node:
 * - achRate: weighted objective-achievement proxy (threshold-priority)
 * - targetRate: weighted target across objectives (fallback 0.8)
 * - meanPct: point-weighted average performance across items
 * - nCourses
 */
export async function GET(req: NextRequest) {
  const standardNodeId = Number(req.nextUrl.searchParams.get("standardNodeId"));
  const cohortId = Number(req.nextUrl.searchParams.get("cohortId") ?? 1);

  if (!standardNodeId) {
    return NextResponse.json({ error: "Missing standardNodeId" }, { status: 400 });
  }

  // 1) which courses feed this standard (via explicit weights table)
  const stdCourses = await db.query.standardCourseWeights.findMany({
    where: eq(standardCourseWeights.standardNodeId, standardNodeId),
    columns: { courseNodeId: true, weightInStandard: true },
  });

  const courseNodeIds = stdCourses.map(c => c.courseNodeId);
  const nCourses = courseNodeIds.length;

  // Fast-exit if nothing linked
  if (nCourses === 0) {
    return NextResponse.json({
      achRate: null,
      targetRate: null,
      meanPct: null,
      nCourses: 0,
      status: "GRAY",
    });
  }

  // 2) gather course -> academic course -> assessments -> questions -> objective mappings
  //    We’ll compute:
  //    - meanPct  = SUM(meanPoints) / SUM(maxPoints) over items in these courses (cohort)
  //    - achRate  = weighted mean of item pctCorrect mapped into objectives,
  //                 then objective-weighted into the standard (approximation of threshold)
  //
  // NOTE: We’re using the item-level aggregate (nCorrect / nAttempted) as the proxy
  //       for "% students meeting proficiency" (works well for 1-pt MCQs; good MVP).

  // 2a) Collect objective rows that belong to the courses (via edges in your graph)
  const courseToObjectiveEdges = await db
    .select({
      courseNodeId: edges.sourceId,
      objectiveNodeId: edges.targetId,
    })
    .from(edges)
    .innerJoin(nodes as any, and(eq(edges.sourceId, nodes.id), eq(nodes.kind, sql`'COURSE'`)))
    .where(inArray(edges.sourceId, courseNodeIds));

  const objectiveNodeIds = courseToObjectiveEdges.map(r => r.objectiveNodeId);
  if (objectiveNodeIds.length === 0) {
    // Still compute meanPct at course level even if no objectives are mapped
    // (your existing mean calc likely covers this; return stub here if you prefer strict)
  }

  // 2b) Objective settings (weights & targets)
  const objectiveRows = await db
    .select({
      nodeId: objectives.id,               // academic objective id
      courseId: objectives.courseId,
      weightInCourse: objectives.weightInCourse, // in your schema, this exists on objectives
      proficiencyCut: objectives.proficiencyCut, // default 0.7
      targetRate: objectives.targetRate,         // default 0.8
    })
    .from(objectives)
    .where(inArray(objectives.id, objectiveNodeIds as number[]));

  // We’ll use weightInCourse (default 1) as the objective weight in the standard.
  const objectiveWeightById = new Map<number, number>();
  const objectiveTargetById = new Map<number, number>();
  for (const o of objectiveRows) {
    objectiveWeightById.set(o.nodeId, Number(o.weightInCourse ?? 1));
    objectiveTargetById.set(o.nodeId, Number(o.targetRate ?? 0.8));
  }

  // 2c) Item ↔ Objective mapping (questionObjectives) and item results for the cohort
  const itemMap = await db
    .select({
      objectiveId: questionObjectives.objectiveId,
      questionId: questionObjectives.questionId,
      weight: questionObjectives.weight,
    })
    .from(questionObjectives)
    .where(inArray(questionObjectives.objectiveId, objectiveNodeIds as number[]));

  const questionIds = Array.from(new Set(itemMap.map(m => m.questionId)));
  const results = questionIds.length
    ? await db
        .select({
          questionId: itemResults.questionId,
          nAttempted: itemResults.nAttempted,
          nCorrect: itemResults.nCorrect,
          meanPoints: itemResults.meanPoints,
          maxPoints: itemResults.maxPoints,
        })
        .from(itemResults)
        .where(and(
          inArray(itemResults.questionId, questionIds),
          eq(itemResults.cohortId, cohortId),
        ))
    : [];

  const resultByQuestionId = new Map<number, {
    nAttempted: number | null; nCorrect: number | null;
    meanPoints: string | number | null; maxPoints: string | number | null;
  }>();
  for (const r of results) resultByQuestionId.set(r.questionId, r);

  // 3) Compute metrics

  // 3a) meanPct: point-weighted across all questions under these objectives
  let sumMeanPoints = 0;
  let sumMaxPoints  = 0;

  // 3b) achRate: objective-weighted mean of item percent-correct (proxy)
  //     First accumulate per-objective:
  const objNumer: Record<number, number> = {}; // sum(w * itemPct)
  const objDenom: Record<number, number> = {}; // sum(w)
  for (const m of itemMap) {
    const res = resultByQuestionId.get(m.questionId);
    if (!res) continue;

    const maxPts = Number(res.maxPoints ?? 1) || 1;
    const meanPts = Number(res.meanPoints ?? 0);
    sumMeanPoints += meanPts;
    sumMaxPoints  += maxPts;

    // item percent correct proxy
    const pctCorrect =
      res.nAttempted && res.nAttempted > 0 && typeof res.nCorrect === "number"
        ? res.nCorrect / res.nAttempted
        : (maxPts > 0 ? meanPts / maxPts : 0);

    const w = Number(m.weight ?? 1);
    objNumer[m.objectiveId] = (objNumer[m.objectiveId] ?? 0) + w * pctCorrect;
    objDenom[m.objectiveId] = (objDenom[m.objectiveId] ?? 0) + w;
  }

  // Per-objective achievement proxy (0..1)
  const objAch: Array<{ id: number; ach: number; w: number; target: number }> = [];
  for (const [objIdStr, denom] of Object.entries(objDenom)) {
    const objId = Number(objIdStr);
    const ach = denom > 0 ? objNumer[objId] / denom : 0;
    const w   = objectiveWeightById.get(objId) ?? 1;
    const t   = objectiveTargetById.get(objId) ?? 0.8;
    objAch.push({ id: objId, ach, w, target: t });
  }

  // Standard-level achievement and target (weighted by objective weight)
  const stdAchNumer  = objAch.reduce((s, o) => s + o.ach    * o.w, 0);
  const stdAchDenom  = objAch.reduce((s, o) => s + o.w, 0);
  const stdTargetNum = objAch.reduce((s, o) => s + o.target * o.w, 0);
  const stdTargetDen = stdAchDenom || 1;

  const achRate   = stdAchDenom > 0 ? stdAchNumer / stdAchDenom : null;
  const targetRate = stdTargetDen > 0 ? stdTargetNum / stdTargetDen : 0.8;

  const meanPct =
    sumMaxPoints > 0 ? sumMeanPoints / sumMaxPoints : (nCourses > 0 ? 0 : null);

  // 4) status from threshold first; fall back to mean if we have no achievement data
  let status: "GREEN" | "AMBER" | "RED" | "GRAY" = "GRAY";
  const primary = achRate ?? meanPct;
  if (primary == null) status = "GRAY";
  else if (primary >= (achRate != null ? targetRate : 0.8)) status = "GREEN";
  else if (primary >= ((achRate != null ? targetRate : 0.8) - 0.1)) status = "AMBER";
  else status = "RED";

  return NextResponse.json({
    achRate,        // e.g. 0.83
    targetRate,     // e.g. 0.80 (weighted)
    meanPct,        // e.g. 0.748 or 0.833 depending on seed
    nCourses,
    status,
  });
}
