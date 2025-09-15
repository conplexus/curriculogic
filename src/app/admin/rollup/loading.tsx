// src/app/admin/rollup/loading.tsx
export default function RollupLoading() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="animate-pulse text-muted-foreground">Preparing graph…</div>
    </div>
  );
}
