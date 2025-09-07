"use client";
import type { Status } from "@/lib/types";

const statusDot: Record<Status, string> = {
  GREEN: "🟢",
  AMBER: "🟡",
  RED: "🔴",
  GRAY: "⚪",
};

type Props = {
  active: Record<Status, boolean>;
  onToggle: (s: Status) => void;
  onReset: () => void;
};

export default function StatusFilter({ active, onToggle, onReset }: Props) {
  const keys: Status[] = ["GREEN", "AMBER", "RED", "GRAY"];
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 rounded-md border bg-white/90 px-2 py-1 text-xs shadow">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onToggle(k)}
          className={[
            "inline-flex items-center gap-1 rounded px-2 py-0.5",
            active[k]
              ? "border bg-white shadow-sm"
              : "opacity-45 hover:opacity-70 border",
          ].join(" ")}
          title={k}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: statusDot[k] }}
          />
          <span>{k}</span>
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <button
        onClick={onReset}
        className="rounded border bg-white px-2 py-0.5 text-[11px] shadow-sm hover:shadow"
        title="Show All"
      >
        Reset
      </button>
    </div>
  );
}
