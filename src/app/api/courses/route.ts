// src/app/api_disabled/courses/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Avoid static caching of GET in prod
export const dynamic = "force-dynamic";
// If you know you're on Node (not Edge) because of your DB driver:
export const runtime = "nodejs";

const CourseCreate = z.object({
  code: z.string().min(1).transform((s) => s.trim()),
  title: z.string().min(1).transform((s) => s.trim()),
  term: z.string().transform((s) => s.trim()).optional().or(z.literal("").transform(() => undefined)),
  year: z.coerce.number().int().optional(),
  credits: z.coerce.number().optional(),
});

export async function GET() {
  try {
    const rows = await db.select().from(courses).orderBy(courses.code);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /courses failed:", err);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CourseCreate.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Optional: enforce uniqueness in app layer as nicer error (DB should also enforce)
    // If you have a unique index on courses.code, you can skip this select and catch the DB error instead.
    const exists = await db.query.courses.findFirst({ where: eq(courses.code, parsed.data.code) });
    if (exists) {
      return NextResponse.json({ error: "Course code already exists" }, { status: 409 });
    }

    const [row] = await db.insert(courses).values(parsed.data).returning();

    // Include Location header pointing at the (future) resource URL if you expose /courses/[id]
    const res = NextResponse.json(row, { status: 201 });
    res.headers.set("Location", `/api/courses/${row.id}`);
    return res;
  } catch (err: any) {
    // If you rely on DB unique constraint instead of the pre-check above, map that error here:
    // e.g., if (isUniqueViolation(err)) return NextResponse.json({ error: "Course code already exists" }, { status: 409 });
    console.error("POST /courses failed:", err);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
