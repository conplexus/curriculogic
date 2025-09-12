// src/app/not-found.tsx
export default function NotFound() {
  return (
    <main className="min-h-[60vh] grid place-items-center text-center p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">
          We couldn’t find what you’re looking for.
        </p>
        <a href="/" className="btn">Go home</a>
      </div>
    </main>
  );
}
