"use client";
import type { Status } from "@/lib/types";

type Props = {
  active: Record<Status, boolean>;
  onToggle: (s: Status) => void;
  onReset: () => void;
};

const STATUS_COLORS: Record<Status, string> = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GRAY: "#9ca3af",
};

const STATUS_LABELS: Record<Status, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
  GRAY: "Gray",
};

export default function StatusFilter({ active, onToggle, onReset }: Props) {
  const keys: Status[] = ["GREEN", "AMBER", "RED", "GRAY"];

  const container =
    "pointer-events-auto flex items-center gap-1.5 rounded-lg " +
    "border border-[color:var(--border)] bg-[color:var(--card)]/88 " +
    "backdrop-blur px-2 py-1 text-xs text-[color:var(--card-foreground)] shadow-sm";

  const btnBase =
    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 " +
    "border transition-colors focus:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";

  const divider = "mx-1 h-4 w-px bg-[color:var(--border)]";

  return (
    <div role="group" aria-label="Status filter" className={container}>
      {keys.map((k) => {
        const isOn = !!active[k];
        const btn =
          btnBase +
          " " +
          (isOn
            ? // active: subtle filled chip on dark
              "border-[color:var(--border)] bg-white/5"
            : // inactive: ghost until hover
              "border-transparent text-[color:var(--muted-foreground)] hover:bg-white/5");
        return (
          <button
            key={k}
            type="button"
            aria-pressed={isOn}
            title={STATUS_LABELS[k]}
            onClick={() => onToggle(k)}
            className={btn}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[k] }}
              aria-hidden="true"
            />
            <span className="tracking-tight">{STATUS_LABELS[k]}</span>
          </button>
        );
      })}

      <span className={divider} />

      <button
        type="button"
        onClick={onReset}
        className={
          btnBase +
          " border-[color:var(--border)] text-[color:var(--card-foreground)] hover:bg-white/5"
        }
        title="Show all statuses"
      >
        Reset
      </button>
    </div>
  );
}
