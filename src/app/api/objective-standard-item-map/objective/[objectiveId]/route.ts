// src/app/api_disabled/objective-standard-item-map/objective/[objectiveId]/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { objectiveStandardItemMap } from "@/db/schema";
import { eq } from "drizzle-orm";

// Accept numbers or numeric strings, dedupe, keep >0 ints
const Body = z.object({
  standardItemIds: z
    .array(z.coerce.number().int().positive())
    .default([])
    .transform((arr) => Array.from(new Set(arr))),
});

function badRequest(msg: unknown) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function serverError(msg = "Internal Server Error") {
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const { objectiveId } = await ctx.params; // ✅ avoid Next.js warning
    const oid = Number(objectiveId);
    if (!Number.isFinite(oid) || oid <= 0) {
      return badRequest("Invalid objectiveId");
    }

    const rows = await db
      .select()
      .from(objectiveStandardItemMap)
      .where(eq(objectiveStandardItemMap.objectiveId, oid));

    // Return just the Standard Item IDs for simpler UI consumption
    return NextResponse.json(rows.map((r) => r.standardItemId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("GET objective mappings failed:", err);
    return serverError();
  }
}

// Replace all mappings for this objective (idempotent "set" semantics)
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const { objectiveId } = await ctx.params; // ✅ avoid Next.js warning
    const oid = Number(objectiveId);
    if (!Number.isFinite(oid) || oid <= 0) {
      return badRequest("Invalid objectiveId");
    }

    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return badRequest(parsed.error.format());
    }
    const { standardItemIds } = parsed.data;

    // Single transaction: delete then re-insert (if any)
    await db.transaction(async (tx) => {
      await tx
        .delete(objectiveStandardItemMap)
        .where(eq(objectiveStandardItemMap.objectiveId, oid));

      if (standardItemIds.length > 0) {
        await tx.insert(objectiveStandardItemMap).values(
          standardItemIds.map((sid) => ({
            objectiveId: oid,
            standardItemId: sid,
          }))
        );
      }
    });

    // 204 = success with no body
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("PUT objective mappings failed:", err);
    return serverError();
  }
}
