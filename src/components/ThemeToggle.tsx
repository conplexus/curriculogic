// src/components/ThemeToggle.tsx
"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
type Placement = "inline" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export default function ThemeToggle({
  placement = "inline",
  className = "",
}: {
  placement?: Placement;
  className?: string;
}) {
  const { mode, setMode, resolved } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycle = () => {
    if (mode === "light") setMode("dark");
    else if (mode === "dark") setMode("system");
    else setMode("light");
  };

  const label = mounted
    ? mode === "system"
      ? `System (${resolved})`
      : mode[0].toUpperCase() + mode.slice(1)
    : "Theme";

  const pos =
    placement === "inline"
      ? ""
      : placement === "top-left"
      ? "fixed left-3 top-3 z-30"
      : placement === "top-right"
      ? "fixed right-3 top-3 z-30"
      : placement === "bottom-left"
      ? "fixed left-3 bottom-3 z-30"
      : "fixed right-3 bottom-3 z-30";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label="Toggle color theme"
      title={`Theme: ${label} (click to change)`}
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs shadow-sm transition-colors",
        "bg-[var(--muted)] text-[var(--foreground)]",
        "hover:bg-[color-mix(in_oklab,var(--muted),white_4%)]",
        "dark:hover:bg-[color-mix(in_oklab,var(--muted),black_6%)]",
        pos,
        className,
      ].join(" ")}
      style={{ border: `1px solid var(--border)` }}
    >
      <ThemeGlyph mounted={mounted} resolved={resolved} />
      <span className="tabular-nums" suppressHydrationWarning>
        {label}
      </span>
      <span
        aria-hidden="true"
        className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
        style={mounted ? { background: "currentColor", opacity: 0.9 } : undefined}
      />
    </button>
  );
}

function ThemeGlyph({
  mounted,
  resolved,
}: {
  mounted: boolean;
  resolved: "light" | "dark";
}) {
  if (!mounted) return <span className="inline-block h-4 w-4 rounded-full border" />;
  return resolved === "dark" ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M12 18a6 6 0 100-12 6 6 0 000 12z" />
    </svg>
  );
}
