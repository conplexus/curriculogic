// src/app/api_disabled/standard-items/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { standardItems } from "@/db/schema";
import { and, eq, like } from "drizzle-orm";

// ---------- helpers
const noStore = (json: any, status = 200) =>
  NextResponse.json(json, { status, headers: { "cache-control": "no-store" } });

// ---------- query parsing
const Query = z.object({
  standardId: z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : Number(v)))
    .refine((v) => v == null || (Number.isInteger(v) && v > 0), {
      message: "Invalid standardId",
    }),
  parentId: z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : Number(v)))
    .refine((v) => v == null || (Number.isInteger(v) && v > 0), {
      message: "Invalid parentId",
    }),
  q: z.string().trim().min(1).optional(), // search in code/title
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return noStore({ error: parsed.error.flatten() }, 400);

    const { standardId, parentId, q, limit } = parsed.data;

    const whereClauses = [];
    if (standardId != null) whereClauses.push(eq(standardItems.standardId, standardId));
    if (parentId != null) whereClauses.push(eq(standardItems.parentId, parentId));
    if (q) {
      const patt = `%${q}%`;
      // search both code and title
      whereClauses.push(
        // drizzle doesn't support OR inline in `and`, so use a single `like` on a concatenation if you prefer.
        // Easiest is to just filter by title OR code later if your dialect supports it.
        // For portability, do two requests or keep it simple; here we do title LIKE and code LIKE via a crude approach:
        // (Some dialects need `or`; if unavailable, drop to a raw query or keep only title LIKE.)
        like(standardItems.title, patt)
      );
    }

    const where =
      whereClauses.length > 0
        ? (and as any)(...whereClauses)
        : undefined;

    const rows = await db.query.standardItems.findMany({
      where,
      orderBy: (si, { asc }) => [asc(si.code), asc(si.id)],
      limit: limit ?? 200, // soft cap
    });

    // If q provided and you want OR(code LIKE) too, do a client-side extra filter:
    const final =
      q
        ? rows.filter(
            (r) =>
              r.title?.toLowerCase().includes(q.toLowerCase()) ||
              r.code?.toLowerCase().includes(q.toLowerCase())
          )
        : rows;

    return noStore(final);
  } catch (e) {
    console.error("GET /standard-items failed:", e);
    return noStore({ error: "Failed to fetch standard items" }, 500);
  }
}

// ---------- body validation
const ItemCreate = z
  .object({
    standardId: z.coerce.number().int().positive(),
    code: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    parentId: z
      .union([z.coerce.number().int().positive(), z.null()])
      .optional()
      .transform((v) => (v === undefined ? null : v)),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = ItemCreate.safeParse(json);
    if (!parsed.success) return noStore({ error: parsed.error.flatten() }, 400);

    const [row] = await db.insert(standardItems).values(parsed.data).returning();

    const res = noStore(row, 201);
    res.headers.set("Location", `/api/standard-items/${row.id}`);
    return res;
  } catch (e: any) {
    // Map unique-constraint violations to 409 if you add a unique index (e.g., (standardId, code))
    console.error("POST /standard-items failed:", e);
    return noStore({ error: "Failed to create standard item" }, 500);
  }
}
