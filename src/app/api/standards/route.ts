export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { standards } from "@/db/schema";
import { z } from "zod";

export async function GET() {
  const rows = await db.select().from(standards);
  return NextResponse.json(rows);
}

const StandardCreate = z.object({
  name: z.string(),
  authority: z.string(),
  version: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = StandardCreate.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  const [row] = await db.insert(standards).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
