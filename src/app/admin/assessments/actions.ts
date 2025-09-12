"use server";

import { z } from "zod";
import { parse } from "csv-parse/sync"; // npm i csv-parse
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  courses,
  assessments,
  questions,
  questionStats,
  assessmentStats,
  questionObjectives,
  objectiveStats,
} from "@/db/schema";
import { and, eq, asc, inArray } from "drizzle-orm";

/**
 * CSV schema (one row per question)
 * Keep it aggregate-only (FERPA-safe): counts of Correct/Incorrect/Blank.
 */
const Row = z.object({
  AssessmentTitle: z.string().min(1),
  AssessmentKind: z.string().min(1),
  AdministeredAt: z.string().optional(), // ISO date (yyyy-mm-dd) or blank
  CourseCode: z.string().min(1),
  QuestionLabel: z.string().min(1),
  Points: z.coerce.number().default(1),
  Correct: z.coerce.number().int().nonnegative(),
  Incorrect: z.coerce.number().int().nonnegative(),
  Blank: z.coerce.number().int().nonnegative(),
});

type RowT = z.infer<typeof Row>;

function safeDate(d?: string) {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t) : null;
}

function academicYearLabel(date: Date | null) {
  // Simple AY labeling: Jul 1 – Jun 30
  const now = date ?? new Date();
  const y = now.getFullYear();
  const isAfterJune = now.getMonth() >= 6; // 0-indexed (6 = July)
  const start = isAfterJune ? y : y - 1;
  const end = start + 1;
  return `AY ${start}-${end}`;
}

/**
 * Idempotency + correctness notes:
 * - Per (CourseCode, AssessmentTitle) group, we:
 *   1) Upsert course
 *   2) Upsert assessment (kind + administeredAt)
 *   3) For each QuestionLabel:
 *        - Upsert question (points)
 *        - Upsert aggregate stats (nGraded, pValue, etc.)
 *   4) Upsert assessment-level stats (nGraded, meanScore)
 *   5) Recompute objective rollups from scratch for this assessment (delete existing rows for the pair, then re-add)
 *
 * This prevents double-counting if you import an updated file for the same assessment.
 */
export async function importAssessmentCSVAction(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file uploaded");

  const buf = Buffer.from(await file.arrayBuffer());

  let records: unknown[];
  try {
    records = parse(buf, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    throw new Error("CSV parsing failed. Ensure the header row matches the expected columns.");
  }

  // Validate all rows with line context for friendlier errors
  const rows: RowT[] = [];
  const errors: string[] = [];
  records.forEach((r, idx) => {
    const line = idx + 2; // account for header row
    const res = Row.safeParse(r);
    if (res.success) rows.push(res.data);
    else {
      const msg = res.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      errors.push(`Line ${line}: ${msg}`);
    }
  });
  if (errors.length) {
    throw new Error(`Import aborted. ${errors.length} row error(s):\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? "\n..." : ""}`);
  }

  // Group by (CourseCode, AssessmentTitle)
  const key = (r: RowT) => `${r.CourseCode}||${r.AssessmentTitle}`;
  const groups = new Map<string, RowT[]>();
  for (const r of rows) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  // Transaction for the entire import to keep it consistent
  await db.transaction(async (trx) => {
    for (const [, group] of groups) {
      const head = group[0];

      // 1) upsert course
      const existingCourse = await trx.query.courses.findFirst({
        where: eq(courses.code, head.CourseCode),
      });
      const courseId =
        existingCourse?.id ??
        (await trx
          .insert(courses)
          .values({
            code: head.CourseCode,
            title: head.CourseCode, // you can refine later in Admin UI
            term: "Fall",
            year: new Date().getFullYear(),
            credits: 0,
          })
          .returning())[0].id;

      // 2) upsert assessment
      const administeredAt = safeDate(head.AdministeredAt);
      const existingAssessment = await trx.query.assessments.findFirst({
        where: and(eq(assessments.courseId, courseId), eq(assessments.title, head.AssessmentTitle)),
      });

      const assessment =
        existingAssessment ??
        (await trx
          .insert(assessments)
          .values({
            courseId,
            title: head.AssessmentTitle,
            kind: head.AssessmentKind,
            administeredAt,
          })
          .returning())[0];

      // If kind or date differ from previous import, keep it refreshed
      if (
        existingAssessment &&
        (existingAssessment.kind !== head.AssessmentKind ||
          String(existingAssessment.administeredAt ?? "") !== String(administeredAt ?? ""))
      ) {
        await trx
          .update(assessments)
          .set({ kind: head.AssessmentKind, administeredAt })
          .where(eq(assessments.id, existingAssessment.id));
      }

      // 3) per-question upsert + stats
      let totalN = 0;
      let totalPoints = 0;
      let sumWeightedP = 0;

      // Cache question IDs to minimize lookups
      const existingQs = await trx.query.questions.findMany({
        where: eq(questions.assessmentId, assessment.id),
        orderBy: asc(questions.id),
      });
      const qByLabel = new Map(existingQs.map((q) => [q.label, q]));

      for (const r of group) {
        const nGraded = r.Correct + r.Incorrect + r.Blank;
        const pValue = nGraded > 0 ? r.Correct / nGraded : 0;

        let q = qByLabel.get(r.QuestionLabel);
        if (!q) {
          q = (
            await trx
              .insert(questions)
              .values({
                assessmentId: assessment.id,
                label: r.QuestionLabel,
                points: r.Points,
              })
              .returning()
          )[0];
          qByLabel.set(r.QuestionLabel, q);
        } else if (q.points !== r.Points) {
          // keep points in sync with the latest import
          await trx.update(questions).set({ points: r.Points }).where(eq(questions.id, q.id));
        }

        // Upsert (overwrite) aggregate stats for this question
        const existingQS = await trx.query.questionStats.findFirst({
          where: eq(questionStats.questionId, q.id),
        });

        const baseStats = {
          nGraded,
          nCorrect: r.Correct,
          nIncorrect: r.Incorrect,
          nBlank: r.Blank,
          meanScore: null as number | null, // optional: compute later if raw scores exist
          pValue,
        };

        if (existingQS) {
          await trx.update(questionStats).set(baseStats).where(eq(questionStats.questionId, q.id));
        } else {
          await trx.insert(questionStats).values({ questionId: q.id, ...baseStats });
        }

        totalN = Math.max(totalN, nGraded);
        totalPoints += Number(r.Points);
        sumWeightedP += Number(pValue) * Number(r.Points);
      }

      // 4) assessment-level stats (mean via points-weighted pValue)
      const meanScore = totalPoints > 0 ? sumWeightedP / totalPoints : null;

      const existingAS = await trx.query.assessmentStats.findFirst({
        where: eq(assessmentStats.assessmentId, assessment.id),
      });

      if (existingAS) {
        await trx
          .update(assessmentStats)
          .set({ nGraded: totalN, meanScore })
          .where(eq(assessmentStats.assessmentId, assessment.id));
      } else {
        await trx.insert(assessmentStats).values({
          assessmentId: assessment.id,
          nGraded: totalN,
          meanScore,
        });
      }

      // 5) objective rollups (recompute from scratch for this assessment to avoid double-count)
      //    For each question -> mappings(questionObjectives) -> accumulate to objectiveStats
      const qs = await trx.query.questions.findMany({
        where: eq(questions.assessmentId, assessment.id),
        orderBy: asc(questions.id),
      });
      const qIds = qs.map((q) => q.id);

      // fetch stats in batch
      const qsStats = qIds.length
        ? await trx.query.questionStats.findMany({ where: inArray(questionStats.questionId, qIds) })
        : [];
      const statsByQ = new Map(qsStats.map((s) => [s.questionId, s]));

      // Clear existing objectiveStats for this course/assessment to ensure idempotency
      await trx
        .delete(objectiveStats)
        .where(and(eq(objectiveStats.courseId, courseId), eq(objectiveStats.assessmentId, assessment.id)));

      // Collect rollups in-memory and write once
      type Roll = { nGraded: number; achievedCount: number };
      const rollups = new Map<number, Roll>(); // key: objectiveId

      for (const q of qs) {
        const s = statsByQ.get(q.id);
        if (!s || s.nGraded === 0) continue;

        const mappings = await trx.query.questionObjectives.findMany({
          where: eq(questionObjectives.questionId, q.id),
        });
        if (mappings.length === 0) continue;

        // contribution = pValue * weight * nGraded (rounded to nearest integer)
        const p = Number(s.pValue ?? 0);
        for (const m of mappings) {
          const w = Number(m.weight ?? 1);
          const achieved = Math.round(p * w * s.nGraded);
          const prior = rollups.get(m.objectiveId) ?? { nGraded: 0, achievedCount: 0 };
          rollups.set(m.objectiveId, {
            nGraded: prior.nGraded + s.nGraded,
            achievedCount: prior.achievedCount + achieved,
          });
        }
      }

      if (rollups.size) {
        const ay = academicYearLabel(administeredAt);
        for (const [objectiveId, { nGraded, achievedCount }] of rollups.entries()) {
          await trx.insert(objectiveStats).values({
            objectiveId,
            courseId,
            assessmentId: assessment.id,
            nGraded,
            achievedCount,
            pctAchieved: nGraded > 0 ? achievedCount / nGraded : 0,
            // if your table has timeframe/label columns, set them here:
            // timeframe: ay,
          });
        }
      }
    }
  });

  revalidatePath("/admin/assessments");
  return { ok: true };
}
