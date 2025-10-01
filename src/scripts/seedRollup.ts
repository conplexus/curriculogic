// scripts/seedRollup.ts
// Seeds a tiny but complete graph + results so rollups show thresholds + averages.
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  maps, nodes, edges,
  courses,
  assessments, questions,
  objectives, questionObjectives,
  questionResults, cohorts,
  type NodeKind
} from "@/db/schema";

// ---------- small helpers ----------
async function ensureOne<T extends { id: number }>(
  find: () => Promise<T | undefined>,
  create: () => Promise<T>
) {
  const existing = await find();
  if (existing) return existing;
  return await create();
}

function nodeInput(mapId: number, kind: NodeKind, title: string) {
  return { mapId, kind, title, code: title, meta: {}, x: 0, y: 0 } as const;
}

async function ensureNode(mapId: number, kind: NodeKind, title: string) {
  return ensureOne(
    async () => (await db.query.nodes.findFirst({
      where: and(eq(nodes.mapId, mapId), eq(nodes.kind, kind), eq(nodes.title, title)),
    })) ?? undefined,
    async () => (await db.insert(nodes).values(nodeInput(mapId, kind, title)).returning())[0]
  );
}

async function ensureEdge(mapId: number, sourceId: number, targetId: number, label?: string) {
  const existing = await db.query.edges.findFirst({
    where: and(eq(edges.mapId, mapId), eq(edges.sourceId, sourceId), eq(edges.targetId, targetId)),
  });
  if (existing) return existing;
  return (await db.insert(edges).values({ mapId, sourceId, targetId, label }).returning())[0];
}

// ---------- main ----------
async function main() {
  // 1) Cohort to attach results to
  const cohort = await ensureOne(
    async () => (await db.query.cohorts.findFirst({ where: eq(cohorts.name, "AY Demo") })) ?? undefined,
    async () => (await db.insert(cohorts).values({ name: "AY Demo", program: "PharmD", campus: "Main" }).returning())[0]
  );

  // 2) Academic course + assessment + questions
  const course = await ensureOne(
    async () => (await db.query.courses.findFirst({ where: eq(courses.code, "PHARM-101") })) ?? undefined,
    async () => (await db.insert(courses).values({
      code: "PHARM-101",
      title: "Intro to Pharm 101",
      term: "Fall",
      year: 2025,
      credits: 3,
    }).returning())[0]
  );

  const assessment = await ensureOne(
    async () => (await db.query.assessments.findFirst({
      where: and(eq(assessments.courseId, course.id), eq(assessments.title, "Exam 1"))
    })) ?? undefined,
    async () => (await db.insert(assessments).values({
      courseId: course.id,
      title: "Exam 1",
      kind: "Exam",
    }).returning())[0]
  );

  const q1 = await ensureOne(
    async () => (await db.query.questions.findFirst({ where: and(eq(questions.assessmentId, assessment.id), eq(questions.label, "Q1")) })) ?? undefined,
    async () => (await db.insert(questions).values({ assessmentId: assessment.id, label: "Q1", points: "1" }).returning())[0]
  );
  const q2 = await ensureOne(
    async () => (await db.query.questions.findFirst({ where: and(eq(questions.assessmentId, assessment.id), eq(questions.label, "Q2")) })) ?? undefined,
    async () => (await db.insert(questions).values({ assessmentId: assessment.id, label: "Q2", points: "1" }).returning())[0]
  );
  const q3 = await ensureOne(
    async () => (await db.query.questions.findFirst({ where: and(eq(questions.assessmentId, assessment.id), eq(questions.label, "Q3")) })) ?? undefined,
    async () => (await db.insert(questions).values({ assessmentId: assessment.id, label: "Q3", points: "1" }).returning())[0]
  );

  // 3) Course Objective (with target threshold) + map questions → objective
  const obj = await ensureOne(
    async () => (await db.query.objectives.findFirst({
      where: and(eq(objectives.courseId, course.id), eq(objectives.code, "OBJ-1"))
    })) ?? undefined,
    async () => (await db.insert(objectives).values({
      courseId: course.id,
      code: "OBJ-1",
      title: "Understand common roles of a Pharmacist",
      weightInCourse: "1",
      proficiencyCut: "0.70",  // threshold (>=70% correct = proficient)
      targetRate: "0.80",      // accreditation target: 80% proficient
    }).returning())[0]
  );

  // map each question fully to the objective
  for (const q of [q1, q2, q3]) {
    const exists = await db.query.questionObjectives.findFirst({
      where: and(eq(questionObjectives.questionId, q.id), eq(questionObjectives.objectiveId, obj.id)),
    });
    if (!exists) {
      await db.insert(questionObjectives).values({ questionId: q.id, objectiveId: obj.id, weight: "1" });
    }
  }

  // 4) Seed results (cohort-level). Clear old rows for repeatable runs.
  for (const q of [q1, q2, q3]) {
    const prev = await db.query.questionResults.findFirst({
      where: and(eq(questionResults.cohortId, cohort.id), eq(questionResults.questionId, q.id)),
    });
    if (prev) {
      await db.delete(questionResults).where(and(eq(questionResults.cohortId, cohort.id), eq(questionResults.questionId, q.id)));
    }
  }

  // 85%, 70%, 95% correctness respectively
  const attempts = 40;
  const rows = [
    { q: q1, pct: 0.85 },
    { q: q2, pct: 0.70 },
    { q: q3, pct: 0.95 },
  ].map(({ q, pct }) => ({
    cohortId: cohort.id,
    questionId: q.id,
    nAttempted: attempts,
    nCorrect: Math.round(attempts * pct),
    meanPoints: String(pct),   // points possible = 1, so meanPoints = pct
    maxPoints: "1",
  }));

  await db.insert(questionResults).values(rows);

  // 5) Minimal Rollup graph: Standard → Course → Objective → Assessment → Items
  const map = await ensureOne(
    async () => (await db.query.maps.findFirst({ where: eq(maps.name, "Demo Map") })) ?? undefined,
    async () => (await db.insert(maps).values({ name: "Demo Map", frameworkTag: "CUSTOM", orgId: 1 }).returning())[0]
  );

  const stdNode = await ensureNode(map.id, "STANDARD", "Pharmacy Standard 1");
  const courseNode = await ensureNode(map.id, "COURSE", course.title);
  const objNode = await ensureNode(map.id, "OBJECTIVE", obj.title);
  const assessNode = await ensureNode(map.id, "ASSESSMENT", assessment.title);
  const item1 = await ensureNode(map.id, "ITEM", "Question 1");
  const item2 = await ensureNode(map.id, "ITEM", "Question 2");
  const item3 = await ensureNode(map.id, "ITEM", "Question 3");

  // … after creating stdNode, courseNode, objNode, assessNode, item1/2/3

  await ensureEdge(map.id, stdNode.id,    courseNode.id);
  await ensureEdge(map.id, courseNode.id, objNode.id);
  await ensureEdge(map.id, objNode.id,    assessNode.id);
  await ensureEdge(map.id, assessNode.id, item1.id);
  await ensureEdge(map.id, assessNode.id, item2.id);
  await ensureEdge(map.id, assessNode.id, item3.id);

  console.log("✅ Seed complete", {
    mapId: map.id,
    standardNodeId: stdNode.id,
    courseNodeId: courseNode.id,
    objectiveNodeId: objNode.id,
    examNodeId: assessNode.id,
    acadCourseId: course.id,
    acadAssessmentId: assessment.id,
    cohortId: cohort.id,
  });
}


main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
