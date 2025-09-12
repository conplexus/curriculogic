"use server";

import { db } from "@/db/client";
import { standards, standardItems, objectiveStandardItemMap } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const CreateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(256),
});
const UpdateSchema = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(256).optional(),
});

export async function listStandards() {
  return db.query.standards.findMany({
    orderBy: (s, { asc }) => [asc(s.code), asc(s.id)],
  });
}

export async function createStandard(input: z.infer<typeof CreateSchema>) {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input", issues: parsed.error.flatten() };

  const [row] = await db.insert(standards).values(parsed.data).returning();
  return { ok: true as const, standard: row };
}

export async function updateStandard(
  id: number,
  patch: z.infer<typeof UpdateSchema>
) {
  const parsed = UpdateSchema.safeParse(patch ?? {});
  if (!parsed.success) return { ok: false as const, error: "Invalid patch", issues: parsed.error.flatten() };
  if (Object.keys(parsed.data).length === 0) return { ok: false as const, error: "No fields to update" };

  const [row] = await db.update(standards).set(parsed.data).where(eq(standards.id, id)).returning();
  if (!row) return { ok: false as const, error: "Standard not found" };
  return { ok: true as const, standard: row };
}

/** Prevent delete if any of its items are mapped. */
export async function deleteStandard(id: number) {
  // Find any items under this standard
  const items = await db
    .select({ id: standardItems.id })
    .from(standardItems)
    .where(eq(standardItems.standardId, id));

  if (items.length) {
    const itemIds = items.map(i => i.id);
    const mapped = await db
      .select({ id: objectiveStandardItemMap.id })
      .from(objectiveStandardItemMap)
      .where(inArray(objectiveStandardItemMap.standardItemId, itemIds))
      .limit(1);

    if (mapped.length) {
      return { ok: false as const, error: "Cannot delete: items under this standard are mapped." };
    }
  }

  const deleted = await db.delete(standards).where(eq(standards.id, id)).returning();
  if (!deleted.length) return { ok: false as const, error: "Standard not found" };
  return { ok: true as const, deletedCount: deleted.length };
}
