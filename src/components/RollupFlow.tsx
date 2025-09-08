// src/components/RollupFlow.tsx
"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactFlow, {
  Handle,
  Position,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
  useReactFlow,
  useOnViewportChange,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre"; // fallback only
import { getRollup } from "@/lib/api";
import type { RollupNode, RollupEdge, Status } from "@/lib/types";
import InsightsDrawer from "./InsightsDrawer";
import StatusFilter from "./StatusFilter";

// ---- Layout constants
const NODE_W = 320;
const NODE_H = 132;
const RANKSEP = 120;
const NODESEP = 48;

// Gentle focus tuning
const FOCUS_PADDING = 1; // higher padding = gentler zoom
const FOCUS_DURATION = 160;

// Fade levels
const DIM_NODE_OPACITY = 0.22;
const BASE_EDGE_OPACITY = 0.9;
const DIM_EDGE_OPACITY = 0.12;

const typeRank: Record<string, number> = {
  standard: 0,
  course: 1,
  objective: 2,
  assessment: 3,
  question: 4,
};
const statusStroke: Record<Status, string> = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GRAY: "#9ca3af",
};

type Props = {
  selectedId?: string | null;
  onSelect?: (nodeId: string, data: RollupNode) => void;
  onClear?: () => void;
  onGraphChange?: (nodes: RollupNode[], edges: RollupEdge[]) => void;
};

// ---------- Workerized layout helpers
function layoutSync(nodes: RFNode[], edges: RFEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: NODESEP, ranksep: RANKSEP });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    const type = (n.data?.type || n.type) as string;
    g.setNode(n.id, {
      width: NODE_W,
      height: NODE_H,
      rank: typeRank[type] ?? 99,
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    n.position = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 };
    n.style = { ...(n.style || {}), width: NODE_W, height: NODE_H };
    return n;
  });
}
function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return String(h >>> 0);
}

// ---------- Public wrapper
export default function RollupFlow(props: Props) {
  return (
    <ReactFlowProvider>
      <RollupFlowInner {...props} />
    </ReactFlowProvider>
  );
}

// ---------- Inner component
function RollupFlowInner({
  selectedId = null,
  onSelect,
  onClear,
  onGraphChange,
}: Props) {
  const [rawNodes, setRawNodes] = useState<RollupNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RollupEdge[]>([]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge[]>([]);
  const rf = useReactFlow();
  const { fitView, setViewport, zoomIn, zoomOut, getViewport } = rf;

  // Worker + cache
  const workerRef = useRef<Worker | null>(null);
  const layoutCache = useRef<
    Map<string, Record<string, { x: number; y: number }>>
  >(new Map());

  // Layout edit mode (locked by default)
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (!editMode) {
      isDraggingRef.current = false;
    }
}, [editMode]);

  // Drag tracking (so selection-change doesn’t open drawer)
  const isDraggingRef = useRef(false);
  const justClickedNodeRef = useRef(false);

  // Avoid re-centering same selection repeatedly
  const lastCenteredIdRef = useRef<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1200);
  }, []);

  const layoutKey = useMemo(() => {
    if (!rawNodes.length) return null;
    return djb2(
      rawNodes
        .map((n) => n.id)
        .sort()
        .join("|") +
        "::" +
        rawEdges
          .map((e) => `${e.source}->${e.target}`)
          .sort()
          .join("|")
    );
  }, [rawNodes, rawEdges]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore - Next packs this with webpack/turbopack
    workerRef.current = new Worker(
      new URL("../workers/layoutWorker.ts", import.meta.url),
      { type: "module" }
    );
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!layoutKey) return;
    const raw = localStorage.getItem(`layout:${layoutKey}`);
    if (!raw) return;
    try {
      const saved: Record<string, { x: number; y: number }> = JSON.parse(raw);
      setRfNodes((nds) =>
        nds.map((n) => ({ ...n, position: saved[n.id] ?? n.position }))
      );
    } catch {}
  }, [layoutKey, setRfNodes]);

  // ---- runLayout (OFF main thread, cached)
  const runLayout = useCallback(
    async (nodes: RFNode[], edges: RFEdge[]) => {
      const key = djb2(
        nodes
          .map((n) => n.id)
          .sort()
          .join("|") +
          "::" +
          edges
            .map((e) => `${e.source}->${e.target}`)
            .sort()
            .join("|")
      );

      const apply = (positions: Record<string, { x: number; y: number }>) => {
        setRfNodes((prev) =>
          prev.map((n) => ({
            ...n,
            position: positions[n.id] ?? n.position,
            style: { ...(n.style || {}), width: NODE_W, height: NODE_H },
          }))
        );
      };

      // cache hit
      const cached = layoutCache.current.get(key);
      if (cached) {
        apply(cached);
        return;
      }

      if (!workerRef.current) {
        // fallback sync
        const laidOut = layoutSync([...nodes], edges);
        setRfNodes(laidOut);
        return;
      }

      const positions = await new Promise<
        Record<string, { x: number; y: number }>
      >((resolve) => {
        const onMsg = (
          e: MessageEvent<{
            positions: Record<string, { x: number; y: number }>;
          }>
        ) => {
          workerRef.current?.removeEventListener("message", onMsg as any);
          resolve(e.data.positions);
        };
        workerRef.current!.addEventListener("message", onMsg as any);
        workerRef.current!.postMessage({
          nodes: nodes.map((n) => ({
            id: n.id,
            width: NODE_W,
            height: NODE_H,
            rank: typeRank[(n.data?.type || n.type) as string] ?? 99,
          })),
          edges: edges.map((e) => ({ source: e.source, target: e.target })),
          options: { rankdir: "LR", nodesep: NODESEP, ranksep: RANKSEP },
        });
      });

      layoutCache.current.set(key, positions);
      apply(positions);
    },
    [setRfNodes]
  );

  // ---- Save / Reset (top-level hooks, depend on runLayout)
  const saveLayout = useCallback(() => {
    if (!layoutKey) return;
    const posMap = Object.fromEntries(
      rf.getNodes().map((n) => [n.id, n.position])
    );
    localStorage.setItem(`layout:${layoutKey}`, JSON.stringify(posMap));
    showToast("Layout saved");
  }, [layoutKey, rf, showToast]);

  const resetLayout = useCallback(() => {
    if (!layoutKey) return;
    localStorage.removeItem(`layout:${layoutKey}`);
    showToast("Layout reset");
    runLayout(rf.getNodes(), rf.getEdges());
    fitView({ padding: 0.2, duration: 250 });
  }, [layoutKey, runLayout, rf, fitView]);

  // Hover spotlight
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Branch focus (hide unrelated)
  const [focusedIds, setFocusedIds] = useState<Set<string> | null>(null);

  // Status filter (fade, not hide)
  const [statusFilter, setStatusFilter] = useState<Record<Status, boolean>>({
    GREEN: true,
    AMBER: true,
    RED: true,
    GRAY: true,
  });
  const dimmedIds = useMemo(() => {
    const s = new Set<string>();
    for (const n of rawNodes) {
      const st = n.status as Status | undefined;
      if (st && !statusFilter[st]) s.add(n.id);
    }
    return s;
  }, [rawNodes, statusFilter]);

  // Search
  const [q, setQ] = useState("");
  const [hitIndex, setHitIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // URL params
  const urlParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);
  const initialViewport = useMemo(() => {
    if (!urlParams) return { x: 0, y: 0, zoom: 1 };
    return {
      x: Number(urlParams.get("x") ?? 0),
      y: Number(urlParams.get("y") ?? 0),
      zoom: Number(urlParams.get("z") ?? 1),
    };
  }, [urlParams]);
  const initialSelected = useMemo(
    () => urlParams?.get("sel") ?? null,
    [urlParams]
  );

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  // Fuzzy
  function fuzzyScore(query: string, text: string): number {
    if (!query) return 0;
    const q = query.toLowerCase().trim();
    const s = text.toLowerCase();
    let qi = 0,
      score = 0,
      streak = 0;
    for (let i = 0; i < s.length && qi < q.length; i++) {
      if (s[i] === q[qi]) {
        let bonus = 1;
        if (i === 0 || /\W|_|\s/.test(s[i - 1])) bonus += 3;
        if (streak > 0) bonus += 2;
        streak++;
        qi++;
        score += bonus;
      } else streak = 0;
    }
    if (qi < q.length) return 0;
    score += Math.max(0, 4 - (s.length - q.length));
    return score;
  }
  const hits = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    const scored = rfNodes
      .map((n) => ({
        node: n,
        score: fuzzyScore(s, String(n.data?.label || "")),
      }))
      .filter((h) => h.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(a.node.data?.label || "").length -
            String(b.node.data?.label || "").length
      );
    return scored.map((h) => h.node);
  }, [q, rfNodes]);

  const centerOnId = useCallback(
    (id: string) =>
      fitView({
        nodes: [{ id }],
        padding: FOCUS_PADDING,
        duration: FOCUS_DURATION,
      }),
    [fitView]
  );

  const writeSelToUrl = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    if (id) qs.set("sel", id);
    else qs.delete("sel");
    window.history.replaceState(null, "", `?${qs.toString()}`);
  }, []);

  const jumpToActive = useCallback(() => {
    if (!hits.length) return;
    const id = hits[Math.max(0, Math.min(hitIndex, hits.length - 1))].id;
    centerOnId(id);
    writeSelToUrl(id);
    const found = rawNodes.find((n) => n.id === id);
    if (found) onSelect?.(id, found);
  }, [hits, hitIndex, centerOnId, writeSelToUrl, onSelect, rawNodes]);

  const jumpNext = useCallback(() => {
    if (hits.length) setHitIndex((i) => (i + 1) % hits.length);
  }, [hits.length]);
  const jumpPrev = useCallback(() => {
    if (hits.length) setHitIndex((i) => (i - 1 + hits.length) % hits.length);
  }, [hits.length]);

  const clearSelection = useCallback(() => {
    setRfNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    onClear?.();
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      qs.delete("sel");
      window.history.replaceState(null, "", `?${qs.toString()}`);
      lastCenteredIdRef.current = null;
    }
  }, [onClear, setRfNodes]);

  // onGraphChange ref
  const onGraphChangeRef = useRef(onGraphChange);
  useEffect(() => {
    onGraphChangeRef.current = onGraphChange;
  }, [onGraphChange]);

  // Map raw -> RF
  const toRF = useCallback((nodes: RollupNode[], edges: RollupEdge[]) => {
    const mappedNodes: RFNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type === "group" ? "group" : "card",
      data: { label: n.label, status: n.status, type: n.type },
      position: { x: 0, y: 0 },
      draggable: n.type === "group" ? false : undefined,
      selectable: true,
    }));
    const mappedEdges: RFEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: {
        strokeWidth: 2.5,
        opacity: BASE_EDGE_OPACITY,
        stroke: "#94a3b8",
      },
      interactionWidth: 24,
    }));
    return { rfNodes: mappedNodes, rfEdges: mappedEdges };
  }, []);

  // Fetch once + layout via worker
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const { nodes, edges } = await getRollup();
        setRawNodes(nodes);
        setRawEdges(edges);
        onGraphChangeRef.current?.(nodes, edges);

        const { rfNodes: mappedNodes, rfEdges: mappedEdges } = toRF(
          nodes,
          edges
        );
        setRfNodes(mappedNodes);
        setRfEdges(mappedEdges);

        await runLayout(mappedNodes, mappedEdges);

        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 0);
        setTimeout(() => {
          setViewport?.(initialViewport, { duration: 0 });
          if (initialSelected) {
            const found = nodes.find((n) => n.id === initialSelected);
            if (found) onSelect?.(initialSelected, found);
          }
        }, 0);
      } catch (err) {
        console.error("GET /rollup failed", err);
      }
    })();
  }, [
    toRF,
    setRfNodes,
    setRfEdges,
    fitView,
    setViewport,
    initialViewport,
    initialSelected,
    onSelect,
    runLayout,
  ]);

  // Apply branch focus (hide unrelated)
  useEffect(() => {
    if (!focusedIds) {
      setRfNodes((nds) => nds.map((n) => ({ ...n, hidden: false })));
      setRfEdges((eds) => eds.map((e) => ({ ...e, hidden: false })));
      return;
    }
    setRfNodes((nds) =>
      nds.map((n) => ({ ...n, hidden: !focusedIds.has(n.id) }))
    );
    setRfEdges((eds) =>
      eds.map((e) => ({
        ...e,
        hidden: !(focusedIds.has(e.source) && focusedIds.has(e.target)),
      }))
    );
  }, [focusedIds, setRfNodes, setRfEdges]);

  // Selection + fade styling (don’t touch RF's selected flag)
  useEffect(() => {
    const active = selectedId ?? hoveredId;

    setRfNodes((nds) =>
      nds.map((n) => {
        const isDim = dimmedIds.has(n.id);
        return {
          ...n,
          style: { ...(n.style || {}), opacity: isDim ? DIM_NODE_OPACITY : 1 },
        };
      })
    );

    setRfEdges((eds) =>
      eds.map((e) => {
        const endpointDim = dimmedIds.has(e.source) || dimmedIds.has(e.target);
        const base = endpointDim ? DIM_EDGE_OPACITY : BASE_EDGE_OPACITY;
        const isRelated =
          !!active && (e.source === active || e.target === active);
        return {
          ...e,
          animated: isRelated && !e.hidden,
          style: {
            ...(e.style || {}),
            opacity: e.hidden ? 0 : isRelated ? 1 : base,
            stroke: isRelated ? "#93c5fd" : "#94a3b8",
          },
        };
      })
    );
  }, [selectedId, hoveredId, dimmedIds, setRfNodes, setRfEdges]);

  // Search spotlight
  useEffect(() => {
    if (q && hits.length) {
      setHoveredId(hits[Math.max(0, Math.min(hitIndex, hits.length - 1))].id);
    } else if (!q) {
      setHoveredId(null);
    }
  }, [q, hits, hitIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e as any).isComposing)
        return;
      if (
        e.key === "/" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key.toLowerCase() === "f") fitView({ padding: 0.2, duration: 200 });
      if (e.key === "+" || e.key === "=") zoomIn?.();
      if (e.key === "-") zoomOut?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitView, zoomIn, zoomOut]);

  // Persist viewport locally
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("rollupViewport")
        : null;
    if (saved) {
      try {
        setViewport?.(JSON.parse(saved));
      } catch {}
    }
  }, [setViewport]);
  useOnViewportChange({
    onChange: (vp) => {
      try {
        localStorage.setItem("rollupViewport", JSON.stringify(vp));
      } catch {}
    },
  });

  // URL writers
  const handleMoveEnd = useCallback(() => {
    if (typeof window === "undefined") return;
    const vp = getViewport();
    const qs = new URLSearchParams(window.location.search);
    qs.set("x", String(Math.round(vp.x)));
    qs.set("y", String(Math.round(vp.y)));
    qs.set("z", vp.zoom.toFixed(2));
    window.history.replaceState(null, "", `?${qs.toString()}`);
  }, [getViewport]);

  const handleSelectionChange = useCallback(
    (params: { nodes: RFNode[] }) => {
      if (typeof window === "undefined") return;

      if (editMode && isDraggingRef.current) {
        return;
      }

      const id = params.nodes[0]?.id ?? null;

      // Keep URL in sync
      const qs = new URLSearchParams(window.location.search);
      if (id) qs.set("sel", id);
      else qs.delete("sel");
      window.history.replaceState(null, "", `?${qs.toString()}`);

      // Open/close the drawer
      if (id) {
        const found = rawNodes.find((n) => n.id === id);
        if (found) onSelect?.(id, found);
      } else {
        onClear?.();
      }

      // Center only when NOT editing
      if (!editMode && id && lastCenteredIdRef.current !== id) {
        fitView({
          nodes: [{ id }],
          padding: FOCUS_PADDING,
          duration: FOCUS_DURATION,
        });
        lastCenteredIdRef.current = id;
      }
      if (!id) lastCenteredIdRef.current = null;
    },
    [rawNodes, onSelect, onClear, fitView, editMode]
  );

  // Focus helpers
  const computeBranchIds = useCallback(
    (centerId: string) => {
      const parentsMap = new Map<string, string[]>();
      const childrenMap = new Map<string, string[]>();
      for (const e of rawEdges) {
        if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
        if (!parentsMap.has(e.target)) parentsMap.set(e.target, []);
        childrenMap.get(e.source)!.push(e.target);
        parentsMap.get(e.target)!.push(e.source);
      }
      const seen = new Set<string>();
      const up = (id: string) =>
        (parentsMap.get(id) || []).forEach((p) => {
          if (!seen.has(p)) {
            seen.add(p);
            up(p);
          }
        });
      const down = (id: string) =>
        (childrenMap.get(id) || []).forEach((c) => {
          if (!seen.has(c)) {
            seen.add(c);
            down(c);
          }
        });
      seen.add(centerId);
      up(centerId);
      down(centerId);
      return seen;
    },
    [rawEdges]
  );
  const handleFocusBranch = useCallback(
    (id: string) => setFocusedIds(computeBranchIds(id)),
    [computeBranchIds]
  );
  const handleExitFocus = useCallback(() => setFocusedIds(null), []);

  // Drawer handlers
  const handleCopyLink = useCallback(
    (id: string) => {
      if (typeof window === "undefined") return;
      const qs = new URLSearchParams(window.location.search);
      qs.set("sel", id);
      const url = `${window.location.pathname}?${qs.toString()}`;
      navigator.clipboard?.writeText(url).then(() => showToast("Link copied"));
    },
    [showToast]
  );
  const handleJumpTo = useCallback(
    (id: string) => {
      const found = rawNodes.find((n) => n.id === id);
      if (found) {
        onSelect?.(id, found);
        writeSelToUrl(id);
        centerOnId(id);
      }
    },
    [rawNodes, onSelect, writeSelToUrl, centerOnId]
  );

  const selectedNode = useMemo(
    () =>
      selectedId ? rawNodes.find((n) => n.id === selectedId) ?? null : null,
    [selectedId, rawNodes]
  );

  return (
    <div className="relative h-[70vh] rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
      {/* Search + Status Filter row */}
      <div className="pointer-events-auto absolute left-3 top-3 z-50 flex items-center gap-2">
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHitIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.shiftKey ? jumpPrev() : jumpToActive();
            if (e.key === "Escape") {
              setQ("");
              setHitIndex(0);
              setHoveredId(null);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              jumpNext();
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              jumpPrev();
            }
          }}
          placeholder='Find node… ("/" or Ctrl+K)'
          className="h-8 w-56 rounded-md border border-gray-300 bg-white/95 px-2 text-sm shadow-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400"
        />
        <StatusFilter
          active={statusFilter}
          onToggle={(s) =>
            setStatusFilter((prev) => ({ ...prev, [s]: !prev[s] }))
          }
          onReset={() =>
            setStatusFilter({ GREEN: true, AMBER: true, RED: true, GRAY: true })
          }
        />
      </div>

      {/* Reset View */}
      <button
        onClick={() => fitView({ padding: 0.2, duration: 250 })}
        className="absolute top-3 right-16 z-50 rounded-md border bg-white/90 px-2 py-1 text-xs shadow hover:shadow-md"
        title="Fit (F)"
      >
        Reset View
      </button>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[70] -translate-x-1/2 rounded-md bg-black/80 px-3 py-1 text-xs text-white shadow">
          {toast}
        </div>
      )}

      {/* Layout controls */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
        <button
          onClick={() => setEditMode((m) => !m)}
          className={[
            "rounded-md border px-2 py-1 text-xs shadow hover:shadow-md",
            editMode ? "bg-yellow-100 border-yellow-300" : "bg-white/90",
          ].join(" ")}
          title="Toggle Edit Layout"
        >
          {editMode ? "Done editing" : "Edit layout"}
        </button>

        {editMode && (
          <>
            <button
              onClick={saveLayout}
              className="rounded-md border bg-white/90 px-2 py-1 text-xs shadow hover:shadow-md"
              title="Save this layout"
            >
              Save
            </button>
            <button
              onClick={resetLayout}
              className="rounded-md border bg-white/90 px-2 py-1 text-xs shadow hover:shadow-md"
              title="Reset to auto layout"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {/* Insights Drawer */}
      <InsightsDrawer
        node={selectedNode}
        nodes={rawNodes}
        edges={rawEdges}
        isFocused={!!focusedIds}
        onClose={clearSelection}
        onFocusBranch={handleFocusBranch}
        onExitFocus={handleExitFocus}
        onCopyLink={handleCopyLink}
        onJumpTo={handleJumpTo}
      />

      <ReactFlow
        onMoveEnd={handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        nodeTypes={{ card: CardNode, group: GroupNode }}
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        /* LEFT click: select only (no drawer) */
        onNodeClick={(e, node) => {
          e.stopPropagation();
          if (editMode) return; // arranging layout
          setRfNodes((nds) =>
            nds.map((n) => ({ ...n, selected: n.id === node.id }))
          );
          // Do NOT call onSelect or update ?sel= here, so drawer doesn't open on left click
        }}
        /* RIGHT click: open drawer (node menu) */
        onNodeContextMenu={(e, node) => {
          e.preventDefault();   // prevent browser context menu
          e.stopPropagation();
          if (editMode) return; // don't open while editing layout

          // Visually select the node
          setRfNodes((nds) =>
            nds.map((n) => ({ ...n, selected: n.id === node.id }))
          );

          // Open the drawer
          const found = rawNodes.find((n) => n.id === node.id);
          if (found) onSelect?.(node.id, found);

          // Sync URL param so deep-links work
          const qs = new URLSearchParams(window.location.search);
          qs.set("sel", node.id);
          window.history.replaceState(null, "", `?${qs.toString()}`);
        }}
        onNodeDragStart={() => {
          if (!editMode) return;
          isDraggingRef.current = true;
        }}
        onNodeDragStop={() => {
          if (!editMode) return;
          isDraggingRef.current = true;
          setTimeout(() => { isDraggingRef.current = false; }, 120);
        }}
        onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onPaneClick={() => {
          if (justClickedNodeRef.current) {
            justClickedNodeRef.current = false;
            return;
          }
          setHoveredId(null);
          onClear?.();
          const qs = new URLSearchParams(window.location.search);
          qs.delete("sel");
          window.history.replaceState(null, "", `?${qs.toString()}`);
          lastCenteredIdRef.current = null;
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        translateExtent={[
          [-50000, -50000],
          [50000, 50000],
        ]}
        panOnScroll
        panOnScrollMode="free"
        zoomOnScroll={false}
        zoomOnPinch
        selectionOnDrag={editMode}
        zoomOnDoubleClick={false}
        elevateEdgesOnSelect
        elevateNodesOnSelect
        onlyRenderVisibleElements
        proOptions={proOptions}
        snapToGrid
        snapGrid={[16, 16]}
        nodesDraggable={editMode}
        selectNodesOnDrag={editMode}
        panOnDrag={!editMode}
        elementsSelectable={true}
        nodesConnectable={false}
        nodesFocusable={true}
      >
        <Background
          variant="dots"
          gap={22}
          size={1}
          color="rgba(255, 255, 255, 0.08)"
        />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

// ---- Node components (use data/status + fade)
function CardNode({ data, selected }: any) {
  const border = statusStroke[data.status as Status] ?? "#9ca3af";
  return (
    <div
      className={[
        "relative rounded-2xl border-2 bg-white shadow-sm",
        "px-4 py-3 transition-all cursor-pointer",
        selected ? "ring-2 ring-blue-400 shadow-lg" : "hover:shadow-md",
      ].join(" ")}
      style={{ borderColor: border, opacity: data?.opacity ?? 1 }} // actual opacity set via node.style
      title={data.label}
    >
      <div
        className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl"
        style={{ backgroundColor: border }}
      />
      <div className="text-[14px] font-semibold leading-5 text-gray-900">
        {data.label}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="mt-0.5 text-[12px] text-gray-600">{data.status}</div>
    </div>
  );
}
function GroupNode({ data }: any) {
  return (
    <div className="rounded-2xl border-2 bg-gray-50 px-4 py-3 shadow-inner">
      <div className="text-[13.5px] font-bold text-gray-800">{data.label}</div>
    </div>
  );
}
