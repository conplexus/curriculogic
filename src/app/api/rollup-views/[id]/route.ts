// src/app/api_disabled/rollup-views/[id]/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { rollupViews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// TODO: replace with your real column schema.
// Example scaffold: name (string), filters/layout (json), includeObjectives (bool)
const PatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    filters: z.any().optional(),
    layout: z.any().optional(),
    includeObjectives: z.coerce.boolean().optional(),
  })
  .strict();

function badRequest(msg: unknown) {
  return NextResponse.json({ error: msg }, { status: 400, headers: { "cache-control": "no-store" } });
}
function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "cache-control": "no-store" } });
}
function serverError() {
  return new NextResponse("Internal Server Error", { status: 500, headers: { "cache-control": "no-store" } });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params; // ✅ avoid Next.js warning
    const vid = Number(id);
    if (!Number.isFinite(vid) || vid <= 0) return badRequest("Invalid id");

    const row = await db.query.rollupViews.findFirst({
      where: (v, { eq }) => eq(v.id, vid),
    });
    if (!row) return notFound();

    return NextResponse.json(row, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("GET /rollup-views/[id] failed:", e);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params; // ✅
    const vid = Number(id);
    if (!Number.isFinite(vid) || vid <= 0) return badRequest("Invalid id");

    const json = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return badRequest(parsed.error.format());

    // Optional: ensure the view exists first for a clean 404
    const exists = await db.query.rollupViews.findFirst({
      where: (v, { eq }) => eq(v.id, vid),
      columns: { id: true },
    });
    if (!exists) return notFound();

    const [row] = await db
      .update(rollupViews)
      .set(parsed.data)
      .where(eq(rollupViews.id, vid))
      .returning();

    return NextResponse.json(row, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("PATCH /rollup-views/[id] failed:", e);
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params; // ✅
    const vid = Number(id);
    if (!Number.isFinite(vid) || vid <= 0) return badRequest("Invalid id");

    // Optional: 404 if it doesn't exist
    const exists = await db.query.rollupViews.findFirst({
      where: (v, { eq }) => eq(v.id, vid),
      columns: { id: true },
    });
    if (!exists) return notFound();

    await db.delete(rollupViews).where(eq(rollupViews.id, vid));
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("DELETE /rollup-views/[id] failed:", e);
    return serverError();
  }
}
