// src/components/FlowToolbar.tsx
"use client";

type Props = {
  editMode: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onResetLayout: () => void;
  onFitView: () => void;
  onCreateNode: () => void;
  onDeleteSelected: () => void;
};

export default function FlowToolbar({
  editMode,
  onToggleEdit,
  onSave,
  onResetLayout,
  onFitView,
  onCreateNode,
  onDeleteSelected,
}: Props) {
  const Btn = ({
    className = "",
    ...p
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      {...p}
      className={[
        "rounded-md border px-2.5 py-1.5 text-xs font-medium",
        "transition-colors focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
        "border-[color:var(--border)] text-[color:var(--card-foreground)]",
        "hover:bg-white/5",
        className,
      ].join(" ")}
    />
  );

  const divider = "mx-1 h-5 w-px bg-[color:var(--border)]";

  return (
    <div
      className={[
        "flex items-center gap-2 rounded-xl border px-2 py-1 shadow-sm backdrop-blur",
        "border-[color:var(--border)] bg-[color:var(--card)]/85",
      ].join(" ")}
    >
      <Btn onClick={onFitView} title="Fit (F)">
        Fit
      </Btn>
      <Btn onClick={onToggleEdit} title="Toggle edit (drag)">
        {editMode ? "Stop Editing" : "Edit Layout"}
      </Btn>
      <div className={divider} />
      <Btn onClick={onSave} title="Save node positions">
        Save Layout
      </Btn>
      <Btn onClick={onResetLayout} title="Reset positions">
        Reset Layout
      </Btn>
      <div className={divider} />
      <Btn
        onClick={onCreateNode}
        title="Add node (will link to selected as parent)"
      >
        + Add Node
      </Btn>
      <Btn
        onClick={onDeleteSelected}
        title="Delete selected (Del)"
        className="text-red-400 hover:bg-red-500/10"
      >
        Delete
      </Btn>
    </div>
  );
}
