"use server";

import { db } from "@/db/client";
import {
  courseObjectives,
  standards,
  standardItems,
  objectiveStandardItemMap,
} from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
// If you plan on tag-based revalidation later:
// import { revalidateTag } from "next/cache";

const SaveSchema = z.object({
  objectiveId: z.number().int().positive(),
  standardItemIds: z.array(z.number().int().positive()).default([]),
});

type MappingsPayload = z.infer<typeof SaveSchema>;

type LoadMappingsData = {
  objectives: Awaited<ReturnType<typeof db.query.courseObjectives.findMany>>;
  standards: Awaited<ReturnType<typeof db.query.standards.findMany>>;
  items: Awaited<ReturnType<typeof db.query.standardItems.findMany>>;
  mapsByObjective: Record<number, number[]>;
};

// Load all data needed for the mapping page (server component)
export async function loadMappingsData(): Promise<LoadMappingsData> {
  const [objs, stds, items] = await Promise.all([
    db.query.courseObjectives.findMany({
      orderBy: (o, { asc }) => [asc(o.courseId), asc(o.code), asc(o.id)],
    }),
    db.query.standards.findMany({
      orderBy: (s, { asc }) => [asc(s.code), asc(s.id)],
    }),
    db.query.standardItems.findMany({
      orderBy: (si, { asc }) => [asc(si.standardId), asc(si.code), asc(si.id)],
    }),
  ]);

  let maps: { objectiveId: number; standardItemId: number }[] = [];
  if (objs.length) {
    maps = await db.query.objectiveStandardItemMap.findMany({
      where: (m, { inArray }) => inArray(m.objectiveId, objs.map((o) => o.id)),
      columns: { objectiveId: true, standardItemId: true },
      // orderBy not strictly needed here
    });
  }

  // Build { objectiveId: number[] } map
  const mapsByObjective: Record<number, number[]> = {};
  for (const { objectiveId, standardItemId } of maps) {
    (mapsByObjective[objectiveId] ??= []).push(standardItemId);
  }

  return { objectives: objs, standards: stds, items, mapsByObjective };
}

// Server action to replace the mapping set for a single objective
export async function saveMappings(
  objectiveId: number,
  standardItemIds: number[]
) {
  // Validate & normalize
  const parsed = SaveSchema.safeParse({ objectiveId, standardItemIds });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    };
  }
  const payload: MappingsPayload = parsed.data;

  // Dedupe to avoid unique/PK conflicts on bulk insert
  const deduped = Array.from(new Set(payload.standardItemIds));

  // Optional: ensure objective exists (defensive)
  const objectiveExists = await db
    .select({ id: courseObjectives.id })
    .from(courseObjectives)
    .where(eq(courseObjectives.id, payload.objectiveId))
    .limit(1);

  if (objectiveExists.length === 0) {
    return { ok: false as const, error: "Objective not found" };
  }

  // Optional: validate all standardItemIds exist (skip if you trust the UI)
  if (deduped.length) {
    const existing = await db
      .select({ id: standardItems.id })
      .from(standardItems)
      .where(inArray(standardItems.id, deduped));

    if (existing.length !== deduped.length) {
      return { ok: false as const, error: "One or more standard items not found" };
    }
  }

  // Replace-set in a single transaction for atomicity
  const result = await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(objectiveStandardItemMap)
      .where(eq(objectiveStandardItemMap.objectiveId, payload.objectiveId));

    let inserted = 0;
    if (deduped.length) {
      const insertRes = await tx
        .insert(objectiveStandardItemMap)
        .values(
          deduped.map((sid) => ({
            objectiveId: payload.objectiveId,
            standardItemId: sid,
          }))
        );
      // drizzle returns info differently by driver; fall back to deduped.length
      inserted = Array.isArray(insertRes) ? insertRes.length : deduped.length;
    }

    return { deletedCount: deleted.rowsAffected ?? 0, insertedCount: inserted };
  });

  // If you tag cache segments by objective, you can revalidate here:
  // revalidateTag(`objective:${objectiveId}:mappings`);

  return { ok: true as const, ...result };
}
