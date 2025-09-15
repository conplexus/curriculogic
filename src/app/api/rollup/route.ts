// src/app/api/rollup/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { courses } from "@/db/schema";

type Status = "GREEN" | "AMBER" | "RED" | "GRAY";
type RollupNode = { id: string; label: string; status: Status; type?: string };
type RollupEdge = { id: string; source: string; target: string };

export async function GET() {
  try {
    // 👇 Only select columns that exist in the actual DB
    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        term: courses.term,
        year: courses.year,
        credits: courses.credits,
      })
      .from(courses)
      .limit(50);

    const nodes: RollupNode[] = rows.map((c) => ({
      id: `course:${c.id}`,
      label: c.title ?? c.code ?? `Course ${c.id}`,
      status: "GREEN",
      type: "course",
    }));

    const edges: RollupEdge[] = []; // add relationships later

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error("GET /api/rollup failed", err);
    return NextResponse.json(
      { error: "Failed to fetch rollup data" },
      { status: 500 }
    );
  }
}
