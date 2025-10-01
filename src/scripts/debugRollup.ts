import { db } from "../src/db/client";
import {
  nodes,
  standardCourseWeights,
  courses,
  objectives,
  questions,
  questionObjectives,
  questionResults,
} from "../src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
// scripts/seedRollup.ts (and scripts/debugRollup.ts)
import "dotenv/config";


async function debug({ cohortId, standardNodeId }: { cohortId: number; standardNodeId: number }) {
  console.log("Debugging rollup for:", { cohortId, standardNodeId });

  // 1) Find weight links for this standard
  const links = await db
    .select()
    .from(standardCourseWeights)
    .where(eq(standardCourseWeights.standardNodeId, standardNodeId));
  console.log("standard_course_weights rows:", links.length, links);

  if (!links.length) {
    console.log("❌ No course links for this standardNodeId. Did you use the seeded standard’s id?");
    return;
  }

  for (const link of links) {
    // 2) Load the course node
    const [courseNode] = await db.select().from(nodes).where(eq(nodes.id, link.courseNodeId)).limit(1);
    console.log("courseNode", courseNode?.id, courseNode?.code, courseNode?.meta);

    // 3) Resolve backing course
    let courseRow = null as typeof courses.$inferSelect | null;
    const meta = (courseNode?.meta ?? {}) as Record<string, unknown>;
    const metaCourseId = typeof meta["courseId"] === "number" ? (meta["courseId"] as number) : null;

    if (metaCourseId != null) {
      const found = await db.select().from(courses).where(eq(courses.id, metaCourseId)).limit(1);
      courseRow = found[0] ?? null;
      console.log("resolved by meta.courseId -> course.id", courseRow?.id);
    } else if (courseNode?.code) {
      const found = await db.select().from(courses).where(eq(courses.code, courseNode.code!)).limit(1);
      courseRow = found[0] ?? null;
      console.log("resolved by code match -> course.id", courseRow?.id);
    } else {
      console.log("❌ Could not resolve course node to a course row");
      continue;
    }

    if (!courseRow) {
      console.log("❌ No backing course row found");
      continue;
    }

    // 4) Objectives in this course
    const objs = await db.select().from(objectives).where(eq(objectives.courseId, courseRow.id));
    console.log(`objectives for course ${courseRow.id}:`, objs.map(o => ({ id: o.id, w: String(o.weightInCourse) })));

    if (!objs.length) {
      console.log("❌ Course has no objectives");
      continue;
    }

    // 5) Questions mapped to those objectives
    const objIds = objs.map(o => o.id);
    const qMaps = await db.select().from(questionObjectives).where(inArray(questionObjectives.objectiveId, objIds));
    console.log("question-objective mappings:", qMaps.length);

    if (!qMaps.length) {
      console.log("❌ No question mappings to these objectives");
      continue;
    }

    const qIds = qMaps.map(q => q.questionId);
    const qRows = await db.select().from(questions).where(inArray(questions.id, qIds));
    console.log("questions:", qRows.map(q => ({ id: q.id, label: q.label })));

    // 6) Results for cohort
    const qRes = await db
      .select()
      .from(questionResults)
      .where(and(eq(questionResults.cohortId, cohortId), inArray(questionResults.questionId, qIds)));
    console.log(`question_results for cohort ${cohortId}:`, qRes.length, qRes.map(r => ({ q: r.questionId, n: r.nAttempted, c: r.nCorrect, mp: String(r.meanPoints ?? ""), mx: String(r.maxPoints ?? "") })));

    if (!qRes.length) {
      console.log("❌ No question_results for this cohort/question set");
    } else {
      console.log("✅ Data present; rollup should work once the API is called with these IDs.");
    }
  }
}

// ---- run with IDs you used in the API url ----
const cohortId = Number(process.env.COHORT_ID ?? "1");
const standardNodeId = Number(process.env.STANDARD_NODE_ID ?? "1");
debug({ cohortId, standardNodeId }).then(() => process.exit(0));
