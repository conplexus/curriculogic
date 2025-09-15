// src/components/NodeEditor.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export type NodeEditorValues = {
  label: string;
  kind?: "standard" | "course" | "objective" | "assessment" | "question";
  parentId?: string | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  node: { id: string; label: string; kind?: string } | null;
  parentId?: string | null;
  /** NEW: display the parent's title in the banner */
  parentTitle?: string | null;

  onClose: () => void;
  onSave: (values: NodeEditorValues) => Promise<void> | void;
};

const KIND_OPTIONS = [
  { value: "standard", label: "standard" },
  { value: "course", label: "course" },
  { value: "objective", label: "objective" },
  { value: "assessment", label: "assessment" },
  { value: "question", label: "question" },
] as const;

export default function NodeEditor({
  open,
  mode,
  node,
  parentId,
  parentTitle,
  onClose,
  onSave,
}: Props) {
  const isCreate = mode === "create";

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]["value"]>("standard");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setLabel("");
      setKind("standard");
    } else {
      setLabel(node?.label ?? "");
      setKind((node?.kind as any) ?? "standard");
    }
  }, [open, isCreate, node]);

  const titleText = isCreate ? "Add node" : `Edit node — ${node?.label ?? ""}`;

  const canSubmit = label.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave({
        label: label.trim(),
        kind,
        parentId: parentId ?? null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div
        className={[
          "relative w-full max-w-[520px] rounded-2xl border",
          "bg-white text-slate-900 border-slate-200",
          "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700",
          "shadow-2xl"
        ].join(" ")}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="text-[15px] font-semibold opacity-90">{titleText}</h3>
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        {/* top notice (create as child) */}
        {isCreate && parentId && (
          <div
            className={[
              "mx-5 mt-3 rounded-md border px-3 py-2 text-[12.5px]",
              "bg-slate-50 text-slate-700 border-slate-200",
              "dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700",
            ].join(" ")}
          >
            Will be added as a <span className="font-semibold">child</span> of{" "}
            <span className="font-semibold">
              {parentTitle ?? parentId}
            </span>
          </div>
        )}

        {/* body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1">
              Label
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Quadratic Equations"
              className={[
                "w-full h-9 rounded-md border px-2 text-sm outline-none",
                "bg-white/95 text-slate-900 placeholder:text-slate-400",
                "border-slate-300 focus:ring-2 focus:ring-blue-400",
                "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
                "dark:border-slate-700 dark:focus:ring-blue-500"
              ].join(" ")}
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1">
              Kind
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              disabled={false} // optional: keep editable; set false if you want edit allowed
              className={[
                "w-full h-9 rounded-md border px-2 text-sm outline-none",
                "bg-white/95 text-slate-900",
                "border-slate-300 focus:ring-2 focus:ring-blue-400",
                "disabled:opacity-70 disabled:cursor-not-allowed",
                "dark:bg-slate-900 dark:text-slate-100",
                "dark:border-slate-700 dark:focus:ring-blue-500"
              ].join(" ")}
            >
              {KIND_OPTIONS.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-4">
          <button
            onClick={onClose}
            className={[
              "h-9 rounded-md px-3 text-sm",
              "bg-slate-100 text-slate-800 hover:bg-slate-200",
              "dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            ].join(" ")}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              "h-9 rounded-md px-3 text-sm",
              canSubmit
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-blue-400/60 text-white/70 cursor-not-allowed",
            ].join(" ")}
          >
            {isCreate ? (saving ? "Creating…" : "Create") : (saving ? "Saving…" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
