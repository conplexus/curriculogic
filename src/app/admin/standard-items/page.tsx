"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { listItems, createItem, updateItem, deleteItem, importItemsCsv } from "./actions";
import { listStandards } from "../standards/actions";

type Standard = { id: number; code: string; title: string };
type Item = { id: number; standardId: number; code: string | null; title: string };

export default function StandardItemsAdminPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [stdFilter, setStdFilter] = useState<number | "all">("all");
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "idle" | "ok" | "error"; text?: string }>({ type: "idle" });

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, items] = await Promise.all([listStandards(), listItems()]);
      setStandards(s as Standard[]);
      // `listItems` returned with: with: { standard: true } — but we only need the base fields here.
      setRows((items as any[]).map((r) => ({ id: r.id, standardId: r.standardId, code: r.code, title: r.title })));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const add = (formData: FormData) =>
    start(async () => {
      const standardId = Number(formData.get("standardId"));
      const code = String(formData.get("code") || "").trim() || null;
      const title = String(formData.get("title") || "");
      const res = await createItem({ standardId, code, title });
      if (res.ok) {
        setRows((p) => [res.item as Item, ...p]);
        setMsg({ type: "ok", text: "Item created." });
      } else {
        setMsg({ type: "error", text: res.error || "Failed to create item." });
      }
    });

  const patchRow = (id: number, patch: Partial<Item>) =>
    start(async () => {
      const prev = rows;
      setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r))); // optimistic
      const res = await updateItem(id, patch as any);
      if (!res.ok) {
        setRows(prev);
        setMsg({ type: "error", text: res.error || "Failed to save." });
      } else {
        setMsg({ type: "ok", text: "Saved." });
      }
    });

  const remove = (id: number) =>
    start(async () => {
      if (!confirm("Delete this item?")) return;
      const prev = rows;
      setRows((p) => p.filter((r) => r.id !== id));
      const res = await deleteItem(id);
      if (!res.ok) {
        setRows(prev);
        setMsg({ type: "error", text: res.error || "Failed to delete." });
      } else {
        setMsg({ type: "ok", text: "Deleted." });
      }
    });

  const filtered = useMemo(() => {
    const byStd = stdFilter === "all" ? rows : rows.filter((r) => r.standardId === stdFilter);
    if (!q) return byStd;
    const L = q.toLowerCase();
    return byStd.filter((r) => (r.code ?? "").toLowerCase().includes(L) || r.title.toLowerCase().includes(L));
  }, [rows, q, stdFilter]);

  const importCsv = (text: string) =>
    start(async () => {
      const res = await importItemsCsv(text);
      if (res.ok) {
        setMsg({ type: "ok", text: `Imported ${res.count} items.` });
        refresh();
      } else {
        setMsg({ type: "error", text: res.error || "Import failed." });
      }
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Standard Items</h1>

        <select
          className="border rounded px-2 py-1"
          value={stdFilter}
          onChange={(e) => setStdFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          title="Filter by Standard"
        >
          <option value="all">All standards</option>
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.title}
            </option>
          ))}
        </select>

        <input
          className="border rounded px-2 py-1"
          placeholder="Search code/title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {msg.type !== "idle" && (
        <div className={`text-sm rounded px-3 py-2 border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Create form */}
      <form action={add} className="grid gap-3 grid-cols-6 border rounded p-4 bg-white">
        <select name="standardId" className="border rounded px-2 py-1 col-span-2" required>
          <option value="">Select standard…</option>
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.title}
            </option>
          ))}
        </select>
        <input name="code" placeholder="Item code (optional)" className="border p-2 rounded col-span-2" />
        <input name="title" placeholder="Item title" className="border p-2 rounded col-span-2" required />
        <button className="col-span-6 rounded border px-3 py-2 bg-white hover:shadow disabled:opacity-50" disabled={isPending}>
          {isPending ? "Adding…" : "Add Item"}
        </button>
      </form>

      {/* CSV Import (simple textarea for MVP) */}
      <details className="border rounded p-4 bg-white">
        <summary className="cursor-pointer select-none text-sm font-medium">Bulk import via CSV</summary>
        <p className="text-xs text-gray-500 mt-2">
          Columns: <code>standardId,code,title</code>. One row per item.
        </p>
        <CsvImport onImport={importCsv} />
      </details>

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-64">Standard</th>
              <th className="p-2 text-left w-40">Code</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-right w-24">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <select
                    value={r.standardId}
                    className="border rounded px-2 py-1 w-64"
                    onChange={(e) => {
                      const standardId = Number(e.target.value);
                      setRows((p) => p.map((x) => (x.id === r.id ? { ...x, standardId } : x)));
                      patchRow(r.id, { standardId: Number(e.target.value) });
                    }}
                  >
                    {standards.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.title}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    value={r.code ?? ""}
                    className="border rounded px-2 py-1 w-40"
                    onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, code: e.target.value } : x)))}
                    onBlur={(e) => patchRow(r.id, { code: e.target.value.trim() || null })}
                  />
                </td>
                <td className="p-2">
                  <input
                    value={r.title}
                    className="border rounded px-2 py-1 w-full"
                    onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)))}
                    onBlur={(e) => patchRow(r.id, { title: e.target.value })}
                  />
                </td>
                <td className="p-2 text-right">
                  <button className="text-red-600 hover:underline" onClick={() => remove(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && !loading && (
              <tr><td className="p-4 text-gray-500" colSpan={4}>No items.</td></tr>
            )}
            {loading && (
              <tr><td className="p-4 text-gray-500" colSpan={4}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Tiny CSV import helper */
function CsvImport({ onImport }: { onImport: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <textarea
        className="w-full h-40 border rounded p-2 font-mono text-xs"
        placeholder={`standardId,code,title\n1,1.1,Demonstrates professionalism\n1,1.2,Communicates effectively`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="rounded border px-3 py-1 text-sm bg-white hover:shadow"
          onClick={() => onImport(text)}
        >
          Import
        </button>
        <button
          className="rounded border px-3 py-1 text-sm bg-white hover:shadow"
          onClick={() => setText("")}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
