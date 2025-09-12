"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveMappings } from "./actions";
import { useRouter, useSearchParams } from "next/navigation";

type Objective = {
  id: number;
  courseId: number;
  code: string | null;
  text: string;
  activeBool: boolean;
};
type Standard = { id: number; code: string; title: string };
type StandardItem = { id: number; standardId: number; code: string | null; title: string };

function normalize(ids: number[]) {
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}
function sameSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default function MappingsClient({
  objectives,
  standards,
  items,
  mapsByObjective: mapsInitial,
  initialObjectiveId,
}: {
  objectives: Objective[];
  standards: Standard[];
  items: StandardItem[];
  mapsByObjective: Record<number, number[]>;
  initialObjectiveId?: number;
}) {
  const [mapsByObjective, setMapsByObjective] = useState<Record<number, number[]>>(mapsInitial);
  const [objectiveId, setObjectiveId] = useState<number | undefined>(
    initialObjectiveId ?? objectives[0]?.id
  );

  const initialSelected = objectiveId ? normalize(mapsInitial[objectiveId] ?? []) : [];
  const [selected, setSelected] = useState<number[]>(initialSelected);

  const [isSaving, startSaving] = useTransition();
  const [msg, setMsg] = useState<{ type: "idle" | "ok" | "error" | "saving"; text?: string }>({
    type: "idle",
  });
  const [query, setQuery] = useState("");

  const router = useRouter();
  const sp = useSearchParams();

  // Re-sync selected when the objective changes
  const changeObjective = (id?: number) => {
    setObjectiveId(id);
    setSelected(id ? normalize(mapsByObjective[id] ?? []) : []);
    setMsg({ type: "idle" });
    router.replace(
      id
        ? `?${new URLSearchParams({ ...Object.fromEntries(sp), objectiveId: String(id) }).toString()}`
        : "?"
    );
  };

  // In case parent props (e.g., initialObjectiveId) change at runtime
  useEffect(() => {
    if (!objectiveId && objectives[0]?.id) {
      changeObjective(objectives[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectives]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : normalize([...prev, id])
    );
  };

  const save = () => {
    if (!objectiveId) return;
    const ids = normalize(selected);
    const before = mapsByObjective[objectiveId] ?? [];

    if (sameSet(ids, normalize(before))) {
      setMsg({ type: "idle" });
      return;
    }

    startSaving(async () => {
      setMsg({ type: "saving", text: "Saving…" });
      // optimistic
      setMapsByObjective((prev) => ({ ...prev, [objectiveId]: ids }));
      try {
        const res = await saveMappings(objectiveId, ids);
        if (!res?.ok) {
          // rollback
          setMapsByObjective((prev) => ({ ...prev, [objectiveId]: before }));
          setMsg({
            type: "error",
            text:
              (res as any)?.error ??
              "Could not save mappings. Please try again.",
          });
          return;
        }
        setMsg({ type: "ok", text: "Saved." });
      } catch (e) {
        // rollback
        setMapsByObjective((prev) => ({ ...prev, [objectiveId]: before }));
        setMsg({ type: "error", text: "Network or server error while saving." });
      }
    });
  };

  // Build items by standard
  const itemsByStandard = useMemo(() => {
    const m = new Map<number, StandardItem[]>();
    for (const it of items) {
      const arr = m.get(it.standardId) ?? [];
      arr.push(it);
      m.set(it.standardId, arr);
    }
    // stable sort by code then title for readability
    for (const [k, arr] of m) {
      arr.sort((a, b) => {
        const ac = a.code ?? "";
        const bc = b.code ?? "";
        return ac.localeCompare(bc) || a.title.localeCompare(b.title);
      });
      m.set(k, arr);
    }
    return m;
  }, [items]);

  // Filter predicate (global search)
  const q = query.trim().toLowerCase();
  const filterMatch = (it: StandardItem) =>
    !q ||
    (it.code ?? "").toLowerCase().includes(q) ||
    it.title.toLowerCase().includes(q);

  const selectedFromState = normalize(selected);
  const savedForThisObjective = normalize(mapsByObjective[objectiveId ?? -1] ?? []);
  const hasUnsaved = !sameSet(selectedFromState, savedForThisObjective);

  const totalSelected = selectedFromState.length;

  const selectAllInStandard = (standardId: number) => {
    const list = (itemsByStandard.get(standardId) ?? []).filter(filterMatch).map((i) => i.id);
    setSelected((prev) => normalize([...prev, ...list]));
  };
  const clearAllInStandard = (standardId: number) => {
    const ids = new Set((itemsByStandard.get(standardId) ?? []).map((i) => i.id));
    setSelected((prev) => prev.filter((id) => !ids.has(id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <select
          className="border rounded px-2 py-1 min-w-[12rem]"
          value={objectiveId ?? ""}
          onChange={(e) => changeObjective(e.target.value ? Number(e.target.value) : undefined)}
        >
          {objectives.length === 0 && <option value="">No objectives</option>}
          {objectives.map((o) => (
            <option key={o.id} value={o.id}>
              {(o.code ?? "Obj")} — {o.text.slice(0, 60)}
              {o.text.length > 60 ? "…" : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 grow">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Search items (code or title)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {totalSelected} selected
            {hasUnsaved ? " • unsaved" : ""}
          </span>
        </div>

        <button
          onClick={save}
          disabled={!objectiveId || isSaving || !hasUnsaved}
          className="ml-auto rounded border px-3 py-1 text-sm bg-white hover:shadow disabled:opacity-50"
          title={!hasUnsaved ? "No changes to save" : "Save mappings"}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {msg.type !== "idle" && (
        <div
          className={
            "text-sm rounded px-3 py-2 " +
            (msg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : msg.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-gray-50 text-gray-700 border border-gray-200")
          }
        >
          {msg.text}
        </div>
      )}

      {!objectiveId ? (
        <div className="text-gray-500 text-sm">Pick an objective to start.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {standards.map((s) => {
            const allInStandard = itemsByStandard.get(s.id) ?? [];
            const visible = allInStandard.filter(filterMatch);
            const selectedInStandard = visible.filter((it) => selectedFromState.includes(it.id));

            return (
              <div key={s.id} className="rounded-xl border bg-white">
                <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium flex items-center gap-2">
                  <span className="truncate" title={`${s.code} — ${s.title}`}>
                    {s.code} — {s.title}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">
                    {selectedInStandard.length}/{visible.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="text-xs border rounded px-2 py-0.5 bg-white hover:bg-gray-50"
                      onClick={() => selectAllInStandard(s.id)}
                      disabled={!visible.length}
                    >
                      Select all
                    </button>
                    <button
                      className="text-xs border rounded px-2 py-0.5 bg-white hover:bg-gray-50"
                      onClick={() => clearAllInStandard(s.id)}
                      disabled={!visible.length}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <ul className="p-2 space-y-1 max-h-80 overflow-auto">
                  {visible.map((it) => (
                    <li key={it.id} className="flex items-center gap-2">
                      <input
                        id={`it-${it.id}`}
                        type="checkbox"
                        checked={selected.includes(it.id)}
                        onChange={() => toggle(it.id)}
                      />
                      <label htmlFor={`it-${it.id}`} className="text-sm cursor-pointer select-none">
                        {(it.code ? `${it.code} — ` : "") + it.title}
                      </label>
                    </li>
                  ))}
                  {!visible.length && (
                    <li className="text-xs text-gray-500 px-1 py-1">
                      {q ? "No matches in this standard." : "No items in this standard."}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
