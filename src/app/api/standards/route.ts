// src/app/api_disabled/standards/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { standards } from "@/db/schema";

// ---------------- Helpers
const noStore = (json: any, status = 200) =>
  NextResponse.json(json, { status, headers: { "cache-control": "no-store" } });

// ---------------- Validation
const StandardCreate = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    authority: z.string().trim().min(1, "Authority is required"),
    version: z.string().trim().min(1, "Version is required"),
    effectiveFrom: z
      .string()
      .trim()
      .min(1)
      .refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "Invalid date format for effectiveFrom",
      }),
    effectiveTo: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
        message: "Invalid date format for effectiveTo",
      }),
  })
  .strict();

export async function GET() {
  try {
    const rows = await db.query.standards.findMany({
      orderBy: (s, { asc }) => [asc(s.name), asc(s.version), asc(s.id)],
    });
    return noStore(rows);
  } catch (e) {
    console.error("GET /standards failed:", e);
    return noStore({ error: "Failed to fetch standards" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = StandardCreate.safeParse(json);
    if (!parsed.success) return noStore({ error: parsed.error.flatten() }, 400);

    const [row] = await db.insert(standards).values(parsed.data).returning();

    const res = noStore(row, 201);
    res.headers.set("Location", `/api/standards/${row.id}`);
    return res;
  } catch (e) {
    console.error("POST /standards failed:", e);
    return noStore({ error: "Failed to create standard" }, 500);
  }
}


import { NextResponse } from "next/server";
import { computeStandardMean } from "@/lib/rollup/compute";
import { db } from "@/db/client";
import { standards } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  const standardNodeId = searchParams.get("standardNodeId");
  if (!cohortId || !standardNodeId) {
    return NextResponse.json({ error: "cohortId and standardNodeId are required" }, { status: 400 });
  }

  const std = await db.select().from(standards).where(eq(standards.nodeId, standardNodeId)).limit(1);
  const model = std[0]?.targetModel ?? "threshold_rate";
  const target = std[0]?.targetValue ?? null;

  const { mean, nCourses } = await computeStandardMean(cohortId, standardNodeId);

  return NextResponse.json({
    modelSuggested: model,
    targetValue: target,
    modelB_mean: mean,    // 0..1 or null
    nCourses,
  });
}
