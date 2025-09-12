// src/app/admin/mappings/page.tsx
import { loadMappingsData } from "./actions";
import MappingsClient from "./MappingsClient";

export const dynamic = "force-dynamic"; // remove if you add caching/ISR

export default async function MappingsPage({
  searchParams,
}: {
  searchParams?: { objectiveId?: string };
}) {
  const data = await loadMappingsData();

  // Parse & validate objectiveId from query
  const raw = searchParams?.objectiveId ?? "";
  const fromQuery = Number.isFinite(Number(raw)) ? Number(raw) : undefined;

  // Only use it if it exists in fetched objectives
  const existingIds = new Set(data.objectives.map((o) => o.id));
  const initialObjectiveId =
    fromQuery && existingIds.has(fromQuery)
      ? fromQuery
      : data.objectives[0]?.id ?? undefined;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Objective ↔ Standard Items</h1>

      {data.objectives.length === 0 ? (
        <div className="text-sm text-gray-600 border rounded p-4 bg-white">
          No objectives found yet. Add course objectives first, then return here to map them to
          standard items.
        </div>
      ) : (
        <MappingsClient {...data} initialObjectiveId={initialObjectiveId} />
      )}
    </div>
  );
}
