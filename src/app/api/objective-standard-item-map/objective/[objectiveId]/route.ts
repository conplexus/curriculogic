// src/app/api/objective-standard-item-map/objective/[objectiveId]/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { objectiveStandardItemMap } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const ReplaceSet = z.object({
  items: z.array(
    z.object({
      standardItemId: z.number().int().positive(),
      weight: z.number().nonnegative().max(10).default(1),
    })
  ),
});

// 👇 NOTE: params is a Promise now
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const oid = Number(objectiveId);

  const rows = await db
    .select()
    .from(objectiveStandardItemMap)
    .where(eq(objectiveStandardItemMap.objectiveId, oid));

  return NextResponse.json(rows, { headers: { "cache-control": "no-store" } });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const oid = Number(objectiveId);

  const body = await req.json();
  const parsed = ReplaceSet.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(objectiveStandardItemMap)
      .where(eq(objectiveStandardItemMap.objectiveId, oid));

    if (parsed.data.items.length) {
      await tx.insert(objectiveStandardItemMap).values(
        parsed.data.items.map((i) => ({
          objectiveId: oid,
          standardItemId: i.standardItemId,
          weight: i.weight,
        }))
      );
    }
  });

  return NextResponse.json(
    { success: true },
    { headers: { "cache-control": "no-store" } }
  );
}
