export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courseObjectives } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  const rows = await db
    .select()
    .from(courseObjectives)
    .where(
      courseId ? eq(courseObjectives.courseId, Number(courseId)) : undefined
    );
  return NextResponse.json(rows);
}

const ObjectiveCreate = z.object({
  courseId: z.number().int(),
  code: z.string().optional(),
  text: z.string().min(1),
  version: z.string().optional(),
  activeBool: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ObjectiveCreate.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  const [row] = await db
    .insert(courseObjectives)
    .values(parsed.data)
    .returning();
  return NextResponse.json(row, { status: 201 });
}
