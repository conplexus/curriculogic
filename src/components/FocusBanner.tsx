"use client";

type Props = {
  nodeLabel: string | null;
  onExit: () => void;
  className?: string;
};

export default function FocusBanner({ nodeLabel, onExit, className }: Props) {
  if (!nodeLabel) return null;

  return (
    <div
      className={[
        "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3 py-1 text-[11.5px] text-blue-800 shadow-sm",
        className ?? "",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
      <span className="font-medium truncate max-w-[28ch]">
        Focused on: <span className="font-semibold">{nodeLabel}</span>
      </span>
      <button
        type="button"
        onClick={onExit}
        className="ml-1 rounded-full border bg-white/70 px-2 py-0.5 text-[11px] text-blue-700 hover:shadow"
        title="Exit focus"
      >
        Exit
      </button>
    </div>
  );
}
