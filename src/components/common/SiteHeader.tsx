// src/components/SiteHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const HEADER_H = 56;   // default height (px)
const COMPACT_H = 40;  // collapsed height (px)
const SHOW_THRESHOLD = 8; // px delta before we toggle visibility

export default function SiteHeader() {
  const pathname = usePathname();

  // auto-hide on scroll
  const [hidden, setHidden] = useState(false);
  const [compact, setCompact] = useState(false); // manual collapse
  const [pinned, setPinned] = useState(true);    // if pinned, ignore auto-hide

  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (pinned) return; // if pinned, don't auto-hide
      const y = window.scrollY;
      const dy = y - lastY.current;

      // only react after small threshold to avoid jitter
      if (Math.abs(dy) > SHOW_THRESHOLD) {
        setHidden(dy > 0 && y > HEADER_H); // hide if scrolling down past header height
        lastY.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pinned]);

  // keyboard: "h" to toggle hidden, "c" to toggle compact, "p" to pin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName.match(/input|textarea/i)) return;
      if (e.key.toLowerCase() === "h") setHidden((v) => !v);
      if (e.key.toLowerCase() === "c") setCompact((v) => !v);
      if (e.key.toLowerCase() === "p") setPinned((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isRollup = pathname === "/rollup";

  return (
    <>
      {/* Hover reveal strip (appears when header is hidden) */}
      <div
        className="fixed inset-x-0 top-0 z-[49] h-2 cursor-pointer"
        aria-hidden
        onMouseEnter={() => setHidden(false)}
      />

      <header
        className={[
          "fixed inset-x-0 top-0 z-50 border-b bg-[var(--background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/60",
          "transition-[transform,height,background] duration-200 ease-out",
          hidden ? "-translate-y-full" : "translate-y-0",
        ].join(" ")}
        style={{
          height: compact ? COMPACT_H : HEADER_H,
        }}
        role="banner"
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
          {/* Left: brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold">
              Conplexus • CurricuLogic
            </Link>
            <span className="text-[11px] text-[var(--muted-foreground)]">MVP Build</span>
          </div>

          {/* Center: nav (optional) */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-4">
            <Link
              href="/rollup"
              className={[
                "text-sm font-medium transition-colors",
                isRollup
                  ? "text-[var(--ring)] underline underline-offset-4"
                  : "text-[var(--muted-foreground)] hover:text-[var(--ring)]",
              ].join(" ")}
            >
              RollupFlow
            </Link>
          </nav>

          {/* Right: controls */}
          <div className="flex items-center gap-1.5">
            {/* Pin/unpin: if pinned, header won't auto-hide */}
            <IconButton
              label={pinned ? "Unpin header (P)" : "Pin header (P)"}
              onClick={() => setPinned((v) => !v)}
              active={pinned}
              icon={PinIcon}
            />
            {/* Compact mode */}
            <IconButton
              label={compact ? "Expand header (C)" : "Compact header (C)"}
              onClick={() => setCompact((v) => !v)}
              active={compact}
              icon={ChevronCollapseIcon}
            />
            {/* Manual show/hide (useful on touch) */}
            <IconButton
              label={hidden ? "Show header (H)" : "Hide header (H)"}
              onClick={() => setHidden((v) => !v)}
              active={hidden}
              icon={EyeSlashIcon}
            />
          </div>
        </div>
      </header>

      {/* spacer so content doesn't jump when header height changes */}
      <div style={{ height: compact ? COMPACT_H : HEADER_H }} aria-hidden />
    </>
  );
}

/* ---------- Small shared icon button ---------- */
function IconButton({
  label,
  onClick,
  active,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={!!active}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[var(--foreground)]",
        "transition-colors",
        active
          ? "bg-[color:var(--rf-dots)]/40 border-[var(--border)]"
          : "bg-[color:var(--card)] border-[var(--border)] hover:bg-[color:var(--rf-dots)]/30",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/* ---------- Minimal inline icons (no deps) ---------- */
function PinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 17v5M15 3l6 6-3 3-6-6 3-3Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 21l8-8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function ChevronCollapseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M7 9l5-5 5 5M7 15l5 5 5-5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function EyeSlashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3 3l18 18M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-4.4M21 12s-3.6-6-9-6-9 6-9 6 1.6 2.7 4.2 4.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
