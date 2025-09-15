"use server";

import { db } from "@/db/client";
import { rollupViews } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

// Adjust fields if your table has more columns.
// Known from your code: "name", "includeObjectives".
const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  includeObjectives: z.boolean().optional(),
});

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  includeObjectives: z.boolean().optional(),
  term: z.string().trim().max(32).nullable().optional(),
  year: z.number().int().nullable().optional(),
  standardId: z.number().int().nullable().optional(),
});

export async function listRollups() {
  return db.query.rollupViews.findMany({
    orderBy: (v, { asc }) => [asc(v.name), asc(v.id)],
  });
}

export async function createRollup(input?: { name?: string; includeObjectives?: boolean }) {
  const parsed = CreateSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input", issues: parsed.error.flatten() };
  }
  const data = parsed.data;

  const [row] = await db
    .insert(rollupViews)
    .values({
      name: (data.name ?? "Untitled Rollup").trim(),
      includeObjectives: data.includeObjectives ?? true,
    })
    .returning();

  return { ok: true as const, rollup: row };
}

export async function updateRollup(
  id: number,
  patch: Partial<{ name: string; includeObjectives: boolean }>
) {
  const parsed = UpdateSchema.safeParse(patch ?? {});
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid patch", issues: parsed.error.flatten() };
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return { ok: false as const, error: "No fields to update" };
  }

  const [row] = await db
    .update(rollupViews)
    .set(data)
    .where(eq(rollupViews.id, id))
    .returning();

  if (!row) return { ok: false as const, error: "Rollup not found" };
  return { ok: true as const, rollup: row };
}

export async function deleteRollup(id: number) {
  const deleted = await db.delete(rollupViews).where(eq(rollupViews.id, id)).returning();
  if (!deleted.length) return { ok: false as const, error: "Rollup not found" };
  return { ok: true as const, deletedCount: deleted.length };
}

/** Convenience toggler if you wire a checkbox in the UI. */
export async function toggleIncludeObjectives(id: number, value: boolean) {
  return updateRollup(id, { includeObjectives: value });
}

export async function duplicateRollup(id: number) {
  const [src] = await db.select().from(rollupViews).where(eq(rollupViews.id, id)).limit(1);
  if (!src) return { ok: false as const, error: "Rollup not found" };

  const [copy] = await db.insert(rollupViews).values({
    name: `Copy of ${src.name ?? "Untitled Rollup"}`,
    includeObjectives: src.includeObjectives ?? true,
    term: src.term ?? null,
    year: src.year ?? null,
    standardId: src.standardId ?? null,
    // add any other columns you carry on rollupViews (e.g., JSON configs)
  }).returning();

  return { ok: true as const, rollup: copy };
}