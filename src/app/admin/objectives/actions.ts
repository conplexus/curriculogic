"use server";

import { db } from "@/db/client";
import { courseObjectives } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

// Validation schemas
const CreateObjectiveSchema = z.object({
  courseId: z.number().int().positive(),
  code: z.string().trim().max(50).nullable().optional(),
  text: z.string().trim().min(1),
  activeBool: z.boolean().optional(),
});

const UpdateObjectiveSchema = z.object({
  code: z.string().trim().max(50).nullable().optional(),
  text: z.string().trim().min(1).optional(),
  activeBool: z.boolean().optional(),
});

// List all objectives
export async function listObjectives() {
  return db.query.courseObjectives.findMany({
    orderBy: (o, { asc }) => [asc(o.courseId), asc(o.code), asc(o.id)],
  });
}

// Create a new objective
export async function createObjective(input: {
  courseId: number;
  code?: string | null;
  text: string;
  activeBool?: boolean;
}) {
  const parsed = CreateObjectiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input", issues: parsed.error.flatten() };
  }

  const [row] = await db
    .insert(courseObjectives)
    .values({
      courseId: parsed.data.courseId,
      code: parsed.data.code ?? "OBJ",
      text: parsed.data.text,
      activeBool: parsed.data.activeBool ?? true,
    })
    .returning();

  return { ok: true as const, objective: row };
}

// Update an existing objective
export async function updateObjective(
  id: number,
  patch: Partial<{ code: string | null; text: string; activeBool: boolean }>
) {
  const parsed = UpdateObjectiveSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid patch", issues: parsed.error.flatten() };
  }

  const [row] = await db
    .update(courseObjectives)
    .set(parsed.data)
    .where(eq(courseObjectives.id, id))
    .returning();

  if (!row) return { ok: false as const, error: "Objective not found" };
  return { ok: true as const, objective: row };
}

// Delete an objective
export async function deleteObjective(id: number) {
  const deleted = await db
    .delete(courseObjectives)
    .where(eq(courseObjectives.id, id))
    .returning();

  if (!deleted.length) return { ok: false as const, error: "Objective not found" };
  return { ok: true as const, deletedCount: deleted.length };
}
