// app/api/edges/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EdgeCreate = z.object({
  mapId: z.coerce.number().int(),
  sourceId: z.coerce.number().int(),
  targetId: z.coerce.number().int(),
  label: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mapId = Number(url.searchParams.get("mapId"));
    if (!Number.isInteger(mapId)) {
      return NextResponse.json({ error: "mapId query param is required" }, { status: 400 });
    }
    const rows = await db.select().from(schema.edges).where(eq(schema.edges.mapId, mapId));
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error("GET /api/edges failed:", e);
    return NextResponse.json({ error: e?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = EdgeCreate.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { mapId, sourceId, targetId, label } = parsed.data;

    // Optional: guard against cross-map edges (recommended)
    const [s] = await db.select({ id: schema.nodes.id, mapId: schema.nodes.mapId })
      .from(schema.nodes).where(eq(schema.nodes.id, sourceId));
    const [t] = await db.select({ id: schema.nodes.id, mapId: schema.nodes.mapId })
      .from(schema.nodes).where(eq(schema.nodes.id, targetId));
    if (!s || !t) return NextResponse.json({ error: "sourceId or targetId not found" }, { status: 400 });
    if (s.mapId !== mapId || t.mapId !== mapId) {
      return NextResponse.json({ error: "source/target must belong to the same mapId" }, { status: 400 });
    }

    // Prevent duplicates within map
    const existing = await db.select().from(schema.edges).where(and(
      eq(schema.edges.mapId, mapId),
      eq(schema.edges.sourceId, sourceId),
      eq(schema.edges.targetId, targetId),
    ));
    if (existing.length) return NextResponse.json(existing[0], { status: 200 });

    const [row] = await db.insert(schema.edges).values({ mapId, sourceId, targetId, label: label ?? null }).returning();
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/edges failed:", e);
    return NextResponse.json({ error: e?.message ?? "Internal Server Error" }, { status: 500 });
  }
}
