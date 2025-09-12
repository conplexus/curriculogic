"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listRollups,
  createRollup,
  updateRollup,
  deleteRollup,
  duplicateRollup,
} from "./actions";

type Rollup = {
  id: number;
  name: string;
  term: string | null;
  year: number | null;
  includeObjectives: boolean;
  standardId: number | null;
};

type Msg = { type: "idle" | "saving" | "ok" | "error"; text?: string };

const toIntOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const toStrOrNull = (v: string) => (v.trim() === "" ? null : v);

export default function RollupsAdminPage() {
  const [rows, setRows] = useState<Rollup[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>({ type: "idle" });
  const [isPending, start] = useTransition();

  // quick-fill inputs
  const [fillTerm, setFillTerm] = useState("");
  const [fillYear, setFillYear] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listRollups();
      setRows(data as Rollup[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const add = () =>
    start(async () => {
      setMsg({ type: "saving", text: "Creating…" });
      const res = await createRollup();
      if ((res as any)?.ok && (res as any).rollup) {
        setRows((prev) => [((res as any).rollup as Rollup), ...prev]);
        setMsg({ type: "ok", text: "Rollup created." });
      } else {
        await refresh();
        setMsg({ type: "error", text: (res as any)?.error ?? "Could not create rollup." });
      }
    });

  const patchRow = (id: number, patch: Partial<Rollup>) =>
    start(async () => {
      setMsg({ type: "saving", text: "Saving…" });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))); // optimistic
      const res = await updateRollup(id, patch as any);
      if (!(res as any)?.ok) {
        await refresh();
        setMsg({ type: "error", text: (res as any)?.error ?? "Could not save changes." });
      } else {
        const updated = (res as any).rollup as Rollup | undefined;
        if (updated) setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
        setMsg({ type: "ok", text: "Saved." });
      }
    });

  const remove = (id: number) =>
    start(async () => {
      if (!confirm("Delete this rollup? This cannot be undone.")) return;
      setMsg({ type: "saving", text: "Deleting…" });
      const prev = rows;
      setRows((p) => p.filter((r) => r.id !== id)); // optimistic
      const res = await deleteRollup(id);
      if (!(res as any)?.ok) {
        setRows(prev); // rollback
        setMsg({ type: "error", text: (res as any)?.error ?? "Could not delete rollup." });
      } else {
        setMsg({ type: "ok", text: "Deleted." });
      }
    });

  const duplicate = (id: number) =>
    start(async () => {
      setMsg({ type: "saving", text: "Duplicating…" });
      const res = await duplicateRollup(id);
      if ((res as any)?.ok && (res as any).rollup) {
        setRows((prev) => [((res as any).rollup as Rollup), ...prev]);
        setMsg({ type: "ok", text: "Duplicated." });
      } else {
        setMsg({ type: "error", text: (res as any)?.error ?? "Could not duplicate rollup." });
      }
    });

  const quickFill = () =>
    start(async () => {
      const termVal = toStrOrNull(fillTerm);
      const yearVal = toIntOrNull(fillYear);

      if (termVal === null && yearVal === null) {
        setMsg({ type: "error", text: "Enter a Term and/or Year to quick-fill." });
        return;
      }

      setMsg({ type: "saving", text: "Filling empty term/year…" });

      // build patches only for rows with empty fields
      const patches: Array<{ id: number; patch: Partial<Rollup> }> = [];
      rows.forEach((r) => {
        const patch: Partial<Rollup> = {};
        if (termVal !== null && (r.term === null || r.term === "")) patch.term = termVal;
        if (yearVal !== null && (r.year === null || r.year === ("" as any))) patch.year = yearVal;
        if (Object.keys(patch).length) patches.push({ id: r.id, patch });
      });

      if (!patches.length) {
        setMsg({ type: "ok", text: "Nothing to fill—no empty term/year fields." });
        return;
      }

      // optimistic local update
      setRows((prev) =>
        prev.map((r) => {
          const p = patches.find((x) => x.id === r.id)?.patch;
          return p ? { ...r, ...p } : r;
        })
      );

      // batch: do sequentially (simple & reliable)
      let ok = true;
      for (const { id, patch } of patches) {
        const res = await updateRollup(id, patch as any);
        if (!(res as any)?.ok) ok = false;
      }

      if (ok) {
        setMsg({ type: "ok", text: "Quick-fill complete." });
        // pull server-normalized values
        await refresh();
      } else {
        setMsg({ type: "error", text: "Some rows failed to update. Refreshed list." });
        await refresh();
      }
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Rollup Views</h1>
        <button
          onClick={add}
          className="ml-auto rounded border px-3 py-1 text-sm bg-white hover:shadow disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? "Working…" : "+ New Rollup"}
        </button>

        {/* Quick-fill bar */}
        <div className="flex items-center gap-2 border rounded p-2 bg-white">
          <input
            className="border rounded px-2 py-1 w-28"
            placeholder="Term (e.g., Fall)"
            value={fillTerm}
            onChange={(e) => setFillTerm(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 w-20"
            placeholder="Year"
            type="number"
            value={fillYear}
            onChange={(e) => setFillYear(e.target.value)}
          />
          <button
            onClick={quickFill}
            className="rounded border px-3 py-1 text-sm bg-white hover:shadow disabled:opacity-50"
            disabled={isPending}
            title="Fill only rows where Term/Year are empty"
          >
            Quick-fill empty
          </button>
        </div>
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

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-56">Name</th>
              <th className="p-2 text-left w-20">Term</th>
              <th className="p-2 text-left w-20">Year</th>
              <th className="p-2 text-left w-32">Include Objectives</th>
              <th className="p-2 text-left w-28">Standard Id</th>
              <th className="p-2 text-right w-40">Open</th>
              <th className="p-2 text-right w-24">Duplicate</th>
              <th className="p-2 text-right w-24">Delete</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <input
                    value={r.name ?? ""}
                    className="border rounded px-2 py-1 w-56"
                    onChange={(e) =>
                      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))
                    }
                    onBlur={(e) => patchRow(r.id, { name: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    value={r.term ?? ""}
                    className="border rounded px-2 py-1 w-20"
                    onChange={(e) =>
                      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, term: e.target.value } : x)))
                    }
                    onBlur={(e) => patchRow(r.id, { term: toStrOrNull(e.target.value) })}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={r.year ?? ""}
                    className="border rounded px-2 py-1 w-20"
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, year: e.target.value === "" ? null : Number(e.target.value) } : x
                        )
                      )
                    }
                    onBlur={(e) => patchRow(r.id, { year: toIntOrNull(e.target.value) })}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={!!r.includeObjectives}
                    onChange={(e) => {
                      const includeObjectives = e.target.checked;
                      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, includeObjectives } : x)));
                      patchRow(r.id, { includeObjectives });
                    }}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={r.standardId ?? ""}
                    className="border rounded px-2 py-1 w-28"
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, standardId: e.target.value === "" ? null : Number(e.target.value) } : x
                        )
                      )
                    }
                    onBlur={(e) => patchRow(r.id, { standardId: toIntOrNull(e.target.value) })}
                  />
                </td>
                <td className="p-2 text-right">
                  <a className="text-blue-600 hover:underline" href={`/rollup?viewId=${r.id}`}>
                    Open in Rollup
                  </a>
                </td>
                <td className="p-2 text-right">
                  <button className="text-gray-700 hover:underline" onClick={() => duplicate(r.id)}>
                    Duplicate
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button className="text-red-600 hover:underline" onClick={() => remove(r.id)} disabled={isPending}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={8}>
                  No saved rollups yet.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={8}>
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Quick-fill only touches empty Term/Year cells. Duplicate creates “Copy of …” and carries
        Term/Year/Standard/Include flags forward.
      </p>
    </div>
  );
}
