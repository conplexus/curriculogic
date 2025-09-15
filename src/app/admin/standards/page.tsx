"use client";

import { useEffect, useState, useTransition } from "react";
import { listStandards, createStandard, updateStandard, deleteStandard } from "./actions";

type Standard = { id: number; code: string; title: string };

export default function StandardsAdminPage() {
  const [rows, setRows] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "idle" | "ok" | "error"; text?: string }>({ type: "idle" });

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listStandards();
      setRows(data as Standard[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const add = (formData: FormData) =>
    start(async () => {
      const code = String(formData.get("code") || "");
      const title = String(formData.get("title") || "");
      const res = await createStandard({ code, title });
      if (res.ok) {
        setRows((p) => [res.standard as Standard, ...p]);
        setMsg({ type: "ok", text: "Standard created." });
      } else {
        setMsg({ type: "error", text: res.error || "Failed to create standard." });
      }
    });

  const patchRow = (id: number, patch: Partial<Standard>) =>
    start(async () => {
      const prev = rows;
      setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r))); // optimistic
      const res = await updateStandard(id, patch);
      if (!res.ok) {
        setRows(prev); // rollback
        setMsg({ type: "error", text: res.error || "Failed to save." });
      } else {
        setMsg({ type: "ok", text: "Saved." });
      }
    });

  const remove = (id: number) =>
    start(async () => {
      if (!confirm("Delete this standard?")) return;
      const prev = rows;
      setRows((p) => p.filter((r) => r.id !== id));
      const res = await deleteStandard(id);
      if (!res.ok) {
        setRows(prev);
        setMsg({ type: "error", text: res.error || "Failed to delete." });
      } else {
        setMsg({ type: "ok", text: "Deleted." });
      }
    });

  const filtered = rows.filter(
    (r) =>
      r.code.toLowerCase().includes(q.toLowerCase()) ||
      r.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Standards</h1>
        <input
          className="border rounded px-2 py-1"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {msg.type !== "idle" && (
        <div className={`text-sm rounded px-3 py-2 border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {msg.text}
        </div>
      )}

      <form action={add} className="grid gap-3 grid-cols-3 border rounded p-4 bg-white">
        <input name="code" placeholder="Code (e.g., Std 1)" className="border p-2 rounded col-span-1" required />
        <input name="title" placeholder="Title" className="border p-2 rounded col-span-2" required />
        <button className="col-span-3 rounded border px-3 py-2 bg-white hover:shadow disabled:opacity-50" disabled={isPending}>
          {isPending ? "Adding…" : "Add Standard"}
        </button>
      </form>

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-40">Code</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-right w-24">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <input
                    value={r.code}
                    className="border rounded px-2 py-1 w-40"
                    onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, code: e.target.value } : x)))}
                    onBlur={(e) => patchRow(r.id, { code: e.target.value })}
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
              <tr><td className="p-4 text-gray-500" colSpan={3}>No standards.</td></tr>
            )}
            {loading && (
              <tr><td className="p-4 text-gray-500" colSpan={3}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
