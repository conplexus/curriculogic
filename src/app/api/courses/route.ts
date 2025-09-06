import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courses } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(courses).orderBy(courses.code);
  return NextResponse.json(rows);
}
