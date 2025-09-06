"use server";
import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function createCourse(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const term = String(formData.get("term") ?? "") || null;
  const year = formData.get("year") ? Number(formData.get("year")) : null;
  const credits = formData.get("credits")
    ? Number(formData.get("credits"))
    : null;

  if (!code || !title) throw new Error("Code and title are required");
  await db.insert(courses).values({ code, title, term, year, credits });
  revalidatePath("/admin/courses");
}
