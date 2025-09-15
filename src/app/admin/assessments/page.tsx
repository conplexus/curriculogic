// /src/app/admin/assessments/page.tsx
import { importAssessmentCSVAction } from "./actions";
import React from "react";

type ImportState = { ok: boolean; error?: string | null };

async function importWrapper(_prev: ImportState, fd: FormData): Promise<ImportState> {
  "use server";
  try {
    await importAssessmentCSVAction(fd);
    return { ok: true, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Import failed. Please check the CSV and try again.";
    return { ok: false, error: msg };
  }
}

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Assessments</h1>

      <section className="rounded border p-4 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Import Question Performance (CSV)</h2>
            <p className="text-sm text-gray-600 mt-1">
              Use the template with columns:
              <code className="ml-1 break-all">
                AssessmentTitle, AssessmentKind, AdministeredAt, CourseCode, QuestionLabel, Points, Correct, Incorrect, Blank
              </code>
            </p>
          </div>
          <CSVTemplateButton />
        </header>

        <ImportForm />
        <p className="text-xs text-gray-500">
          Tip: For idempotent updates, re-upload the same assessment after edits—the importer re-computes rollups for that assessment.
        </p>
      </section>
    </main>
  );
}

/* ---------- Client components ---------- */

function CSVTemplateButton() {
  "use client";
  const onDownload = () => {
    const headers = [
      "AssessmentTitle",
      "AssessmentKind",
      "AdministeredAt",
      "CourseCode",
      "QuestionLabel",
      "Points",
      "Correct",
      "Incorrect",
      "Blank",
    ];
    // one example row (you can change/remove later)
    const example = [
      "Midterm Exam 1",
      "Exam",
      "2025-10-15",
      "PHRX-501",
      "Q1",
      "1",
      "72",
      "18",
      "10",
    ];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assessment_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onDownload}
      className="rounded bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 text-sm"
      title="Download CSV template"
    >
      CSV Template
    </button>
  );
}

function ImportForm() {
  "use client";
  const [state, formAction] = React.useFormState(importWrapper, { ok: false, error: null });
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        try {
          await formAction(fd);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-3"
    >
      <input
        type="file"
        name="file"
        accept=".csv"
        required
        className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700 hover:file:bg-blue-100"
      />

      <div className="flex items-center gap-3">
        <button
          className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Uploading…" : "Upload"}
        </button>

        <span className="text-xs text-gray-500">
          {submitting
            ? "Parsing CSV and updating stats…"
            : "Large files may take a few seconds."}
        </span>
      </div>

      {/* Messages */}
      {state.ok && !state.error && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Import complete. Page data refreshed.
        </div>
      )}
      {state.error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {state.error}
        </div>
      )}
    </form>
  );
}
