import { NextResponse } from "next/server";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;                 // <-- await params (Next 15)
    const nodeId = Number(id);
    if (!Number.isInteger(nodeId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // ----- minimal validation (avoids Zod runtime crash)
    const set: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.title === "string" && body.title.length > 0) set.title = body.title;
    if (typeof body.kind === "string") set.kind = body.kind;
    if (body.code === null || typeof body.code === "string") set.code = body.code;
    if (body.description === null || typeof body.description === "string") set.description = body.description;

    if (typeof body.x === "number") set.x = String(body.x);
    if (typeof body.y === "number") set.y = String(body.y);

    // Merge meta (partial)
    if (isPlainObject(body.meta)) {
      set.meta = sql`jsonb_strip_nulls(coalesce(${schema.nodes.meta}, '{}'::jsonb) || ${JSON.stringify(
        body.meta
      )}::jsonb)`;
    }

    if (Object.keys(set).length === 1) {
      // only updatedAt
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const [row] = await db
      .update(schema.nodes)
      .set(set)
      .where(eq(schema.nodes.id, nodeId))
      .returning();

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Convert x/y back to numbers for the client
    const data = {
      ...row,
      x: row.x != null ? Number(row.x) : 0,
      y: row.y != null ? Number(row.y) : 0,
    };
    return NextResponse.json(data);
  } catch (e) {
    console.error("PUT /api/nodes/:id failed:", e);
    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const nodeId = Number(id);
    if (!Number.isInteger(nodeId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const res = await db
      .delete(schema.nodes)
      .where(eq(schema.nodes.id, nodeId))
      .returning({ id: schema.nodes.id });

    if (res.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/nodes/:id failed:", e);
    return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
