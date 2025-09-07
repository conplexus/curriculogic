import type { RollupNode, RollupEdge } from "@/lib/types";

export async function getRollup(params?: {
  term?: string;
  year?: number;
  standardId?: number;
}): Promise<{ nodes: RollupNode[]; edges: RollupEdge[] }> {
  const q = new URLSearchParams();
  if (params?.term) q.set("term", params.term);
  if (params?.year) q.set("year", String(params.year));
  if (params?.standardId) q.set("standardId", String(params.standardId));

  const qs = q.toString();
  const url = `/api/rollup${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch rollup (${res.status}): ${text}`);
  }
  return res.json();
}
