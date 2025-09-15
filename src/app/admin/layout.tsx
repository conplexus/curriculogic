// src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-border bg-background/70">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <a href="/" className="font-semibold">CurricuLogic</a>
          <nav className="flex gap-4 text-sm">
            <a className="hover:text-foreground text-muted-foreground" href="/admin/rollup">Rollup</a>
            {/* add links as needed */}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full p-4 sm:p-6">{children}</main>
    </div>
  );
}
