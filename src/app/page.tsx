// src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-8 sm:p-16 bg-background text-foreground">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl gap-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Welcome to <span className="text-accent">CurricuLogic</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Curriculum mapping and accreditation rollup—visualize connections between{" "}
          <span className="font-semibold">courses, objectives, and standards</span>.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <Link
            href="/admin/rollup"
            className="btn"
          >
            Go to Dashboard
          </Link>
          <a
            href="https://conplexus.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-muted"
          >
            Learn More
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
        <a
          href="https://github.com/conplexus"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          GitHub
        </a>
        <a
          href="https://nextjs.org/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Docs
        </a>
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Powered by Vercel
        </a>
      </footer>
    </div>
  );
}
