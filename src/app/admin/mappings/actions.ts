// src/app/admin/mappings/actions.ts
"use server";

import { headers } from "next/headers";

async function getBase() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Missing host header");
  return `${proto}://${host}`;
}

export async function saveObjectiveMappings(
  objectiveId: number,
  items: Array<{ standardItemId: number; weight: number }>
) {
  const base = await getBase();
  const res = await fetch(
    `${base}/api/objective-standard-item-map/objective/${objectiveId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Failed to save mappings: ${res.status} ${msg}`);
  }
}
