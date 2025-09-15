// /src/app/admin/courses/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// ----- Validation -----
const TermEnum = z.enum(["Fall", "Spring", "Summer", "Winter"]).optional().nullable();

const CourseInput = z.object({
  code: z.string().min(1, "Code is required").transform((s) => s.trim().toUpperCase()),
  title: z.string().min(1, "Title is required").transform((s) => s.trim()),
  term: TermEnum.default(null),
  year: z
    .string()
    .or(z.number())
    .optional()
    .transform((v) => (v === undefined || v === null || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 2000 && v <= 2100), {
      message: "Year must be between 2000 and 2100",
    }),
  credits: z
    .string()
    .or(z.number())
    .optional()
    .transform((v) => (v === undefined || v === null || v === "" ? null : Number(v)))
    .refine((v) => v === null || (typeof v === "number" && v >= 0 && v <= 50), {
      message: "Credits must be between 0 and 50",
    }),
});

function formToObject(fd: FormData) {
  return {
    code: String(fd.get("code") ?? ""),
    title: String(fd.get("title") ?? ""),
    term: (fd.get("term") as string) ?? undefined,
    year: (fd.get("year") as string) ?? undefined,
    credits: (fd.get("credits") as string) ?? undefined,
  };
}

// ----- Create (idempotent upsert by code) -----
export async function createCourse(formData: FormData) {
  const parsed = CourseInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(msg);
  }
  const { code, title, term, year, credits } = parsed.data;

  // If a course with this code exists, update basic fields (idempotent).
  const existing = await db.query.courses.findFirst({ where: eq(courses.code, code) });

  if (existing) {
    await db
      .update(courses)
      .set({
        title,
        term: term ?? existing.term,
        year: year ?? existing.year,
        credits: credits ?? existing.credits,
      })
      .where(eq(courses.id, existing.id));
  } else {
    await db.insert(courses).values({ code, title, term, year, credits });
  }

  revalidatePath("/admin/courses");
  return { ok: true };
}

// ----- Update (by id) -----
export async function updateCourse(id: number, formData: FormData) {
  const parsed = CourseInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(msg);
  }
  const { code, title, term, year, credits } = parsed.data;

  // Guard unique code (if user changes it to another existing)
  const dupe = await db.query.courses.findFirst({
    where: and(eq(courses.code, code), eq(courses.code, code)),
  });
  if (dupe && dupe.id !== id) {
    throw new Error(`Course code "${code}" is already in use.`);
  }

  await db
    .update(courses)
    .set({ code, title, term, year, credits })
    .where(eq(courses.id, id));

  revalidatePath("/admin/courses");
  return { ok: true };
}

// ----- Delete (by id) -----
export async function deleteCourse(id: number) {
  // Optional: add checks to prevent deleting referenced rows (assessments, etc.)
  await db.delete(courses).where(eq(courses.id, id));
  revalidatePath("/admin/courses");
  return { ok: true };
}
