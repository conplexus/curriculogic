"use server";

import { db } from "@/db/client";
import { standards, standardItems, objectiveStandardItemMap } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const CreateSchema = z.object({
  standardId: z.number().int().positive(),
  code: z.string().trim().max(64).nullable().optional(),
  title: z.string().trim().min(1).max(512),
});
const UpdateSchema = z.object({
  standardId: z.number().int().positive().optional(),
  code: z.string().trim().max(64).nullable().optional(),
  title: z.string().trim().min(1).max(512).optional(),
});

export async function listItems() {
  return db.query.standardItems.findMany({
    orderBy: (si, { asc }) => [asc(si.standardId), asc(si.code), asc(si.id)],
    with: {
      standard: true, // if you defined relations; otherwise remove
    },
  });
}

export async function createItem(input: z.infer<typeof CreateSchema>) {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input", issues: parsed.error.flatten() };

  // ensure standard exists
  const exists = await db.select({ id: standards.id }).from(standards).where(eq(standards.id, parsed.data.standardId)).limit(1);
  if (!exists.length) return { ok: false as const, error: "Standard not found" };

  const [row] = await db.insert(standardItems).values(parsed.data).returning();
  return { ok: true as const, item: row };
}

export async function updateItem(id: number, patch: z.infer<typeof UpdateSchema>) {
  const parsed = UpdateSchema.safeParse(patch ?? {});
  if (!parsed.success) return { ok: false as const, error: "Invalid patch", issues: parsed.error.flatten() };
  if (Object.keys(parsed.data).length === 0) return { ok: false as const, error: "No fields to update" };

  if (parsed.data.standardId) {
    const s = await db.select({ id: standards.id }).from(standards).where(eq(standards.id, parsed.data.standardId)).limit(1);
    if (!s.length) return { ok: false as const, error: "Target standard not found" };
  }

  const [row] = await db.update(standardItems).set(parsed.data).where(eq(standardItems.id, id)).returning();
  if (!row) return { ok: false as const, error: "Item not found" };
  return { ok: true as const, item: row };
}

export async function deleteItem(id: number) {
  const mapped = await db
    .select({ id: objectiveStandardItemMap.id })
    .from(objectiveStandardItemMap)
    .where(eq(objectiveStandardItemMap.standardItemId, id))
    .limit(1);

  if (mapped.length) return { ok: false as const, error: "Cannot delete: item is mapped to objectives." };

  const deleted = await db.delete(standardItems).where(eq(standardItems.id, id)).returning();
  if (!deleted.length) return { ok: false as const, error: "Item not found" };
  return { ok: true as const, deletedCount: deleted.length };
}

/** Optional: CSV bulk import.
 * Expected columns: standardId, code, title
 */
export async function importItemsCsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header) return { ok: false as const, error: "Empty CSV" };

  const cols = header.split(",").map((c) => c.trim());
  const idxStandardId = cols.indexOf("standardId");
  const idxCode = cols.indexOf("code");
  const idxTitle = cols.indexOf("title");
  if (idxStandardId < 0 || idxTitle < 0) return { ok: false as const, error: "Missing standardId or title columns" };

  const values: { standardId: number; code: string | null; title: string }[] = [];
  for (const ln of lines) {
    const cells = ln.split(","); // simple split (no quotes/escapes); swap for a real CSV parser if needed
    const standardId = Number(cells[idxStandardId]);
    const code = idxCode >= 0 ? (cells[idxCode]?.trim() || null) : null;
    const title = String(cells[idxTitle] || "").trim();
    const parsed = CreateSchema.safeParse({ standardId, code, title });
    if (!parsed.success) continue;
    values.push(parsed.data);
  }

  if (!values.length) return { ok: false as const, error: "No valid rows" };

  const inserted = await db.insert(standardItems).values(values).returning();
  return { ok: true as const, count: inserted.length };
}
