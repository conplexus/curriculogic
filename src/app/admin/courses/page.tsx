// /src/app/admin/courses/page.tsx
import { db } from "@/db/client";
import { courses } from "@/db/schema";
import { createCourse, updateCourse, deleteCourse } from "./actions";
import { revalidatePath } from "next/cache";

// ---- Server wrappers so client forms can call them with FormData ----
async function updateCourseAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid course id");
  await updateCourse(id, formData);
  revalidatePath("/admin/courses");
  return { ok: true as const };
}

async function deleteCourseAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid course id");
  await deleteCourse(id);
  revalidatePath("/admin/courses");
  return { ok: true as const };
}

export default async function Page() {
  const rows = await db.select().from(courses).orderBy(courses.code);
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>

      <CreateCourseForm action={createCourse} />

      <CoursesTable
        rows={rows}
        onUpdate={updateCourseAction}
        onDelete={deleteCourseAction}
      />
    </main>
  );
}

/* ===================== Client Components ===================== */
"use client";

import * as React from "react";

type ServerAction = (fd: FormData) => Promise<{ ok: true } | any>;

function CreateCourseForm({ action }: { action: ServerAction }) {
  const [state, setState] = React.useState<{ ok?: boolean; error?: string }>(
    {}
  );
  const [submitting, startTransition] = React.useTransition();

  return (
    <section className="rounded border p-4 space-y-3">
      <h2 className="font-medium">Add / Upsert Course</h2>
      <form
        action={(fd) =>
          startTransition(async () => {
            try {
              await action(fd);
              setState({ ok: true, error: undefined });
              (document.getElementById("create-form") as HTMLFormElement)?.reset();
            } catch (e: any) {
              setState({ ok: false, error: e?.message ?? "Failed to save." });
            }
          })
        }
        id="create-form"
        className="grid gap-3 grid-cols-2"
      >
        <input
          name="code"
          placeholder="Code (e.g., PHRX-501)"
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
        <button
          className="col-span-2 rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Add / Update"}
        </button>
      </form>

      {state.ok && !state.error && (
        <p className="text-sm rounded border border-green-200 bg-green-50 text-green-800 px-3 py-2">
          Saved. The table below is up to date.
        </p>
      )}
      {state.error && (
        <p className="text-sm rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2">
          {state.error}
        </p>
      )}
      <p className="text-xs text-gray-500">
        Tip: Re-submitting an existing <b>Code</b> updates its fields (idempotent).
      </p>
    </section>
  );
}

type Row = {
  id: number;
  code: string;
  title: string | null;
  term: string | null;
  year: number | null;
  credits: number | null;
};

function CoursesTable({
  rows,
  onUpdate,
  onDelete,
}: {
  rows: Row[];
  onUpdate: ServerAction;
  onDelete: ServerAction;
}) {
  const [editRow, setEditRow] = React.useState<Row | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<Row | null>(null);

  return (
    <section>
      <table className="w-full border mt-2">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Code</th>
            <th className="text-left p-2">Title</th>
            <th className="text-left p-2">Term</th>
            <th className="text-left p-2">Year</th>
            <th className="text-left p-2">Credits</th>
            <th className="text-left p-2 w-32">Actions</th>
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
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <button
                    className="rounded bg-gray-100 hover:bg-gray-200 px-2 py-1 text-sm"
                    onClick={() => setEditRow(r)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-sm"
                    onClick={() => setDeleteRow(r)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-sm text-gray-500">
                No courses yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Edit Modal */}
      {editRow && (
        <Modal onClose={() => setEditRow(null)} title={`Edit ${editRow.code}`}>
          <EditCourseForm
            row={editRow}
            action={onUpdate}
            onDone={() => setEditRow(null)}
          />
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteRow && (
        <Modal onClose={() => setDeleteRow(null)} title="Delete course?">
          <DeleteCourseForm
            row={deleteRow}
            action={onDelete}
            onDone={() => setDeleteRow(null)}
          />
        </Modal>
      )}
    </section>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-medium">{title}</h3>
          <button
            className="rounded px-2 py-1 text-sm hover:bg-gray-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditCourseForm({
  row,
  action,
  onDone,
}: {
  row: Row;
  action: ServerAction;
  onDone: () => void;
}) {
  const [state, setState] = React.useState<{ ok?: boolean; error?: string }>(
    {}
  );
  const [submitting, startTransition] = React.useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          try {
            await action(fd);
            setState({ ok: true });
            onDone();
          } catch (e: any) {
            setState({ ok: false, error: e?.message ?? "Update failed." });
          }
        })
      }
      className="grid grid-cols-2 gap-3"
    >
      <input type="hidden" name="id" defaultValue={row.id} />
      <label className="col-span-1 text-sm">
        <span className="block text-gray-600 mb-1">Code</span>
        <input
          name="code"
          defaultValue={row.code}
          className="border p-2 rounded w-full"
          required
        />
      </label>
      <label className="col-span-1 text-sm">
        <span className="block text-gray-600 mb-1">Title</span>
        <input
          name="title"
          defaultValue={row.title ?? ""}
          className="border p-2 rounded w-full"
          required
        />
      </label>
      <label className="col-span-1 text-sm">
        <span className="block text-gray-600 mb-1">Term</span>
        <input
          name="term"
          defaultValue={row.term ?? ""}
          className="border p-2 rounded w-full"
        />
      </label>
      <label className="col-span-1 text-sm">
        <span className="block text-gray-600 mb-1">Year</span>
        <input
          name="year"
          type="number"
          defaultValue={row.year ?? undefined}
          className="border p-2 rounded w-full"
        />
      </label>
      <label className="col-span-1 text-sm">
        <span className="block text-gray-600 mb-1">Credits</span>
        <input
          name="credits"
          type="number"
          step="0.5"
          defaultValue={row.credits ?? undefined}
          className="border p-2 rounded w-full"
        />
      </label>

      <div className="col-span-2 flex items-center gap-2 pt-2">
        <button
          className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="rounded px-3 py-2 text-sm hover:bg-gray-100"
          onClick={onDone}
        >
          Cancel
        </button>
      </div>

      {state.error && (
        <p className="col-span-2 text-sm rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2">
          {state.error}
        </p>
      )}
    </form>
  );
}

function DeleteCourseForm({
  row,
  action,
  onDone,
}: {
  row: Row;
  action: ServerAction;
  onDone: () => void;
}) {
  const [err, setErr] = React.useState<string | null>(null);
  const [submitting, startTransition] = React.useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          try {
            await action(fd);
            onDone();
          } catch (e: any) {
            setErr(e?.message ?? "Delete failed.");
          }
        })
      }
      className="space-y-3"
    >
      <input type="hidden" name="id" defaultValue={row.id} />
      <p className="text-sm">
        This will permanently remove <b>{row.code}</b>. If it has assessments or
        mappings, consider archiving instead.
      </p>
      <div className="flex items-center gap-2">
        <button
          className="rounded bg-red-600 text-white px-4 py-2 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          className="rounded px-3 py-2 text-sm hover:bg-gray-100"
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
      {err && (
        <p className="text-sm rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2">
          {err}
        </p>
      )}
    </form>
  );
}
