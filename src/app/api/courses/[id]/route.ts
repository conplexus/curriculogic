// app/api/courses/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { badRequest, json, notFound, safeParams } from "@/lib/http";

const CourseUpdate = z.object({
  title: z.string().min(1),
  term: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(3000).optional(),
  credits: z.coerce.number().min(0).max(30).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await safeParams(ctx.params);
  const row = await db.query.courses.findFirst({ where: eq(courses.id, Number(id)) });
  if (!row) return notFound();
  return json(row);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await safeParams(ctx.params);
  const parsed = CourseUpdate.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid payload", parsed.error.flatten());
  await db.update(courses).set(parsed.data).where(eq(courses.id, Number(id)));
  return NextResponse.json({ ok: true });
}
