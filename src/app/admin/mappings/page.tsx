// src/app/admin/mappings/page.tsx
import React from "react";
import { headers } from "next/headers";
import MappingsClient from "./MappingsClient";
import { saveObjectiveMappings } from "./actions";

// Build absolute base URL from the incoming request
async function getBase() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Missing host header");
  return `${proto}://${host}`;
}

// normalize helper
async function asArray(res: Response) {
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  return [];
}

async function fetchCourses(base: string) {
  return asArray(
    await fetch(`${base}/api/courses`, { cache: "no-store" })
  ) as Promise<Array<{ id: number; code: string; title: string }>>;
}
async function fetchObjectives(base: string, courseId?: number) {
  const qp = courseId ? `?courseId=${courseId}` : "";
  return asArray(
    await fetch(`${base}/api/course-objectives${qp}`, { cache: "no-store" })
  ) as Promise<Array<{ id: number; code: string | null; text: string }>>;
}
async function fetchStandardItems(base: string, standardId?: number) {
  const qp = standardId ? `?standardId=${standardId}` : "";
  return asArray(
    await fetch(`${base}/api/standard-items${qp}`, { cache: "no-store" })
  ) as Promise<Array<{ id: number; code: string | null; title: string }>>;
}
async function fetchExisting(base: string, objectiveId?: number) {
  if (!objectiveId)
    return [] as Array<{
      objectiveId: number;
      standardItemId: number;
      weight: number;
    }>;
  return asArray(
    await fetch(
      `${base}/api/objective-standard-item-map/objective/${objectiveId}`,
      { cache: "no-store" }
    )
  ) as Promise<
    Array<{ objectiveId: number; standardItemId: number; weight: number }>
  >;
}

export default async function MappingsAdminPage(props: {
  searchParams: Promise<{
    courseId?: string;
    objectiveId?: string;
    standardId?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const base = await getBase();

  const courseId = sp.courseId ? Number(sp.courseId) : undefined;
  const objectiveId = sp.objectiveId ? Number(sp.objectiveId) : undefined;
  const standardId = sp.standardId ? Number(sp.standardId) : undefined;

  const [courses, objectives, items, existing] = await Promise.all([
    fetchCourses(base),
    fetchObjectives(base, courseId),
    fetchStandardItems(base, standardId),
    fetchExisting(base, objectiveId),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">
        Objective → Standard Item Mappings
      </h1>
      <MappingsClient
        courses={courses}
        objectives={objectives}
        items={items}
        selectedCourseId={courseId}
        selectedObjectiveId={objectiveId}
        selectedStandardId={standardId}
        existing={existing.map((e) => [e.standardItemId, e.weight])}
        onSave={saveObjectiveMappings} // ✅ Server Action passed to the client form
      />
    </div>
  );
}
