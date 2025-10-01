"use client";
import * as React from "react";

export default function StandardEvidence({
  standardNodeId,
  cohortId,
}: { standardNodeId: number; cohortId: number }) {
  const [data, setData] = React.useState<any>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch(`/api/rollup/details?standardNodeId=${standardNodeId}&cohortId=${cohortId}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [open, standardNodeId, cohortId]);

  return (
    <div className="mt-3">
      <button className="rounded px-2 py-1 text-sm border" onClick={() => setOpen(o => !o)}>
        {open ? "Hide" : "Show"} evidence
      </button>
      {open && data && (
        <div className="mt-3 space-y-3 text-sm">
          {data.courses.map((c: any) => (
            <div key={c.courseNodeId} className="border rounded p-2">
              <div className="font-medium">{c.code ? `${c.code} — ` : ""}{c.title} • mean {(c.meanPct==null?"–":Math.round(c.meanPct*100)+"%")} • weight {c.weightInStandard}</div>
              <ul className="list-disc ml-5 mt-2">
                {c.objectives.map((o: any) => (
                  <li key={o.objectiveId} className="mb-1">
                    <div>
                      <span className="font-medium">{o.code ? `${o.code} — ` : ""}{o.title}</span>
                      {" • mean "}{o.meanPct==null?"–":Math.round(o.meanPct*100)+"%"}
                      {" • weight "}{o.weightInCourse}
                      {" • items "}{o.nQuestions}
                    </div>
                    <div className="ml-4 opacity-80">
                      {o.questions.map((q: any) => (
                        <div key={q.questionId}>
                          {q.label ?? `Q${q.questionId}`} — {(q.meanPct==null?"–":Math.round(q.meanPct*100)+"%")} (w {q.weightInObjective})
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {(!data.courses || data.courses.length===0) && <div className="opacity-60">No courses linked.</div>}
        </div>
      )}
    </div>
  );
}
