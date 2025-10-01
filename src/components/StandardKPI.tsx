import * as React from "react";

export function useStandardRollup(standardNodeId: number | null, cohortId: number | null) {
  const [data, setData] = React.useState<{ meanPct: number | null; nCourses: number } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!standardNodeId || !cohortId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/rollup?standardNodeId=${standardNodeId}&cohortId=${cohortId}`)
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [standardNodeId, cohortId]);

  return { data, loading, error };
}

export default function StandardKPI({
  standardNodeId,
  cohortId,
}: {
  standardNodeId: number | null;
  cohortId: number | null;
}) {
  const { data, loading, error } = useStandardRollup(standardNodeId, cohortId);

  if (!standardNodeId || !cohortId) return null;
  if (loading) return <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-sm">computing…</span>;
  if (error) return <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-sm">error</span>;
  if (!data) return null;

  const pct = data.meanPct == null ? "–" : `${Math.round(data.meanPct * 100)}%`;
  const tone =
    data.meanPct == null ? "bg-gray-100 text-gray-700"
    : data.meanPct >= 0.75 ? "bg-green-100 text-green-700"
    : data.meanPct >= 0.6 ? "bg-yellow-100 text-yellow-700"
    : "bg-red-100 text-red-700";

  return (
    <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm ${tone}`}>
      <strong>{pct}</strong>
      <span className="opacity-70">({data.nCourses} course{data.nCourses === 1 ? "" : "s"})</span>
    </span>
  );
}
