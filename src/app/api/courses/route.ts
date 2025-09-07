import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { z } from "zod";

export async function GET() {
  const rows = await db.select().from(courses).orderBy(courses.code);
  return NextResponse.json(rows);
}

const CourseCreate = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  term: z.string().optional(),
  year: z.number().int().optional(),
  credits: z.number().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CourseCreate.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  const [row] = await db.insert(courses).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
