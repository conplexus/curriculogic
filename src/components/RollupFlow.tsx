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
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import type { RollupNode, RollupEdge, Status } from "@/lib/types";
import InsightsDrawer from "./InsightsDrawer";
import StatusFilter from "./StatusFilter";
import FlowToolbar from "@/components/FlowToolbar";
import FocusBanner from "@/components/FocusBanner";
import NodeEditor, { type NodeEditorValues } from "@/components/NodeEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  listNodes, listEdges, createNode, updateNode, deleteNode,
  createEdge, deleteEdge,
  toRollupNodes, toRollupEdges,
  attachAdjacencyToNodes, buildAdjacency,
} from "@/lib/api";
import { recomputeUpstream } from "@/lib/status.runtime";
import { DEFAULT_STATUS_CONFIG } from "@/lib/statusConfig.default";
import type { NodeData } from "@/lib/types";


// ---- Layout constants
const NODE_W = 320;
const NODE_H = 132;
const RANKSEP = 120;
const NODESEP = 48;

// Gentle focus tuning
const FOCUS_PADDING = 4;
const FOCUS_DURATION = 160;

// Fade levels
const DIM_NODE_OPACITY = 0.22;
const BASE_EDGE_OPACITY = 0.95;
const DIM_EDGE_OPACITY = 0.12;

// For layout ranking by domain "kind"
const typeRank: Record<string, number> = {
  standard: 0,
  course: 1,
  objective: 2,
  assessment: 3,
  question: 4,
};

// ---- Palette (org-configurable, with defaults)
const DEFAULT_PALETTE: Record<Status, string> = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GRAY: "#9ca3af",
};
type StatusPalette = Record<Status, string>;

type Props = {
  mapId: number;             // ⬅️ REQUIRED
  selectedId?: string | null;
  onSelect?: (nodeId: string, data: RollupNode) => void;
  onClear?: () => void;
  onGraphChange?: (nodes: RollupNode[], edges: RollupEdge[]) => void;
};

// ---------- helpers
function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return String(h >>> 0);
}

function kindFromId(id: string): string {
  if (id.startsWith("stditem:")) return "standard";
  if (id.startsWith("course:")) return "course";
  if (id.startsWith("obj:")) return "objective";
  if (id.startsWith("asm:")) return "assessment";
  if (id.startsWith("q-") || id.startsWith("q:")) return "question";
  return "unknown";
}

// Convert UI kind labels -> DB enum
function uiKindToDbKind(k?: string): "STANDARD" | "COURSE" | "OBJECTIVE" | "ASSESSMENT" | "ITEM" {
  const v = (k ?? "standard").toLowerCase();
  switch (v) {
    case "standard": return "STANDARD";
    case "course": return "COURSE";
    case "objective": return "OBJECTIVE";
    case "assessment": return "ASSESSMENT";
    case "question": return "ITEM";   // UI calls it "question", DB calls it "ITEM"
    default: return "STANDARD";
  }
}


function layoutSync(nodes: RFNode[], edges: RFEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: NODESEP, ranksep: RANKSEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const rankKey = (n.data?.kind || n.data?.type || n.type) as string;
    g.setNode(n.id, {
      width: NODE_W,
      height: NODE_H,
      rank: typeRank[rankKey] ?? 99,
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
  mapId,                      // ⬅️ grab it here
  selectedId = null,
  onSelect,
  onClear,
  onGraphChange,
}: Props) {
  const [rawNodes, setRawNodes] = useState<RollupNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RollupEdge[]>([]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge[]>([]);
  const edgesRef = useRef<RollupEdge[]>([]);
    useEffect(() => { edgesRef.current = rawEdges; }, [rawEdges]);
  const [statusPalette, setStatusPalette] =
    useState<StatusPalette>(DEFAULT_PALETTE);

  const rf = useReactFlow();
  const { fitView, setViewport, zoomIn, zoomOut, getViewport } = rf;
  const { project } = useReactFlow(); // <-- add this

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("edit");
  const [editorParentId, setEditorParentId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{
    id: string;
    label: string;
    kind?: string;
  } | null>(null);

  // Delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

  const openEditor = useCallback(
    (id: string) => {
      const n = rawNodes.find((x) => x.id === id);
      if (!n) return;
      setEditorMode("edit");
      setEditorParentId(null);
      setEditingNode({
        id: n.id,
        label: n.label,
        kind: (n as any).type ?? "standard",
      });
      setEditorOpen(true);
    },
    [rawNodes]
  );

  const openCreate = useCallback((parentId: string | null) => {
    setEditorMode("create");
    setEditorParentId(parentId);
    setEditingNode(null);
    setEditorOpen(true);
  }, []);

  // Local drawer control (open immediately on right-click)
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(0);
  const isDrawerOpen = Boolean(drawerId);
  useEffect(() => {
    if (selectedId !== undefined) setDrawerId(selectedId ?? null);
  }, [selectedId]);
  const drawerNode = useMemo(
    () => (drawerId ? rawNodes.find((n) => n.id === drawerId) ?? null : null),
    [drawerId, rawNodes]
  );

  // Worker + cache
  const workerRef = useRef<Worker | null>(null);
  const layoutCache = useRef<
    Map<string, Record<string, { x: number; y: number }>>
  >(new Map());

  // Hover spotlight
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Branch focus (hide unrelated)
  const [focusedIds, setFocusedIds] = useState<Set<string> | null>(null);
  const prevViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(
    null
  );

  // Compute label shown in FocusBanner
  const focusedLabel = useMemo(() => {
    if (!focusedIds) return null;
    const activeId = (selectedId ?? hoveredId) || null;
    const active = activeId ? rawNodes.find((n) => n.id === activeId) : null;
    if (active && focusedIds.has(active.id)) return active.label;
    const any = rawNodes.find((n) => focusedIds.has(n.id));
    return any?.label ?? null;
  }, [focusedIds, selectedId, hoveredId, rawNodes]);

  // Layout edit mode (locked by default)
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (!editMode) {
      isDraggingRef.current = false;
    }
  }, [editMode]);

  // Drag tracking (so selection-change doesn’t open drawer)
  const isDraggingRef = useRef(false);

  // Avoid re-centering same selection repeatedly
  const lastCenteredIdRef = useRef<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1200);
  }, []);

  // Desktop-only: no touch support yet
  const [isTouchOnly, setIsTouchOnly] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = (q: string) =>
      !!window.matchMedia && window.matchMedia(q).matches;
    const hasFine = mq("(any-pointer: fine)");
    const canHover = mq("(any-hover: hover)");
    const hasCoarse =
      mq("(any-pointer: coarse)") ||
      "ontouchstart" in window ||
      (navigator as any)?.maxTouchPoints > 0;
    setIsTouchOnly(hasCoarse && !(hasFine || canHover));
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

  // init worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore - Next packs this with webpack/turbopack
    workerRef.current = new Worker(
      new URL("../workers/layoutWorker.ts", import.meta.url),
      { type: "module" }
    );
    return () => workerRef.current?.terminate();
  }, []);

  // restore saved layout per-graph
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

  // ---- runLayout (OFF main thread, cached) with fail-safe
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

      const cached = layoutCache.current.get(key);
      if (cached) {
        apply(cached);
        return;
      }

      if (!workerRef.current) {
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
        const w = workerRef.current;
        if (!w) {
          resolve({});
          return;
        }
        w.addEventListener("message", onMsg as any);
        try {
          w.postMessage({
            nodes: nodes.map((n) => ({
              id: n.id,
              width: NODE_W,
              height: NODE_H,
              rank:
                typeRank[
                  ((n.data as any)?.kind || (n.data as any)?.type || n.type) as string
                ] ?? 99,
            })),
            edges: edges.map((e) => ({ source: e.source, target: e.target })),
            options: { rankdir: "LR", nodesep: NODESEP, ranksep: RANKSEP },
          });
        } catch {
          resolve({});
        }
      });

      if (!positions || Object.keys(positions).length === 0) {
        const laidOut = layoutSync([...nodes], edges);
        setRfNodes(laidOut);
      } else {
        layoutCache.current.set(key, positions);
        apply(positions);
      }
    },
    [setRfNodes]
  );

  // ---- Save / Reset (top-level hooks)
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
    () => urlParams?.get("node") ?? null,
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
    if (id) qs.set("node", id);
    else qs.delete("node");
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
      qs.delete("node");
      window.history.replaceState(null, "", `?${qs.toString()}`);
      lastCenteredIdRef.current = null;
    }
  }, [onClear, setRfNodes]);

  // onGraphChange ref
  const onGraphChangeRef = useRef(onGraphChange);
  useEffect(() => {
    onGraphChangeRef.current = onGraphChange;
  }, [onGraphChange]);

  const toRF = useCallback(
    (nodes: RollupNode[], edges: RollupEdge[], palette: StatusPalette) => {
      const mappedNodes: RFNode[] = nodes.map((n) => {
        const kind = (n as any).kind ?? (n.type as string) ?? kindFromId(n.id);
        const kpis =
          (n as any).__kpis ??
          ((n as any).data && (n as any).data.kpis) ??
          {}; // <- fallback

        const prevPos = posRef.current[n.id];
        return {
          id: n.id,
          type: n.type === "group" ? "group" : "card",
          data: { label: n.label, status: n.status, kind, palette, kpis },
          position: prevPos ?? { x: 0, y: 0 },
          style: { width: NODE_W, height: NODE_H },
          draggable: n.type === "group" ? false : undefined,
          selectable: true,
        };
      });

      const mappedEdges: RFEdge[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: { strokeWidth: 2.5, opacity: BASE_EDGE_OPACITY, stroke: "var(--rf-edge)" },
        interactionWidth: 24,
      }));

      return { rfNodes: mappedNodes, rfEdges: mappedEdges };
    },
    []
  );

  // Fetch once + layout via worker
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const [nrows, erows] = await Promise.all([
          listNodes(mapId),
          listEdges(mapId),
        ]);

        // adapt DB rows -> your Rollup shape
        const nodes = toRollupNodes(nrows);
        const edges = toRollupEdges(erows);

        // If you want per-node arrays:
        const nodesWithAdj = attachAdjacencyToNodes(nodes, edges);

        // Or if you prefer maps for focus/search/etc:
        const { parentsOf, childrenOf, roots, leaves } = buildAdjacency(nodes, edges);
        const palette = DEFAULT_PALETTE;
        

        // 1) compute KPIs+status for the whole graph
        const rolled = recomputeAll(nodes, edges);

        // 2) stash + notify
        setStatusPalette(palette);
        setRawNodes(rolled);
        setRawEdges(edges);
        onGraphChangeRef.current?.(rolled, edges);

        // 3) map to RF and layout
        const { rfNodes: mappedNodes, rfEdges: mappedEdges } = toRF(rolled, edges, palette);
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
        console.error("DB rollup load failed", err);
      }
    })();
  }, [
    mapId, // ⬅️ include mapId
    toRF, setRfNodes, setRfEdges, fitView, setViewport,
    initialViewport, initialSelected, onSelect, runLayout
  ]);

  const recomputeAll = useCallback((nodes: RollupNode[], edges: RollupEdge[]) => {
    // Find leaves (no outgoing edges)
    const outdeg = new Map<string, number>();
    nodes.forEach(n => outdeg.set(n.id, 0));
    edges.forEach(e => outdeg.set(e.source, (outdeg.get(e.source) ?? 0) + 1));
    const leaves = nodes.filter(n => (outdeg.get(n.id) ?? 0) === 0).map(n => n.id);

    let cur = nodes;
    for (const leaf of leaves) {
      cur = recomputeUpstream(cur, edges, leaf, DEFAULT_STATUS_CONFIG);
    }
    return cur;
  }, []);

  const recomputeAndSync = useCallback((
    changedId: string,
    nextRawNodes: RollupNode[],
    curRawEdges: RollupEdge[]
  ) => {
    const updated = recomputeUpstream(nextRawNodes, curRawEdges, changedId, DEFAULT_STATUS_CONFIG);
    setRawNodes(updated);

    // ⬇️ this respects posRef to keep positions stable
    const { rfNodes: mappedNodes, rfEdges: mappedEdges } = toRF(updated, curRawEdges, statusPalette);
    setRfNodes(mappedNodes);
    setRfEdges(mappedEdges);
  }, [statusPalette, toRF, setRawNodes, setRfNodes, setRfEdges]);

  // near other refs
  const posRef = useRef<Record<string, { x: number; y: number }>>({});

  // keep it fresh whenever RF nodes move/change
  useEffect(() => {
    posRef.current = Object.fromEntries(rfNodes.map(n => [n.id, n.position]));
  }, [rfNodes]);


  // If palette changes later, push into nodes' data so CardNode updates
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, palette: statusPalette } }))
    );
  }, [statusPalette, setRfNodes]);

  // Unified visibility + dimming + related highlighting
  useEffect(() => {
    const active = selectedId ?? hoveredId;

    setRfNodes((nds) =>
      nds.map((n) => {
        const hiddenByFocus = focusedIds ? !focusedIds.has(n.id) : false;
        const dimByStatus = dimmedIds.has(n.id);
        const opacity = hiddenByFocus ? 0 : dimByStatus ? DIM_NODE_OPACITY : 1;

        return {
          ...n,
          hidden: hiddenByFocus,
          style: { ...(n.style || {}), opacity },
        };
      })
    );

    setRfEdges(eds =>
      eds.map(e => {
        const isRelated = !!active && (e.source === active || e.target === active);
        const stroke = isRelated ? "var(--ring)" : "var(--rf-edge)";
        return {
          ...e,
          animated: isRelated,
          style: { ...(e.style||{}), stroke, opacity: isRelated ? 1 : BASE_EDGE_OPACITY },
          markerEnd: { ...(e.markerEnd||{}), color: stroke }, // <-- keep arrow in sync
        };
      })
    );

  }, [selectedId, hoveredId, focusedIds, dimmedIds, setRfNodes, setRfEdges]);

  async function tryCreateEdge(source: string, target: string) {
    try {
      await createEdge({ mapId, sourceId: Number(source), targetId: Number(target) });
    } catch {}
  }

  async function tryDeleteEdge(id: string) {
    try { await deleteEdge(Number(id)); } catch {}
  }

  const handleConnect = useCallback(async (conn: Connection) => {
    const source = conn.source!;
    const target = conn.target!;
    if (!source || !target || source === target) return;

    const exists = rfEdges.some(e => e.source === source && e.target === target);
    if (exists) return;

    // Persist first to get real edge id
    let createdId: string = `${source}->${target}`;
    try {
      const created = await createEdge({
        mapId,
        sourceId: Number(source),
        targetId: Number(target),
      });
      createdId = String(created.id);
    } catch {}

    // Local models
    setRawEdges(prev => [...prev, { id: createdId, source, target }]);
    setRfEdges(prev => [...prev, {
      id: createdId, source, target,
      type: "bezier",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { strokeWidth: 2.5, opacity: BASE_EDGE_OPACITY, stroke: "var(--rf-edge)" },
      interactionWidth: 24,
    }]);

    await runLayout(rf.getNodes(), [...rf.getEdges(), { id: createdId, source, target } as RFEdge]);
  }, [rfEdges, mapId, setRawEdges, setRfEdges, runLayout, rf]);

  // Search spotlight hover
  useEffect(() => {
    if (q && hits.length) {
      setHoveredId(hits[Math.max(0, Math.min(hitIndex, hits.length - 1))].id);
    } else if (!q) {
      setHoveredId(null);
    }
  }, [q, hits, hitIndex]);

  // Keyboard shortcuts (+ n/p in search) + E to edit selected
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

      if (!q) {
        if (e.key.toLowerCase() === "f")
          fitView({ padding: 0.2, duration: 200 });
        if (e.key === "+" || e.key === "=") zoomIn?.();
        if (e.key === "-") zoomOut?.();
        if (e.key.toLowerCase() === "e") {
          const sel = rf.getNodes().find((n) => n.selected);
          if (sel) openEditor(sel.id);
        }
      } else {
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          jumpNext();
        }
        if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          jumpPrev();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          jumpToActive();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitView, zoomIn, zoomOut, q, jumpNext, jumpPrev, jumpToActive, rf, openEditor]);

  // Persist viewport locally (single key)
  const VIEWPORT_STORAGE_KEY = "rf_viewport";
  useEffect(() => {
    const saved =
      typeof window === "undefined"
        ? null
        : localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (saved) {
      try {
        setViewport?.(JSON.parse(saved));
      } catch {}
    }
  }, [setViewport]);
  useOnViewportChange({
    onChange: (vp) => {
      try {
        localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp));
      } catch {}
    },
  });

  // Debounced URL writer (x,y,z) on move end
  const moveTimer = useRef<number | null>(null);
  const handleMoveEnd = useCallback(() => {
    if (typeof window === "undefined") return;
    if (moveTimer.current) cancelAnimationFrame(moveTimer.current);
    moveTimer.current = requestAnimationFrame(() => {
      const vp = getViewport();
      const qs = new URLSearchParams(window.location.search);
      qs.set("x", String(Math.round(vp.x)));
      qs.set("y", String(Math.round(vp.y)));
      qs.set("z", vp.zoom.toFixed(2));
      window.history.replaceState(null, "", `?${qs.toString()}`);
    });
  }, [getViewport]);

  const handleSelectionChange = useCallback(
    (params: { nodes: RFNode[] }) => {
      if (typeof window === "undefined") return;
      if (editMode && isDraggingRef.current) return;

      const id = params.nodes[0]?.id ?? null;

      // Center when not editing; don't open drawer here
      if (!editMode && id && lastCenteredIdRef.current !== id) {
        fitView({
          nodes: [{ id }],
          padding: FOCUS_PADDING,
          duration: FOCUS_DURATION,
        });
        lastCenteredIdRef.current = id;
      }
      if (!id) {
        lastCenteredIdRef.current = null;
        onClear?.();
      }
    },
    [onClear, fitView, editMode]
  );

  const handleCreateChild = useCallback(
    async (parentId: string) => {
      openCreate(parentId);
    },
    [openCreate]
  );

const saveEditor = useCallback(
  async (values: NodeEditorValues) => {
    if (editorMode === "edit") {
      if (!editingNode) return;
      const id = editingNode.id;

      // PUT to DB (id is string → number)
      const n = await updateNode(Number(id), {
        kind: uiKindToDbKind(values.kind),
        title: values.label,
      });

      // Reflect in local state (DB uses title)
      setRawNodes(prev =>
        prev.map((node) =>
          node.id === id
            ? { ...node, label: n.title, type: values.kind ?? node.type }
            : node
        )
      );
      setRfNodes(prev =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: n.title,
                  kind: values.kind ?? node.data?.kind,
                },
              }
            : node
        )
      );

      const prevKind = editingNode.kind ?? "standard";
      const nextKind = values.kind ?? prevKind;
      if (prevKind !== nextKind) {
        await runLayout(rf.getNodes(), rf.getEdges());
      }
      return;
    }

    // CREATE mode
    // place where the user is looking (viewport center)
    const center = project({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const created = await createNode({
      mapId,
      kind: uiKindToDbKind(values.kind),
      title: values.label,
      x: center.x,
      y: center.y,
    });

    // raw model (your rollup shape)
    const newRaw: RollupNode = {
      id: String(created.id),
      label: created.title,
      status: "GRAY",
      type: values.kind ?? "standard",
    };
    setRawNodes(prev => [...prev, newRaw]);

    // RF node with actual position so it renders immediately
    const rfNew: RFNode = {
      id: String(created.id),
      type: "card",
      position: {
        x: (created as any).x ?? center.x,
        y: (created as any).y ?? center.y,
      },
      style: { width: NODE_W, height: NODE_H },  // <-- add this
      data: {
        label: created.title,
        status: "GRAY",
        kind: values.kind ?? "standard",
        palette: statusPalette,
      },
      selectable: true,
    };
    setRfNodes(prev => [...prev, rfNew]);


    // If creating as child, add edge
    const parentId = (values.parentId ?? editorParentId) ?? null;
    if (parentId) {
      try {
        const e = await createEdge({
          mapId,
          sourceId: Number(parentId),
          targetId: Number(created.id),
        });

        setRawEdges(prev => [
          ...prev,
          { id: String(e.id), source: parentId, target: String(created.id) },
        ]);

        setRfEdges(prev => [
          ...prev,
          {
            id: String(e.id),
            source: parentId,
            target: String(created.id),
            type: "bezier",
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
            style: {
              strokeWidth: 2.5,
              opacity: BASE_EDGE_OPACITY,
              stroke: "#94a3b8",
            },
            interactionWidth: 24,
          },
        ]);
      } catch {}
    }

    // Center on the new node after it exists in the RF store
    requestAnimationFrame(() => {
      writeSelToUrl(String(created.id));
      centerOnId(String(created.id));
    });

    // Optional: if you want to re-run Dagre after adding
    // await runLayout([...rf.getNodes(), rfNew], rf.getEdges());
  },
  [
    editorMode,
    editingNode,
    editorParentId,
    mapId,
    project,
    runLayout,
    rf,
    setRawNodes,
    setRawEdges,
    setRfNodes,
    setRfEdges,
    statusPalette,
    writeSelToUrl,
    centerOnId,
  ]
);


  // Delete a specific node (single) via drawer
  const handleDeleteNode = useCallback(async (id: string) => {
    setConfirmIds([id]);
    setConfirmOpen(true);
  }, []);

  // Focus helpers (with viewport save/restore)
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

  const confirmDelete = useCallback(async () => {
    if (!confirmIds?.length) return;
    for (const id of confirmIds) {
      try { await deleteNode(Number(id)); } catch {}
    }
    // prune local state (unchanged)
    setRawNodes(prev => prev.filter(n => !confirmIds.includes(n.id)));
    setRawEdges(prev => prev.filter(e => !confirmIds.includes(e.source) && !confirmIds.includes(e.target)));
    setRfNodes(prev => prev.filter(n => !confirmIds.includes(n.id)));
    setRfEdges(prev => prev.filter(e => !confirmIds.includes(e.source) && !confirmIds.includes(e.target)));
    setConfirmIds(null);
    setConfirmOpen(false);
    setDrawerId(null);
    await runLayout(rf.getNodes(), rf.getEdges());
  }, [confirmIds, runLayout, rf]);

  const cancelDelete = useCallback(() => {
    setConfirmIds(null);
    setConfirmOpen(false);
  }, []);

  const handleFocusBranch = useCallback(
    (id: string) => {
      if (!focusedIds) {
        try {
          prevViewportRef.current = getViewport();
        } catch {
          prevViewportRef.current = null;
        }
      }
      setFocusedIds(computeBranchIds(id));
      centerOnId(id);
    },
    [computeBranchIds, centerOnId, focusedIds, getViewport]
  );

  const handleExitFocus = useCallback(() => {
    setFocusedIds(null);
    const prev = prevViewportRef.current;
    if (prev && setViewport) setViewport(prev, { duration: 180 });
    prevViewportRef.current = null;
  }, [setViewport]);

  // Drawer handlers
  const handleCopyLink = useCallback(
    (id: string) => {
      if (typeof window === "undefined") return;
      const qs = new URLSearchParams(window.location.search);
      qs.set("node", id);
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

  // Toolbar hooks (create as child of selected if any)
  const handleCreateNode = useCallback(async () => {
    const selected = rf.getNodes().find((n) => n.selected);
    openCreate(selected?.id ?? null);
  }, [rf, openCreate]);

  const onUpdateNode = async (id: string, partial: Partial<RollupNode>) => {
    const dataPatch = partial.data as Partial<NodeData> | undefined;

    if (dataPatch) {
      // 1) persist to DB as meta
      await updateNode(Number(id), { meta: dataPatch });

      // 2) optimistic local merge + upstream recompute
      const nextRaw = rawNodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, ...dataPatch } } : n
      );
      recomputeAndSync(id, nextRaw, rawEdges);
      return;
    }

    // label/kind-only updates still persist
    if (partial.label || partial.type || (partial as any).kind) {
      await updateNode(Number(id), {
        title: partial.label,
        meta: dataPatch,
        // if you store db kind, convert here
        // kind: uiKindToDbKind((partial as any).kind ?? undefined),
      });
    }

    // reflect non-data changes in UI
    setRawNodes(prev =>
      prev.map(n => (n.id === id ? { ...n, ...partial } : n))
    );
    setRfNodes(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, data: { ...n.data, label: partial.label ?? n.data?.label } }
          : n
      )
    );
  };

  const handleDeleteSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected).map((n) => n.id);
    if (!selected.length) return;
    setConfirmIds(selected);
    setConfirmOpen(true);
  }, [rf]);

  const nodeTypes = useMemo(() => ({ card: CardNode, group: GroupNode }), []);

  // Mobile Return
  if (isTouchOnly) {
    return (
      <div className="relative h-[70vh] rounded-2xl border border-slate-800 bg-slate-900 grid place-items-center">
        <div className="text-center text-slate-200">
          <div className="text-sm font-medium">This view is Desktop-Only for now.</div>
          <div className="text-xs opacity-80 mt-1">
            Please use a desktop browser to access this feature. Right-click on nodes to open the data panels.
          </div>
        </div>
      </div>
    );
  }

  return (
      <div
        className="relative h-[calc(100vh-3.5rem)] rounded-2xl border"
        style={{
          borderColor: "var(--color-border)",
          background: `linear-gradient(
            to bottom,
            var(--rf-bg-start),
            var(--rf-bg-mid),
            var(--rf-bg-end)
          )`,
        }}
      >
      {/* Search + Status Filter row */}
      <div className="pointer-events-auto absolute left-3 top-3 z-40 flex items-center gap-2">
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
          className="h-8 w-56 rounded-md px-2 text-sm shadow-sm outline-none"
          style={{
            background: "color-mix(in oklab, var(--card), transparent 0%)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
          }}
          placeholder='Find node… ("/" or Ctrl+K)'
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
        {/* Desktop Hint */}
        <div className="hidden md:block text-[11px] text-slate-100/90 bg-black/30 px-2 py-1 rounded">
          Right-click a node to open its data panel.
        </div>
      </div>

      {/* Focus banner */}
      <div className="absolute left-3 top-12 z-40">
        <FocusBanner nodeLabel={focusedLabel} onExit={handleExitFocus} />
      </div>

      {/* Bottom-Left toolbar */}
      <div className="absolute bottom-3 left-3 z-40">
        <FlowToolbar
          editMode={editMode}
          onToggleEdit={() => setEditMode((m) => !m)}
          onSave={saveLayout}
          onResetLayout={resetLayout}
          onFitView={() => fitView({ padding: 0.2, duration: 250 })}
          onCreateNode={handleCreateNode}
          onDeleteSelected={handleDeleteSelected}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[40] -translate-x-1/2 rounded-md bg-black/80 px-3 py-1 text-xs text-white shadow">
          {toast}
        </div>
      )}

      {/* Modals */}
      <NodeEditor
        open={editorOpen}
        mode={editorMode}
        node={editingNode}
        parentId={editorParentId}
        parentTitle={editorParentId ? (rawNodes.find(n => n.id === editorParentId)?.label ?? null) : null} // <--
        onClose={() => setEditorOpen(false)}
        onSave={saveEditor}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete node(s)?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
      
      {drawerNode && (
        <InsightsDrawer
          node={drawerNode}
          nodes={rawNodes}
          edges={rawEdges}
          isFocused={!!focusedIds}
          onClose={() => {
            setDrawerId(null);
            setDrawerWidth(0);
            clearSelection();
          }}
          onFocusBranch={handleFocusBranch}
          onExitFocus={handleExitFocus}
          onCopyLink={handleCopyLink}
          onJumpTo={handleJumpTo}
          onEdit={openEditor}
          onCreateChild={handleCreateChild}
          onDeleteNode={handleDeleteNode}
          onUpdateNode={onUpdateNode}
          onWidthChange={setDrawerWidth}
        />
      )}

      <div
      className="absolute inset-0 duration-100"
      style={{ paddingRight: isDrawerOpen ? drawerWidth : 0 }}
    >
      
      {/* Flow */}
      <ReactFlow
        nodesConnectable
        onConnect={handleConnect}
        onEdgesDelete={(eds) => {
          eds.forEach((e) => { if (e?.id) tryDeleteEdge(e.id); });
        }}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        /* LEFT click: select only (no drawer) */
        onNodeClick={(e, node) => {
          e.stopPropagation();
          if (editMode) return;
          setRfNodes((nds) =>
            nds.map((n) => ({ ...n, selected: n.id === node.id }))
          );
        }}
        /* DOUBLE click: open editor */
        onNodeDoubleClick={(e, node) => {
          e.stopPropagation();
          openEditor(node.id);
        }}
        /* RIGHT click: open drawer (node menu) */
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          e.stopPropagation();
          if (editMode) return;

          // visually select
          setRfNodes((nds) =>
            nds.map((n) => ({ ...n, selected: n.id === node.id }))
          );

          // open drawer *locally* right away
          setDrawerId(node.id);

          // keep parent & URL in sync (non-blocking)
          const found = rawNodes.find((n) => n.id === node.id);
          if (found) onSelect?.(node.id, found);
          const qs = new URLSearchParams(window.location.search);
          qs.set("node", node.id);
          window.history.replaceState(null, "", `?${qs.toString()}`);
        }}
        onNodeDragStart={() => {
          if (!editMode) return;
          isDraggingRef.current = true;
        }}
        onNodeDragStop={() => {
          if (!editMode) return;
          isDraggingRef.current = true;
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 120);
        }}
        onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onPaneClick={() => {
          setDrawerId(null);
          setDrawerWidth(0);        // add this
          setHoveredId(null);
          onClear?.();
          const qs = new URLSearchParams(window.location.search);
          qs.delete("node");
          window.history.replaceState(null, "", `?${qs.toString()}`);
          lastCenteredIdRef.current = null;
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
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
        nodesFocusable
        defaultEdgeOptions={{
          type: "bezier",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--rf-edge)" },
          style: { strokeWidth: 2.25, opacity: BASE_EDGE_OPACITY, stroke: "var(--rf-edge)" },
        }}
        connectionLineType="bezier"
      >
        <Background variant="dots" gap={22} size={1} color="var(--rf-dots)" />
        <Controls className="z-40" position="bottom-right" showInteractive={false} />
      </ReactFlow>
      </div>
    </div>
  );
}

// CardNode — white card with colored border
function CardNode({ data, selected }: any) {
  const palette: StatusPalette = data?.palette ?? DEFAULT_PALETTE;
  const border = palette[data.status as Status] ?? palette.GRAY;

  const k = (data?.kpis ?? {}) as {
    proficiency?: number; alignment?: number; completion?: number;
  };
  const fmt = (v?: number) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

  // KPI label/value
  const [kpiLabel, kpiValue] =
    data.kind === "question" || data.kind === "assessment"
      ? ["Prof:", fmt(k.proficiency)]
      : data.kind === "objective"
      ? ["Align:", fmt(k.alignment)]
      : ["Complete:", fmt(k.completion)];

  return (
    <div
      className={[
        "w-full h-full box-border relative rounded-2xl border-2",
        "px-4 py-3 transition-all cursor-pointer",
        selected ? "ring-2 ring-blue-400 shadow-lg" : "hover:shadow-md",
      ].join(" ")}
      style={{
        borderColor: border,
        background: "#ffffff", // ← white background
        color: "#0f172a",      // ← dark text
        opacity: data?.opacity ?? 1,
      }}
      title={data.label}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[14px]"
        style={{
          boxShadow:
            "inset 0 0 0 1px color-mix(in oklab, var(--rf-card-border), transparent 65%)",
        }}
      />

      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold leading-5 truncate">
          {data.label}
        </div>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: border }} />
      </div>

      <div className="mt-1 text-[12px]">
        <span className="font-medium mr-1">{kpiLabel}</span>
        <span>{kpiValue}</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          left: -6,
          width: 10,
          height: 10,
          background: "#ffffff",               // card fill
          borderColor: "var(--rf-card-border)" // your subtle inner outline color
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          right: -6,
          width: 10,
          height: 10,
          background: "#ffffff",
          borderColor: "var(--rf-card-border)"
        }}
      />
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
