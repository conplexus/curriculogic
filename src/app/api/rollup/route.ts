// src/app/api/rollup/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import {
  courses,
  courseObjectives,
  standardItems,
  objectiveStandardItemMap,
} from "@/db/schema";

type Status = "GREEN" | "AMBER" | "RED" | "GRAY";
type RollupNode = {
  id: string;
  type: "card" | "group";
  label: string;
  status: Status;
};
type RollupEdge = { id: string; source: string; target: string };

// Placeholder thresholding (wire to real attainment later)
function statusFromPct(p?: number | null): Status {
  if (p == null || Number.isNaN(p)) return "GRAY";
  if (p >= 0.8) return "GREEN";
  if (p >= 0.6) return "AMBER";
  return "RED";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const term = url.searchParams.get("term") ?? undefined;
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : undefined;
    const standardIdParam = url.searchParams.get("standardId");
    const standardId = standardIdParam ? Number(standardIdParam) : undefined;

    // NEW: toggle objective visibility (default true for parity with your current graph)
    const includeObjectives =
      (url.searchParams.get("includeObjectives") ?? "true").toLowerCase() !==
      "false";

    // 1) Courses (optional term/year filter) — stable order for layout
    const cs = await db.query.courses.findMany({
      where: (c, ops) => {
        const clauses: any[] = [];
        if (term) clauses.push(ops.eq(c.term, term));
        if (year) clauses.push(ops.eq(c.year, year));
        return clauses.length ? ops.and(...clauses) : undefined;
      },
      orderBy: (c, { asc }) => [asc(c.code), asc(c.id)],
    });
    const courseIds = cs.map((c) => c.id);
    if (courseIds.length === 0) {
      return Response.json(
        { nodes: [], edges: [] },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // 2) Objectives for those courses (even if we hide them in the final graph, we need them to map to SIs)
    const objs = await db.query.courseObjectives.findMany({
      where: (o, { inArray }) => inArray(o.courseId, courseIds),
      orderBy: (o, { asc }) => [asc(o.courseId), asc(o.code), asc(o.id)],
    });
    const objIds = objs.map((o) => o.id);

    // 3) Objective -> Standard Item mappings
    const maps = objIds.length
      ? await db.query.objectiveStandardItemMap.findMany({
          where: (m, { inArray }) => inArray(m.objectiveId, objIds),
        })
      : [];
    const stdItemIds = [...new Set(maps.map((m) => m.standardItemId))];

    // 4) Standard Items (optional filter by standardId) — stable order
    const items = stdItemIds.length
      ? await db.query.standardItems.findMany({
          where: (si, ops) => {
            const clauses: any[] = [ops.inArray(si.id, stdItemIds)];
            if (standardId) clauses.push(ops.eq(si.standardId, standardId));
            return ops.and(...clauses);
          },
          orderBy: (si, { asc }) => [asc(si.code), asc(si.id)],
        })
      : [];

    // 5) If a standard filter was applied, trim maps to allowed items
    const allowedStdItemIds = standardId
      ? new Set(items.map((i) => i.id))
      : null;
    const filteredMaps = allowedStdItemIds
      ? maps.filter((m) => allowedStdItemIds.has(m.standardItemId))
      : maps;

    // 6) (Scaffold) compute attainment per Standard Item later.
    //    For now set everything to GRAY but keep the shape pluggable:
    //    const siPct = new Map<number, number>(); // <- fill when responses pipeline is ready

    // 7) Build nodes
    const nodes: RollupNode[] = [
      // Courses as cards
      ...cs.map((c) => ({
        id: `course:${c.id}`,
        type: "card" as const,
        label: `${c.code} — ${c.title}`,
        status: "GRAY" as Status, // later: aggregate of linked SIs or assessments
      })),
      // Objectives (optional) as cards
      ...(includeObjectives
        ? objs.map((o) => ({
            id: `obj:${o.id}`,
            type: "card" as const,
            label: `${o.code ?? "Obj"} — ${o.text}`,
            // quick visual: active objectives green, inactive gray
            status: o.activeBool ? ("GREEN" as Status) : ("GRAY" as Status),
          }))
        : []),
      // Standard Items as GROUPS for your GroupNode styling
      ...items.map((si) => ({
        id: `stditem:${si.id}`,
        type: "group" as const,
        label: `${si.code ?? ""} ${si.title}`.trim(),
        // later: statusFromPct(siPct.get(si.id))
        status: "GRAY" as Status,
      })),
    ];

    // 8) Build edges
    const edges: RollupEdge[] = [];

    if (includeObjectives) {
      // Course -> Objective
      edges.push(
        ...objs.map((o) => ({
          id: `e-course-${o.courseId}-obj-${o.id}`,
          source: `course:${o.courseId}`,
          target: `obj:${o.id}`,
        }))
      );
      // Objective -> Standard Item
      edges.push(
        ...filteredMaps.map((m) => ({
          id: `e-obj-${m.objectiveId}-stditem-${m.standardItemId}`,
          source: `obj:${m.objectiveId}`,
          target: `stditem:${m.standardItemId}`,
        }))
      );
    } else {
      // Simple view: Course -> Standard Item (if any of its objectives map to that SI)
      const objByCourse = new Map<number, number[]>();
      for (const o of objs) {
        const list = objByCourse.get(o.courseId) ?? [];
        list.push(o.id);
        objByCourse.set(o.courseId, list);
      }
      const siByObjective = new Map<number, number[]>();
      for (const m of filteredMaps) {
        const list = siByObjective.get(m.objectiveId) ?? [];
        list.push(m.standardItemId);
        siByObjective.set(m.objectiveId, list);
      }
      for (const c of cs) {
        const oids = objByCourse.get(c.id) ?? [];
        const siSet = new Set<number>();
        for (const oid of oids) {
          for (const sid of siByObjective.get(oid) ?? []) siSet.add(sid);
        }
        for (const sid of siSet) {
          edges.push({
            id: `e-course-${c.id}-si-${sid}`,
            source: `course:${c.id}`,
            target: `stditem:${sid}`,
          });
        }
      }
    }

    return Response.json(
      { nodes, edges },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/rollup error:", err);
    return new Response("Error building rollup", {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }
}
