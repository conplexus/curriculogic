export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { standardItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const standardId = url.searchParams.get("standardId");
  const where = standardId
    ? and(eq(standardItems.standardId, Number(standardId)))
    : undefined;
  const rows = await db.select().from(standardItems).where(where);
  return NextResponse.json(rows);
}

const ItemCreate = z.object({
  standardId: z.number().int(),
  code: z.string(),
  title: z.string(),
  description: z.string().optional(),
  parentId: z.number().int().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ItemCreate.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  const [row] = await db.insert(standardItems).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
