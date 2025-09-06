import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { createCourse } from "./actions";

export default async function Page() {
  const rows = await db.select().from(courses).orderBy(courses.code);
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>

      <form action={createCourse} className="grid gap-3 grid-cols-2">
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
          placeholder="Year (2025)"
          className="border p-2 rounded col-span-1"
        />
        <input
          name="credits"
          type="number"
          step="0.5"
          placeholder="Credits (3)"
          className="border p-2 rounded col-span-1"
        />
        <button className="col-span-2 border rounded p-2 hover:bg-gray-50">
          Add Course
        </button>
      </form>

      <table className="w-full border mt-6">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Code</th>
            <th className="text-left p-2">Title</th>
            <th className="text-left p-2">Term</th>
            <th className="text-left p-2">Year</th>
            <th className="text-left p-2">Credits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.code}</td>
              <td className="p-2">{r.title}</td>
              <td className="p-2">{r.term ?? "-"}</td>
              <td className="p-2">{r.year ?? "-"}</td>
              <td className="p-2">{r.credits ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
