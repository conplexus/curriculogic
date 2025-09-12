// src/app/api_disabled/rollup-views/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { rollupViews } from "@/db/schema";

// --- Validation
const CreateView = z
  .object({
    name: z.string().trim().min(1).default("New Rollup"),
    description: z.string().trim().min(1).nullable().optional(),
    term: z.string().trim().min(1).nullable().optional(),
    year: z
      .union([z.coerce.number().int(), z.null()])
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    standardId: z
      .union([z.coerce.number().int().positive(), z.null()])
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    includeObjectives: z.coerce.boolean().default(true),
    // If these columns are JSON/JSONB, accept any JSON-serializable values
    filtersJson: z.any().nullable().optional(),
    thresholdsJson: z.any().nullable().optional(),
    paletteJson: z.any().nullable().optional(),
  })
  .strict();

function noStore(json: any, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  try {
    const rows = await db.query.rollupViews.findMany({
      orderBy: (v, { asc }) => [asc(v.name), asc(v.id)],
    });
    return noStore(rows);
  } catch (e) {
    console.error("GET /rollup-views failed:", e);
    return noStore({ error: "Failed to list rollup views" }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateView.safeParse(body);
    if (!parsed.success) {
      return noStore({ error: parsed.error.flatten() }, 400);
    }

    const [row] = await db.insert(rollupViews).values(parsed.data).returning();

    const res = noStore(row, 201);
    res.headers.set("Location", `/api/rollup-views/${row.id}`);
    return res;
  } catch (e: any) {
    // If you enforce unique names, map unique-violation to 409 here.
    console.error("POST /rollup-views failed:", e);
    return noStore({ error: "Failed to create rollup view" }, 500);
  }
}
