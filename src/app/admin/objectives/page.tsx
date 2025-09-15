import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic"; // avoid caching while developing

export default async function Page() {
  const rows = await db
    .select()
    .from(courses)
    .orderBy(asc(courses.code)); // ✅ use asc()

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No courses yet.</p>
      ) : (
        <table className="w-full text-sm border border-slate-200 rounded">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Code</th>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Term</th>
              <th className="text-left p-2">Year</th>
              <th className="text-left p-2">Credits</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.code}</td>
                <td className="p-2">{c.title}</td>
                <td className="p-2">{c.term ?? "—"}</td>
                <td className="p-2">{c.year ?? "—"}</td>
                <td className="p-2">{c.credits ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
