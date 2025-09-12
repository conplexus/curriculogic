import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { asc } from "drizzle-orm";
import { createCourse } from "./actions";

export const dynamic = "force-dynamic"; // avoid caching while developing

export default async function Page() {
  const rows = await db.select().from(courses).orderBy(asc(courses.code));

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>

      {/* Create form */}
      <form
        action={createCourse}
        className="grid gap-3 grid-cols-2 border rounded p-4 bg-white"
      >
        <input
          name="code"
          placeholder="Code (e.g., PHRM101)"
          className="border p-2 rounded col-span-1"
          required
        />
        <input
          name="title"
          placeholder="Title"
          className="border p-2 rounded col-span-1"
          required
        />
        <input
          name="term"
          placeholder="Term (Fall)"
          className="border p-2 rounded col-span-1"
        />
        <input
          name="year"
          type="number"
          placeholder="Year"
          className="border p-2 rounded col-span-1"
        />
        <input
          name="credits"
          type="number"
          step="0.5"
          placeholder="Credits"
          className="border p-2 rounded col-span-1"
        />
        <button
          type="submit"
          className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Add Course
        </button>
      </form>

      {/* Course table */}
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
