// src/components/InsightsDrawer.tsx
"use client";
import { useMemo } from "react";
import type { RollupNode, RollupEdge, Status } from "@/lib/types";

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
};

export default function InsightsDrawer({
  node,
  nodes,
  edges,
  isFocused,
  onClose,
  onFocusBranch,
  onExitFocus,
  onCopyLink,
  onJumpTo,
}: DrawerProps) {
  const parents = useMemo(() => {
    if (!node) return [];
    const parentIds = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source);
    return nodes.filter((n) => parentIds.includes(n.id));
  }, [node, nodes, edges]);

  const children = useMemo(() => {
    if (!node) return [];
    const childIds = edges
      .filter((e) => e.source === node.id)
      .map((e) => e.target);
    return nodes.filter((n) => childIds.includes(n.id));
  }, [node, nodes, edges]);

  return (
    <aside
      className={[
        "pointer-events-auto fixed right-0 top-0 z-[60] h-full w-[360px] max-w-[92vw]",
        "bg-white/95 backdrop-blur border-l border-slate-200 shadow-2xl",
        "transition-transform duration-300",
        node ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
      role="complementary"
      aria-label="Insights"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Insights</h2>
        <button
          onClick={onClose}
          className="rounded-md border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          aria-label="Close insights"
        >
          Close
        </button>
      </div>

      {/* Body */}
      {node ? (
        <div className="space-y-5 overflow-y-auto px-4 py-4">
          {/* Title & status */}
          <div className="space-y-1">
            <div className="text-[13px] uppercase tracking-wide text-slate-500">
              {(node.type || "").toUpperCase()}
            </div>
            <div className="text-base font-semibold leading-5 text-slate-900">
              {node.label}
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    statusColors[node.status as Status] ?? "#9ca3af",
                }}
              />
              <span className="text-slate-700">{node.status}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {!isFocused ? (
              <button
                onClick={() => onFocusBranch(node.id)}
                className="rounded-md border bg-white px-2 py-1 text-xs shadow hover:shadow-md"
                title="Hide unrelated nodes"
              >
                Focus Branch
              </button>
            ) : (
              <button
                onClick={onExitFocus}
                className="rounded-md border bg-white px-2 py-1 text-xs shadow hover:shadow-md"
                title="Show whole graph"
              >
                Exit Focus
              </button>
            )}
            <button
              onClick={() => onCopyLink(node.id)}
              className="rounded-md border bg-white px-2 py-1 text-xs shadow hover:shadow-md"
              title="Copy link to this node"
            >
              Copy Link
            </button>
          </div>

          {/* Inputs (parents) */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Inputs
            </h3>
            {parents.length ? (
              <ul className="space-y-1">
                {parents.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onJumpTo(p.id)}
                      className="w-full truncate rounded-md border px-2 py-1 text-left text-xs hover:bg-slate-50"
                      title={p.label}
                    >
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-500">None</div>
            )}
          </section>

          {/* Outputs (children) */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Outputs
            </h3>
            {children.length ? (
              <ul className="space-y-1">
                {children.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onJumpTo(c.id)}
                      className="w-full truncate rounded-md border px-2 py-1 text-left text-xs hover:bg-slate-50"
                      title={c.label}
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-500">None</div>
            )}
          </section>
        </div>
      ) : (
        <div className="p-4 text-xs text-slate-500">
          Select a node to see details.
        </div>
      )}
    </aside>
  );
}
