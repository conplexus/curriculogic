import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { nodes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await db.query.nodes.findFirst({ where: eq(nodes.id, Number(id)) });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: row.id, title: row.title, meta: row.meta ?? {} });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json(); // { title?: string, meta?: object }
  const updates: Partial<typeof nodes.$inferInsert> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (body.meta && typeof body.meta === "object") updates.meta = body.meta;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  await db.update(nodes).set(updates).where(eq(nodes.id, Number(id)));
  const row = await db.query.nodes.findFirst({ where: eq(nodes.id, Number(id)) });
  return NextResponse.json({ ok: true, node: row });
}
