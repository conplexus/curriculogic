// src/app/error.tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-[60vh] grid place-items-center p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <button className="btn" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
