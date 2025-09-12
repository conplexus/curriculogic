// src/components/ThemeProvider.tsx
"use client";

import * as React from "react";

type Mode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type Ctx = {
  mode: Mode;
  resolved: Resolved;            // computed from mode + system
  setMode: (m: Mode) => void;
};

const ThemeContext = React.createContext<Ctx | null>(null);

function getSystem(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(mode: Mode) {
  const resolved: Resolved = mode === "system" ? getSystem() : mode;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);  // <-- drives your CSS tokens
  // optional: also a class if you want Tailwind's `dark:` utilities
  root.classList.toggle("dark", resolved === "dark");
  return resolved;
}

// Prevent theme FOUC on first paint
const noFouc = `
(() => {
  try {
    const key='theme-mode';
    let mode = localStorage.getItem(key) || 'system';
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const resolved = mode === 'system' ? system : mode;
    const r = document.documentElement;
    r.setAttribute('data-theme', resolved);
    r.classList.toggle('dark', resolved === 'dark');
  } catch {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, _setMode] = React.useState<Mode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme-mode") as Mode) || "system";
  });
  const [resolved, setResolved] = React.useState<Resolved>(() => (typeof window === "undefined" ? "light" : apply((localStorage.getItem("theme-mode") as Mode) || "system")));

  React.useEffect(() => {
    setResolved(apply(mode));
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  React.useEffect(() => {
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const cb = () => {
      if (mode === "system") setResolved(apply("system"));
    };
    q.addEventListener?.("change", cb);
    return () => q.removeEventListener?.("change", cb);
  }, [mode]);

  return (
    <>
      {/* anti-FOUC */}
      <script dangerouslySetInnerHTML={{ __html: noFouc }} />
      <ThemeContext.Provider value={{ mode, setMode: _setMode, resolved }}>
        {children}
      </ThemeContext.Provider>
    </>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
