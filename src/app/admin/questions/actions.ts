"use server";

import { db } from "@/db/client";
import {
  assessments,
  questions,
  courseObjectives,
  questionObjectiveMap,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export async function loadQuestionsData(assessmentId: number) {
  const asm = await db.query.assessments.findFirst({
    where: (a, { eq }) => eq(a.id, assessmentId),
  });

  if (!asm) return { assessment: null, questions: [], objectives: [], maps: {} };

  const qs = await db.query.questions.findMany({
    where: (q, { eq }) => eq(q.assessmentId, assessmentId),
    orderBy: (q, { asc }) => [asc(q.label), asc(q.id)],
  });

  const objs = await db.query.courseObjectives.findMany({
    where: (o, { eq }) => eq(o.courseId, asm.courseId),
    orderBy: (o, { asc }) => [asc(o.code), asc(o.id)],
  });

  const maps = qs.length
    ? await db
        .select()
        .from(questionObjectiveMap)
        .where(inArray(questionObjectiveMap.questionId, qs.map((q) => q.id)))
    : [];

  const byQ: Record<number, { objectiveId: number; weight: number }[]> = {};
  for (const m of maps) {
    (byQ[m.questionId] ??= []).push({
      objectiveId: m.objectiveId,
      weight: m.weight ?? 1,
    });
  }

  return { assessment: asm, questions: qs, objectives: objs, maps: byQ };
}

export async function createQuestion(input: {
  assessmentId: number;
  label?: string;
  maxPoints?: number;
  type?: string | null;
}) {
  const [row] = await db
    .insert(questions)
    .values({
      assessmentId: input.assessmentId,
      label: input.label ?? "New question",
      maxPoints: input.maxPoints ?? 1,
      type: input.type ?? null,
      activeBool: true,
    })
    .returning();
  return row;
}

export async function updateQuestion(
  id: number,
  patch: Partial<{ label: string; maxPoints: number; type: string | null; activeBool: boolean }>
) {
  const [row] = await db.update(questions).set(patch).where(eq(questions.id, id)).returning();
  return row;
}

export async function deleteQuestion(id: number) {
  await db.delete(questions).where(eq(questions.id, id));
  return { ok: true };
}

export async function saveQuestionObjectiveWeights(
  questionId: number,
  entries: { objectiveId: number; weight: number }[]
) {
  await db.delete(questionObjectiveMap).where(eq(questionObjectiveMap.questionId, questionId));
  const filtered = entries.filter((e) => e.weight > 0);
  if (filtered.length) {
    await db.insert(questionObjectiveMap).values(
      filtered.map((e) => ({
        questionId,
        objectiveId: e.objectiveId,
        weight: e.weight,
      }))
    );
  }
  return { ok: true };
}
