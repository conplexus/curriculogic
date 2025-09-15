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
