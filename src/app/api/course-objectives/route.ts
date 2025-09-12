// src/app/api_disabled/course-objectives/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courseObjectives } from "@/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import { z } from "zod";

// ---------- helpers
const qSchema = z.object({
  courseId: z.string().regex(/^\d+$/, "courseId must be an integer").transform(Number).optional(),
  search: z.string().trim().optional(),
  activeOnly: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Math.min(Math.max(Number(v), 1), 200))
    .optional()
    .default("100" as any)
    .transform(Number),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Math.max(Number(v), 0))
    .optional()
    .default("0" as any)
    .transform(Number),
});

const ObjectiveCreate = z.object({
  courseId: z.number().int().positive(),
  code: z.string().trim().max(50).optional(),
  text: z.string().trim().min(1),
  version: z.string().trim().max(32).optional(),
  activeBool: z.boolean().optional(),
});

// Common error helpers
const badRequest = (msg: string, extra?: any) =>
  NextResponse.json({ ok: false, error: msg, ...extra }, { status: 400 });
const serverError = (msg = "Internal Server Error") =>
  NextResponse.json({ ok: false, error: msg }, { status: 500 });

// ---------- CORS preflight (useful if you ever call from browser)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// ---------- GET /api_disabled/course-objectives?[courseId=&search=&activeOnly=&limit=&offset=]
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = qSchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return badRequest("Invalid query params", { issues: parsed.error.flatten() });
    }
    const { courseId, search, activeOnly, limit, offset } = parsed.data;

    // Build filters
    const filters = [];
    if (courseId !== undefined) filters.push(eq(courseObjectives.courseId, courseId));
    if (activeOnly) filters.push(eq(courseObjectives.activeBool, true));
    if (search && search.length > 0) {
      // simple LIKE on code and text
      const pattern = `%${search}%`;
      filters.push(
        sql`(${like(courseObjectives.code, ${pattern})} OR ${like(courseObjectives.text, ${pattern})})`
      );
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const rows = await db
      .select()
      .from(courseObjectives)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(courseObjectives.courseId, courseObjectives.code, courseObjectives.id);

    return NextResponse.json({ ok: true, data: rows });
  } catch (e) {
    return serverError();
  }
}

// ---------- POST /api_disabled/course-objectives
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Body must be valid JSON");
    }

    const parsed = ObjectiveCreate.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid body", { issues: parsed.error.flatten() });
    }

    const data = parsed.data;
    const [row] = await db
      .insert(courseObjectives)
      .values({
        courseId: data.courseId,
        code: data.code ?? "OBJ",
        text: data.text,
        version: data.version ?? null,
        activeBool: data.activeBool ?? true,
      })
      .returning();

    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch (e) {
    return serverError();
  }
}
