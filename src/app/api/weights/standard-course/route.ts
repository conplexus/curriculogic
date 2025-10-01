import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { standardCourseWeights } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST { standardNodeId, courseNodeId, weightInStandard }
export async function POST(req: Request) {
  const body = await req.json();
  const { standardNodeId, courseNodeId, weightInStandard } = body ?? {};
  if (!standardNodeId || !courseNodeId) {
    return NextResponse.json({ error: "standardNodeId and courseNodeId required" }, { status: 400 });
  }
  const [row] = await db.insert(standardCourseWeights).values({
    standardNodeId: Number(standardNodeId),
    courseNodeId: Number(courseNodeId),
    weightInStandard: String(weightInStandard ?? "1"),
  }).onConflictDoUpdate({
    target: [standardCourseWeights.standardNodeId, standardCourseWeights.courseNodeId],
    set: { weightInStandard: String(weightInStandard ?? "1") },
  }).returning();
  return NextResponse.json(row);
}

// PUT { id, weightInStandard }
export async function PUT(req: Request) {
  const body = await req.json();
  const { id, weightInStandard } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [row] = await db.update(standardCourseWeights)
    .set({ weightInStandard: String(weightInStandard ?? "1") })
    .where(eq(standardCourseWeights.id, Number(id)))
    .returning();
  return NextResponse.json(row);
}

// DELETE { id }
export async function DELETE(req: Request) {
  const body = await req.json();
  const { id } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(standardCourseWeights).where(eq(standardCourseWeights.id, Number(id)));
  return NextResponse.json({ ok: true });
}
