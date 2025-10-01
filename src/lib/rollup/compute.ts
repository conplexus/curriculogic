import { db } from "@/db/client";
import {
  nodes,
  courses,
  objectives,
  questionResults,
  questionObjectives,
  standardCourseWeights,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

// ---------- helpers ----------
function normalize(weights: Array<{ id: number; w: number }>) {
  const sum = weights.reduce((s, r) => s + (Number(r.w) || 0), 0);
  if (!sum || sum <= 0) return weights.map(r => ({ ...r, w: 1 / Math.max(1, weights.length) }));
  return weights.map(r => ({ ...r, w: Number(r.w) / sum }));
}

function weightedMean(entries: Array<{ v: number; w: number }>) {
  const num = entries.reduce((s, e) => s + e.v * e.w, 0);
  const den = entries.reduce((s, e) => s + e.w, 0);
  return den > 0 ? num / den : null;
}

function rowMeanPct(r: typeof questionResults.$inferSelect | undefined) {
  if (!r) return null;
  if (r.meanPoints != null && r.maxPoints != null && Number(r.maxPoints) > 0) {
    return Number(r.meanPoints) / Number(r.maxPoints);
  }
  if (r.nAttempted && r.nAttempted > 0 && r.nCorrect != null) {
    return Number(r.nCorrect) / Number(r.nAttempted);
  }
  return null;
}

// ---------------------------------------------
// 1) Objective mean (Model B) for a cohort
// ---------------------------------------------
export async function computeObjectiveMeanPct(cohortId: number, objectiveId: number) {
  const qMaps = await db
    .select()
    .from(questionObjectives)
    .where(eq(questionObjectives.objectiveId, objectiveId));

  if (!qMaps.length) return { meanPct: null, nQuestions: 0 };

  const norm = normalize(
    qMaps.map(m => ({ id: m.questionId!, w: Number(m.weight || 1) }))
  );

  const qRes = await db
    .select()
    .from(questionResults)
    .where(and(
      eq(questionResults.cohortId, cohortId),
      inArray(questionResults.questionId, norm.map(n => n.id))
    ));

  const rows = norm
    .map(n => {
      const r = qRes.find(x => x.questionId === n.id);
      const meanPct = rowMeanPct(r);
      return meanPct == null ? null : { v: meanPct, w: n.w };
    })
    .filter(Boolean) as Array<{ v: number; w: number }>;

  return {
    meanPct: rows.length ? weightedMean(rows) : null,
    nQuestions: rows.length,
  };
}

// ---------------------------------------------
// 2) Course mean = weighted mean of its objectives
//    weight comes from objectives.weightInCourse
// ---------------------------------------------
export async function computeCourseMeanPct(cohortId: number, courseId: number) {
  const objs = await db.select().from(objectives).where(eq(objectives.courseId, courseId));
  if (!objs.length) return { meanPct: null, nObjectives: 0 };

  const objectiveMeans: Array<{ v: number; w: number }> = [];
  for (const o of objs) {
    const res = await computeObjectiveMeanPct(cohortId, o.id);
    if (res.meanPct != null) {
      const w = Number(o.weightInCourse || 1);
      objectiveMeans.push({ v: res.meanPct, w });
    }
  }

  return {
    meanPct: objectiveMeans.length ? weightedMean(objectiveMeans) : null,
    nObjectives: objectiveMeans.length,
  };
}

// ---------------------------------------------
// 3) Standard mean = weighted mean of linked course nodes
//    using standardCourseWeights + node.meta.courseId (preferred) or node.code ⇄ courses.code
// ---------------------------------------------
export async function computeStandardMeanPct(cohortId: number, standardNodeId: number) {
  const links = await db
    .select()
    .from(standardCourseWeights)
    .where(eq(standardCourseWeights.standardNodeId, standardNodeId));

  if (!links.length) return { meanPct: null, nCourses: 0 };

  const courseMeans: Array<{ v: number; w: number }> = [];

  for (const link of links) {
    const [courseNode] = await db.select().from(nodes).where(eq(nodes.id, link.courseNodeId)).limit(1);
    if (!courseNode) continue;

    // Resolve backing course row: prefer meta.courseId; fallback to code match
    const meta = (courseNode.meta ?? {}) as Record<string, unknown>;
    const metaCourseId = typeof meta["courseId"] === "number" ? (meta["courseId"] as number) : null;

    let backingCourse: typeof courses.$inferSelect | undefined;
    if (metaCourseId != null) {
      const found = await db.select().from(courses).where(eq(courses.id, metaCourseId)).limit(1);
      backingCourse = found[0];
    } else if (courseNode.code) {
      const found = await db.select().from(courses).where(eq(courses.code, courseNode.code)).limit(1);
      backingCourse = found[0];
    }

    if (!backingCourse) continue;

    const cm = await computeCourseMeanPct(cohortId, backingCourse.id);
    if (cm.meanPct != null) {
      courseMeans.push({ v: cm.meanPct, w: Number(link.weightInStandard || 1) });
    }
  }

  return {
    meanPct: courseMeans.length ? weightedMean(courseMeans) : null,
    nCourses: courseMeans.length,
  };
}

import { assessmentStats, questionStats } from "@/db/schema"; // optional, enrich evidence if you like

export type EvidenceQuestion = {
  questionId: number;
  label?: string | null;
  meanPct: number | null;
  weightInObjective: number;
};

export type EvidenceObjective = {
  objectiveId: number;
  code?: string | null;
  title: string;
  weightInCourse: number;
  meanPct: number | null;
  nQuestions: number;
  questions: EvidenceQuestion[];
};

export type EvidenceCourse = {
  courseNodeId: number;
  courseId: number;
  code?: string | null;
  title: string;
  weightInStandard: number;
  meanPct: number | null;
  nObjectives: number;
  objectives: EvidenceObjective[];
};

export type StandardEvidence = {
  standardNodeId: number;
  cohortId: number;
  meanPct: number | null;
  nCourses: number;
  courses: EvidenceCourse[];
};

export async function computeStandardMeanWithEvidence(
  cohortId: number,
  standardNodeId: number,
): Promise<StandardEvidence> {
  const links = await db.select().from(standardCourseWeights)
    .where(eq(standardCourseWeights.standardNodeId, standardNodeId));

  const coursesOut: EvidenceCourse[] = [];

  for (const link of links) {
    const [courseNode] = await db.select().from(nodes).where(eq(nodes.id, link.courseNodeId)).limit(1);
    if (!courseNode) continue;

    const meta = (courseNode.meta ?? {}) as Record<string, unknown>;
    const metaCourseId = typeof meta["courseId"] === "number" ? (meta["courseId"] as number) : null;

    let backingCourse: typeof courses.$inferSelect | undefined;
    if (metaCourseId != null) {
      const found = await db.select().from(courses).where(eq(courses.id, metaCourseId)).limit(1);
      backingCourse = found[0];
    } else if (courseNode.code) {
      const found = await db.select().from(courses).where(eq(courses.code, courseNode.code)).limit(1);
      backingCourse = found[0];
    }
    if (!backingCourse) continue;

    // objectives for this course
    const objs = await db.select().from(objectives).where(eq(objectives.courseId, backingCourse.id));
    const objEvidence: EvidenceObjective[] = [];
    for (const o of objs) {
      // question mappings for this objective
      const qMaps = await db.select().from(questionObjectives).where(eq(questionObjectives.objectiveId, o.id));
      if (!qMaps.length) {
        objEvidence.push({
          objectiveId: o.id, code: o.code, title: o.title,
          weightInCourse: Number(o.weightInCourse || 1),
          meanPct: null, nQuestions: 0, questions: [],
        });
        continue;
      }

      // normalize item weights within the objective
      const norm = qMaps.length
        ? (() => {
            const sum = qMaps.reduce((s, r) => s + Number(r.weight || 1), 0);
            return qMaps.map(m => ({ id: m.questionId!, w: sum > 0 ? Number(m.weight || 1) / sum : 1 / qMaps.length }));
          })()
        : [];

      // pull results and labels
      const qIds = norm.map(n => n.id);
      const qRes = await db.select().from(questionResults)
        .where(and(eq(questionResults.cohortId, cohortId), inArray(questionResults.questionId, qIds)));
      const qRows = await db.select().from(questions).where(inArray(questions.id, qIds));

      const qEvi: EvidenceQuestion[] = norm.map(n => {
        const r = qRes.find(x => x.questionId === n.id);
        const q = qRows.find(x => x.id === n.id);
        const meanPct =
          r?.meanPoints != null && r?.maxPoints != null && Number(r.maxPoints) > 0
            ? Number(r.meanPoints) / Number(r.maxPoints)
            : (r && r.nAttempted && r.nAttempted > 0 && r.nCorrect != null)
              ? Number(r.nCorrect) / Number(r.nAttempted)
              : null;
        return { questionId: n.id, label: q?.label, meanPct, weightInObjective: n.w };
      });

      const objMean = (() => {
        const rows = qEvi.filter(q => q.meanPct != null) as Required<EvidenceQuestion>[];
        if (!rows.length) return null;
        const num = rows.reduce((s, e) => s + e.meanPct * e.weightInObjective, 0);
        const den = rows.reduce((s, e) => s + e.weightInObjective, 0);
        return den > 0 ? num / den : null;
      })();

      objEvidence.push({
        objectiveId: o.id,
        code: o.code,
        title: o.title,
        weightInCourse: Number(o.weightInCourse || 1),
        meanPct: objMean,
        nQuestions: qEvi.length,
        questions: qEvi,
      });
    }

    // course mean = weighted objectives
    const rows = objEvidence.filter(o => o.meanPct != null) as Array<Required<Pick<EvidenceObjective,"meanPct"|"weightInCourse">>>;
    const courseMean = rows.length
      ? rows.reduce((s, e) => s + e.meanPct * e.weightInCourse, 0) /
        rows.reduce((s, e) => s + e.weightInCourse, 0)
      : null;

    coursesOut.push({
      courseNodeId: courseNode.id,
      courseId: backingCourse.id,
      code: backingCourse.code,
      title: backingCourse.title,
      weightInStandard: Number(link.weightInStandard || 1),
      meanPct: courseMean,
      nObjectives: objEvidence.length,
      objectives: objEvidence,
    });
  }

  // standard mean = weighted courses
  const rows = coursesOut.filter(c => c.meanPct != null) as Array<Required<Pick<EvidenceCourse,"meanPct"|"weightInStandard">>>;
  const stdMean = rows.length
    ? rows.reduce((s, e) => s + e.meanPct * e.weightInStandard, 0) /
      rows.reduce((s, e) => s + e.weightInStandard, 0)
    : null;

  return {
    standardNodeId,
    cohortId,
    meanPct: stdMean,
    nCourses: coursesOut.length,
    courses: coursesOut,
  };
}
