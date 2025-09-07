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
import dagre from "dagre";
import { getRollup } from "@/lib/api";
import type { RollupNode, RollupEdge, Status } from "@/lib/types";
import InsightsDrawer from "./InsightsDrawer";

// ---- Readability & spacing
const NODE_W = 320;
const NODE_H = 132;
const RANKSEP = 120;
const NODESEP = 48;

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

function CardNode({ data, selected }: any) {
  const border = statusStroke[data.status as Status] ?? "#9ca3af";
  return (
    <div
      className={[
        "relative rounded-2xl border-2 bg-white shadow-sm",
        "px-4 py-3 transition-all cursor-pointer",
        selected ? "ring-2 ring-blue-400 shadow-lg" : "hover:shadow-md",
      ].join(" ")}
      style={{ borderColor: border }}
      title={data.label}
    >
      {/* status accent bar */}
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

const NODE_TYPES = { card: CardNode, group: GroupNode } as const;

function layout(nodes: RFNode[], edges: RFEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: NODESEP, ranksep: RANKSEP });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => {
    const type = (n.data?.type || n.type) as string;
    g.setNode(n.id, {
      width: NODE_W,
      height: NODE_H,
      rank: typeRank[type] ?? 99,
    });
  });

  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    n.position = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
    n.style = { width: NODE_W, height: NODE_H };
    return n;
  });
}

// Simple, fast fuzzy scorer (subsequence with bonuses)
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase().trim();
  const s = text.toLowerCase();

  let qi = 0;
  let score = 0;
  let streak = 0;

  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      let bonus = 1;
      if (i === 0 || /\W|_|\s/.test(s[i - 1])) bonus += 3;
      if (streak > 0) bonus += 2;
      streak++;
      qi++;
      score += bonus;
    } else {
      streak = 0;
    }
  }

  if (qi < q.length) return 0;
  score += Math.max(0, 4 - (s.length - q.length));
  return score;
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

  // Hover spotlight
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Branch focus (IDs to keep visible; null = show all)
  const [focusedIds, setFocusedIds] = useState<Set<string> | null>(null);

  // Search
  const [q, setQ] = useState("");
  const [hitIndex, setHitIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // ----- URL params (SSR-safe)
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

  const hits = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    const scored = rfNodes
      .map((n) => ({
        node: n,
        score: fuzzyScore(s, String(n.data?.label || "")),
      }))
      .filter((h) => h.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const al = String(a.node.data?.label || "").length;
        const bl = String(b.node.data?.label || "").length;
        return al - bl;
      });
    return scored.map((h) => h.node);
  }, [q, rfNodes]);

  const centerOnId = useCallback(
    (id: string) => fitView({ nodes: [{ id }], padding: 0.25, duration: 250 }),
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
    if (!hits.length) return;
    setHitIndex((i) => (i + 1) % hits.length);
  }, [hits.length]);

  const jumpPrev = useCallback(() => {
    if (!hits.length) return;
    setHitIndex((i) => (i - 1 + hits.length) % hits.length);
  }, [hits.length]);

  // Keep latest onGraphChange
  const onGraphChangeRef = useRef(onGraphChange);
  useEffect(() => {
    onGraphChangeRef.current = onGraphChange;
  }, [onGraphChange]);

  // Map raw to RF
  const toRF = useCallback((nodes: RollupNode[], edges: RollupEdge[]) => {
    const mappedNodes: RFNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type === "group" ? "group" : "card",
      data: { label: n.label, status: n.status, type: n.type },
      position: { x: 0, y: 0 },
      draggable: n.type !== "group",
      selectable: true,
    }));

    const mappedEdges: RFEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { strokeWidth: 2.5, opacity: 0.9, stroke: "#94a3b8" },
      interactionWidth: 24,
    }));

    return { rfNodes: mappedNodes, rfEdges: mappedEdges };
  }, []);

  // Fetch once
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
        const laidOut = layout(mappedNodes, mappedEdges);
        setRfNodes(laidOut);
        setRfEdges(mappedEdges);

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
  ]);

  // Selection + hover spotlight & edge opacity
  useEffect(() => {
    const active = selectedId ?? hoveredId;
    setRfEdges((eds) =>
      eds.map((e) => {
        const isRelated =
          !!active && (e.source === active || e.target === active);
        return {
          ...e,
          animated: isRelated,
          style: {
            ...(e.style || {}),
            opacity: active ? (isRelated ? 1 : 0.18) : 0.9,
            stroke: isRelated ? "#93c5fd" : "#94a3b8",
          },
        };
      })
    );
    setRfNodes((nds) =>
      nds.map((n) => ({ ...n, selected: n.id === selectedId }))
    );
  }, [selectedId, hoveredId, setRfEdges, setRfNodes]);

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

  const handleSelectionChange = useCallback((params: { nodes: RFNode[] }) => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    if (params.nodes[0]) qs.set("sel", params.nodes[0].id);
    else qs.delete("sel");
    window.history.replaceState(null, "", `?${qs.toString()}`);
  }, []);

  // ----- Branch focus helpers
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
      const stack = [centerId];
      // Upward
      const pushParents = (id: string) => {
        for (const p of parentsMap.get(id) || [])
          if (!seen.has(p)) {
            seen.add(p);
            pushParents(p);
          }
      };
      // Downward
      const pushChildren = (id: string) => {
        for (const c of childrenMap.get(id) || [])
          if (!seen.has(c)) {
            seen.add(c);
            pushChildren(c);
          }
      };

      seen.add(centerId);
      pushParents(centerId);
      pushChildren(centerId);
      return seen;
    },
    [rawEdges]
  );

  const handleFocusBranch = useCallback(
    (id: string) => {
      const setIds = computeBranchIds(id);
      setFocusedIds(setIds);
    },
    [computeBranchIds]
  );

  const handleExitFocus = useCallback(() => setFocusedIds(null), []);

  // Apply hidden flags based on focus set
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

  // Drawer handlers
  const handleCopyLink = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    qs.set("sel", id);
    const url = `${window.location.pathname}?${qs.toString()}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }, []);

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
      {/* Search box */}
      <div className="pointer-events-auto absolute left-3 top-3 z-50 flex items-center gap-2">
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHitIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.shiftKey ? jumpPrev() : jumpToActive();
            }
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
        {q && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">
              {hits.length ? `${hitIndex + 1}/${hits.length}` : "0/0"}
            </span>
            <button
              onClick={jumpPrev}
              className="rounded border bg-white px-2 py-0.5 text-xs shadow hover:shadow-md"
              title="Prev (Shift+Enter / ↑)"
            >
              ↑
            </button>
            <button
              onClick={jumpNext}
              className="rounded border bg-white px-2 py-0.5 text-xs shadow hover:shadow-md"
              title="Next (Enter / ↓)"
            >
              ↓
            </button>
            <button
              onClick={() => {
                setQ("");
                setHitIndex(0);
                setHoveredId(null);
                searchRef.current?.blur();
              }}
              className="rounded border bg-white px-2 py-0.5 text-xs shadow hover:shadow-md"
              title="Clear (Esc)"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Reset View */}
      <button
        onClick={() => fitView({ padding: 0.2, duration: 250 })}
        className="absolute top-3 right-16 z-50 rounded-md border bg-white/90 px-2 py-1 text-xs shadow hover:shadow-md"
        title="Fit (F)"
      >
        Reset View
      </button>

      {/* Insights Drawer */}
      <InsightsDrawer
        node={selectedNode}
        nodes={rawNodes}
        edges={rawEdges}
        isFocused={!!focusedIds}
        onClose={() => {
          onClear?.();
        }}
        onFocusBranch={handleFocusBranch}
        onExitFocus={handleExitFocus}
        onCopyLink={handleCopyLink}
        onJumpTo={handleJumpTo}
      />

      <ReactFlow
        onMoveEnd={handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        nodeTypes={NODE_TYPES}
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => {
          const found = rawNodes.find((n) => n.id === node.id);
          if (found) {
            onSelect?.(node.id, found);
            const qs = new URLSearchParams(window.location.search);
            qs.set("sel", node.id);
            window.history.replaceState(null, "", `?${qs.toString()}`);
            fitView({ nodes: [{ id: node.id }], padding: 0.2, duration: 350 });
          }
        }}
        onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onPaneClick={() => {
          setHoveredId(null);
          onClear?.();
          const qs = new URLSearchParams(window.location.search);
          qs.delete("sel");
          window.history.replaceState(null, "", `?${qs.toString()}`);
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
        panOnDrag
        selectionOnDrag
        zoomOnDoubleClick={false}
        elevateEdgesOnSelect
        elevateNodesOnSelect
        onlyRenderVisibleElements
        proOptions={proOptions}
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background
          variant="dots"
          gap={22}
          size={1}
          color="rgba(255, 255, 255, 0.08)"
        />
        <Controls position="top-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
