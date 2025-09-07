// src/app/admin/mappings/MappingsClient.tsx
"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Course = { id: number; code: string; title: string };
type Objective = { id: number; code: string | null; text: string };
type StdItem = { id: number; code: string | null; title: string };

export default function MappingsClient({
  courses,
  objectives,
  items,
  selectedCourseId,
  selectedObjectiveId,
  selectedStandardId,
  existing, // Map<standardItemId, weight> serialized as [ [id, weight], ... ]
  onSave, // Server Action: (objectiveId: number, items: {standardItemId:number; weight:number}[]) => Promise<void>
}: {
  courses: Course[];
  objectives: Objective[];
  items: StdItem[];
  selectedCourseId?: number;
  selectedObjectiveId?: number;
  selectedStandardId?: number;
  existing: Array<[number, number]>;
  onSave: (
    objectiveId: number,
    items: Array<{ standardItemId: number; weight: number }>
  ) => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const existingMap = React.useMemo(() => new Map(existing), [existing]);

  const setParam = (key: string, val?: string) => {
    const next = new URLSearchParams(sp.toString());
    if (val && val.length) next.set(key, val);
    else next.delete(key);
    if (key === "courseId") next.delete("objectiveId"); // reset downstream selection
    router.push(`${pathname}?${next.toString()}`);
  };

  async function clientAction(formData: FormData) {
    const oid = Number(formData.get("objectiveId"));
    const payload: Array<{ standardItemId: number; weight: number }> = [];
    for (const it of items) {
      const on = formData.get(`on_${it.id}`) === "on";
      const w = Number(formData.get(`w_${it.id}`) || 1);
      if (on)
        payload.push({
          standardItemId: it.id,
          weight: Number.isFinite(w) ? w : 1,
        });
    }
    await onSave(oid, payload); // calls the Server Action passed from the page
    // refresh to show latest
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Course select */}
      <div className="flex gap-2 items-center">
        <div className="font-medium w-32">Course</div>
        <select
          className="border rounded px-2 py-1"
          value={selectedCourseId ?? ""}
          onChange={(e) =>
            setParam("courseId", e.currentTarget.value || undefined)
          }
        >
          <option value="">— Select —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Objective select */}
      <div className="flex gap-2 items-center">
        <div className="font-medium w-32">Objective</div>
        <select
          className="border rounded px-2 py-1"
          value={selectedObjectiveId ?? ""}
          onChange={(e) =>
            setParam("objectiveId", e.currentTarget.value || undefined)
          }
          disabled={!selectedCourseId}
        >
          <option value="">— Select —</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code ?? "Obj"} — {o.text}
            </option>
          ))}
        </select>
      </div>

      {/* Optional standard filter */}
      <div className="flex gap-2 items-center">
        <div className="font-medium w-32">Standard (optional)</div>
        <input
          className="border rounded px-2 py-1 w-52"
          placeholder="Standard ID"
          defaultValue={selectedStandardId ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              setParam("standardId", v || undefined);
            }
          }}
        />
      </div>

      {/* Mapping form */}
      {selectedObjectiveId ? (
        <form action={clientAction} className="space-y-4">
          <input type="hidden" name="objectiveId" value={selectedObjectiveId} />
          <div className="rounded border divide-y">
            {items.map((it) => {
              const checked = existingMap.has(it.id);
              const weight = existingMap.get(it.id) ?? 1;
              return (
                <div key={it.id} className="p-3 flex items-center gap-4">
                  <input
                    type="checkbox"
                    name={`on_${it.id}`}
                    defaultChecked={checked}
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {(it.code ?? "").trim()} {it.title}
                    </div>
                    <div className="text-xs opacity-70">ID: {it.id}</div>
                  </div>
                  <label className="text-sm">
                    Weight
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      defaultValue={weight}
                      name={`w_${it.id}`}
                      className="ml-2 w-24 border rounded px-2 py-1"
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <button className="px-3 py-2 rounded bg-black text-white">
            Save mappings
          </button>
        </form>
      ) : (
        <p className="text-sm opacity-70">
          Select a course and objective to edit mappings.
        </p>
      )}
    </div>
  );
}
