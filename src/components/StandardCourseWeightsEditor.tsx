import * as React from "react";

type Row = { id: number; courseNodeId: number; weightInStandard: string; code?: string; title?: string };

export default function StandardCourseWeightsEditor({
  standardNodeId,
  availableCourseNodes, // [{id, code, title}] from your graph for easy add
}: {
  standardNodeId: number;
  availableCourseNodes: Array<{ id: number; code?: string; title: string }>;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/db/sql?sql=${encodeURIComponent(
      `select scw.id, scw.course_node_id as "courseNodeId", scw.weight_in_standard as "weightInStandard", n.code, n.title
       from standard_course_weights scw
       join nodes n on n.id = scw.course_node_id
       where scw.standard_node_id = ${standardNodeId}
       order by scw.id desc`
    )}`);
    // ^ If you don't have a generic SQL route, replace with a bespoke GET that returns these rows.
    const data = await res.json();
    setRows(data.rows as Row[]);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [standardNodeId]);

  async function add(courseNodeId: number, weight = "1") {
    await fetch("/api/weights/standard-course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardNodeId, courseNodeId, weightInStandard: weight }),
    });
    await load();
  }

  async function update(id: number, weight: string) {
    await fetch("/api/weights/standard-course", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, weightInStandard: weight }),
    });
    await load();
  }

  async function remove(id: number) {
    await fetch("/api/weights/standard-course", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  if (loading) return <div className="text-sm opacity-70">loading course weights…</div>;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          className="border rounded px-2 py-1"
          defaultValue=""
          onChange={e => {
            const id = Number(e.target.value);
            if (id) add(id, "1");
            e.currentTarget.value = "";
          }}
        >
          <option value="" disabled>Add course…</option>
          {availableCourseNodes.map(c => (
            <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.title}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border rounded">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2">Course</th>
            <th className="text-left p-2 w-32">Weight</th>
            <th className="p-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.code ? `${r.code} — ` : ""}{r.title ?? r.courseNodeId}</td>
              <td className="p-2">
                <input
                  className="w-24 border rounded px-2 py-1"
                  defaultValue={r.weightInStandard}
                  onBlur={e => {
                    const val = e.currentTarget.value || "1";
                    if (val !== r.weightInStandard) update(r.id, val);
                  }}
                />
              </td>
              <td className="p-2 text-right">
                <button className="px-2 py-1 text-red-600" onClick={() => remove(r.id)}>Remove</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="p-2 opacity-60" colSpan={3}>No courses linked yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
