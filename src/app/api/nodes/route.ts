import { NextResponse } from "next/server";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

const NodeCreate = z.object({
  mapId: z.coerce.number().int(),
  kind: z.enum(["STANDARD","COURSE","OBJECTIVE","ASSESSMENT","ITEM"]),
  title: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  meta: z.record(z.unknown()).optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mapId = Number(searchParams.get("mapId"));
    if (!Number.isInteger(mapId)) {
      return NextResponse.json({ error: "mapId query param is required" }, { status: 400 });
    }

    const rows = await db.select().from(schema.nodes).where(eq(schema.nodes.mapId, mapId));
    // If x/y are numeric columns, PG returns strings — coerce if needed
    const data = rows.map(r => ({ ...r, x: r.x != null ? Number(r.x) : 0, y: r.y != null ? Number(r.y) : 0 }));
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("GET /api/nodes failed:", e);
    return NextResponse.json({ error: "Failed to list nodes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = NodeCreate.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { mapId, kind, title, code, description, x = 0, y = 0, meta } = parsed.data;

    const [row] = await db.insert(schema.nodes).values({
      mapId, kind, title,
      code: code ?? null,
      description: description ?? null,
      meta: meta ?? {},
      x: String(x ?? 0),
      y: String(y ?? 0),
    }).returning();

    return NextResponse.json(
      { ...row, x: row.x != null ? Number(row.x) : 0, y: row.y != null ? Number(row.y) : 0 },
      { status: 201 }
    )
  } catch (e: any) {
    console.error("POST /api/nodes failed:", e);
    return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
  }
};
