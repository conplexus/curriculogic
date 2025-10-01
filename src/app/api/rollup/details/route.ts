import { NextResponse } from "next/server";
import { computeStandardMeanWithEvidence } from "@/lib/rollup/compute";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cohortId = Number(searchParams.get("cohortId"));
  const standardNodeId = Number(searchParams.get("standardNodeId"));

  if (!cohortId || !standardNodeId) {
    return NextResponse.json({ error: "cohortId and standardNodeId are required (ints)" }, { status: 400 });
  }

  const data = await computeStandardMeanWithEvidence(cohortId, standardNodeId);
  return NextResponse.json(data);
}
