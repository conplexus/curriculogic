"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RollupNode, RollupEdge, Status, NodeKind } from "@/lib/types";
import NodeDataEditor from "./NodeDataEditor";

// InsightsDrawer.tsx (top of file)
const DRAWER_THEME: "dark" | "light" = "dark"; // change to "light" to test quickly


const statusColors: Record<Status, string> = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GRAY: "#9ca3af",
};

type DrawerProps = {
  node: RollupNode | null;
  nodes: RollupNode[];
  edges: RollupEdge[];
  isFocused: boolean;
  onClose: () => void;
  onFocusBranch: (id: string) => void;
  onExitFocus: () => void;
  onCopyLink: (id: string) => void;
  onJumpTo: (id: string) => void;
  onUpdateNode?: (id: string, partial: Partial<RollupNode>) => Promise<void> | void;

  // NEW
  onEdit?: (id: string) => void;
  onCreateChild?: (parentId: string) => void;
  onDeleteNode?: (id: string) => void;

  onWidthChange?: (px: number) => void;
};


const MIN_W = 320;
const MAX_W = 800;
const LS_KEY = "insightsDrawer.width";

export default function InsightsDrawer(props: DrawerProps) {
  const { node } = props;
  if (!node) return null; // <-- MUST be before any hooks
  const {
    nodes, edges, isFocused,
    onClose, onFocusBranch, onExitFocus, onCopyLink, onJumpTo,
    onUpdateNode, onWidthChange,

    // also bring in the optional callbacks you use in JSX
    onEdit, onCreateChild, onDeleteNode,
  } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 380;
    const saved = Number(localStorage.getItem(LS_KEY));
    return Number.isFinite(saved) ? Math.min(MAX_W, Math.max(MIN_W, saved)) : 380;
  });

  // resizing
  const resizingRef = useRef(false);

  useEffect(() => {
    onWidthChange?.(width);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, String(width));
    }
  }, [width, onWidthChange]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX));
      setWidth(next);
    }
    function onUp() {
      resizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!node) return null;

  const children = useMemo(() => {
    return edges
      .filter(e => e.source === node.id)
      .map(e => nodes.find(n => n.id === e.target))
      .filter(Boolean) as RollupNode[];
  }, [node, nodes, edges]);

  const chip = (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${statusColors[node.status]}20`, color: statusColors[node.status] }}
    >
      {node.status}
    </span>
  );

  const btnBase = "rounded-md border px-2 py-1 text-sm transition-colors";
  const btnNeutral =
    DRAWER_THEME === "dark"
      ? `${btnBase} border-zinc-700 text-zinc-100 hover:bg-white/5`
      : `${btnBase} border-zinc-300 text-zinc-800 hover:bg-black/5`;

  const btnDanger =
    DRAWER_THEME === "dark"
      ? `${btnBase} border-red-400 text-red-300 hover:bg-red-900/20`
      : `${btnBase} border-red-300 text-red-600 hover:bg-red-50`;


  return (
    <aside
      className={[
        "fixed right-0 top-14 z-40 h-[calc(100vh-3.5rem)] border-l shadow-xl p-4 overflow-y-auto transition-colors",
        DRAWER_THEME === "dark"
          ? "bg-[#0f1626] border-zinc-800 text-zinc-100" // dark drawer
          : "bg-white border-zinc-200 text-zinc-900"     // white drawer
      ].join(" ")}
      style={{ width }}
    >
      <div
        className={[
          "h-full overflow-auto px-4 py-3 rounded-lg",
          DRAWER_THEME === "dark"
            ? "bg-[#0f1626]" // keep flat; tokens already match
            : "bg-white"
        ].join(" ")}
      >
      {/* Resize handle (left edge) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          resizingRef.current = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "col-resize";
        }}
        className="absolute left-0 top-0 h-full w-3 cursor-col-resize" // ⬅️ widen from w-1 → w-3 (≈12px)
        style={{ backgroundColor: "transparent" }} // keeps it invisible unless hovered
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(156,163,175,0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{node.label}</h2>
          <div className="mt-1 flex items-center gap-2">
            {chip}
            <span className="text-xs uppercase tracking-wide text-zinc-500">{node.kind}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isFocused ? (
          <button
            onClick={() => onFocusBranch(node.id)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Focus Branch
          </button>
        ) : (
          <button
            onClick={onExitFocus}
            className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Exit Focus
          </button>
        )}
        <button
          onClick={() => onCopyLink(node.id)}
          className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Copy Link
        </button>
        <button
          onClick={() => onJumpTo(node.id)}
          className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Jump To
        </button>

        {onEdit && (
          <button
            onClick={() => onEdit(node.id)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit Node
          </button>
        )}
        {onCreateChild && (
          <button
            onClick={() => onCreateChild(node.id)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Add Node
          </button>
        )}
        {onDeleteNode && (
          <button
            onClick={() => onDeleteNode(node.id)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 border-red-300 text-red-700 dark:text-red-300"
          >
            Delete Node
          </button>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="rounded-md bg-black text-white px-3 py-1.5 text-sm dark:bg-white dark:text-black"
        >
          Edit Data
        </button>
      </div>

      {/* Details */}
      <section className="mt-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Details</h3>

        <Field label="Description" value={node.data?.description ?? "—"} />

        {/* Kind-specific blocks */}
        <KindFields
          kind={node.kind}
          data={{
            performancePct:
              node.kind === "course" || node.kind === "assessment" || node.kind === "question"
                ? node.data?.averagePct ?? node.data?.courseAvgPct
                : undefined,
            achievementPct:
              node.kind === "objective" || node.kind === "standard"
                ? node.data?.achievementPct ?? node.data?.compliancePct
                : undefined,
            weight: node.data?.weight ?? (typeof node.data?.weightPct === "number"
              ? node.data.weightPct / 100
              : undefined),
          }}
        />
      </section>

      {/* Relationships */}
      <section className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Children</h3>
        {children.length === 0 ? (
          <p className="text-sm text-zinc-500 mt-2">None</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {c.label} <span className="text-xs text-zinc-500">({c.kind})</span>
                </span>
                <button
                  onClick={() => onJumpTo(c.id)}
                  className="text-xs underline underline-offset-2 text-zinc-600 hover:text-zinc-900"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Editor Modal */}
      {isEditing && (
        <NodeDataEditor
          kind={node.kind}
          initial={{ ...node.data, label: node.label }}
          onCancel={() => setIsEditing(false)}
          title={`Edit ${node.label}`}
          onSubmit={async (clean) => {
            // Persist via API (see section 2), then optimistic update
            const saved = await onUpdateNode?.(node.id, {
              label: clean.label,
              data: { ...node.data, ...clean },
            });

            // If parent didn’t persist, still do a local optimistic close
            setIsEditing(false);
          }}
        />
      )}
      </div>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="col-span-2">{value}</span>
    </div>
  );
}

function pct(n?: number) {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";
}

function num(n?: number) {
  return typeof n === "number" ? n : "—";
}

function KindFields({
  kind,
  data,
}: {
  kind: NodeKind;
  data: { performancePct?: number; weight?: number; achievementPct?: number };
}) {
  const showPerf = kind === "question" || kind === "assessment" || kind === "course";
  const showWeight = kind === "question" || kind === "assessment";
  const showAch = kind === "objective" || kind === "standard";

  const pct = (n?: number) => (typeof n === "number" ? `${n.toFixed(1)}%` : "—");
  const num = (n?: number) => (typeof n === "number" ? n : "—");

  return (
    <div className="space-y-2">
      {showPerf && <Field label="Performance" value={pct(data.performancePct)} />}
      {showWeight && <Field label="Weight" value={num(data.weight)} />}
      {showAch && <Field label="Achievement" value={pct(data.achievementPct)} />}
    </div>
  );
}

