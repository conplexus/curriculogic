// src/components/ConfirmDialog.tsx
"use client";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function ConfirmDialog({
  open,
  title,
  message = "This action cannot be undone.",
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        className={[
          "relative w-full max-w-[420px] rounded-2xl border",
          "bg-white text-slate-900 border-slate-200",
          "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700",
          "shadow-2xl"
        ].join(" ")}
      >
        <div className="px-5 pt-4">
          <h3 className="text-[15px] font-semibold opacity-90">{title}</h3>
        </div>

        <div className="px-5 py-3">
          <p className="text-[13px] text-slate-600 dark:text-slate-300">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-4">
          <button
            onClick={onCancel}
            className={[
              "h-9 rounded-md px-3 text-sm",
              "bg-slate-100 text-slate-800 hover:bg-slate-200",
              "dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            ].join(" ")}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-9 rounded-md px-3 text-sm bg-red-600 text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
