// src/components/rollup-flow/RollupFlow.tsx
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactFlow, {
  Background, Controls, useNodesState, useEdgesState,
  type Node as RFNode, type Edge as RFEdge, useReactFlow,
  useOnViewportChange, ReactFlowProvider, MarkerType, Connection
} from "reactflow";
import "reactflow/dist/style.css";

import type { RollupNode, RollupEdge, Status, NodeData } from "@/lib/types";
import { recomputeUpstream } from "@/lib/status.runtime";
import { DEFAULT_STATUS_CONFIG } from "@/lib/statusConfig.default";

import InsightsDrawer from "@/components/rollup-flow/drawers/InsightsDrawer";
import StatusFilter from "@/components/rollup-flow/controls/StatusFilter";
import FlowToolbar from "@/components/rollup-flow/controls/FlowToolbar";
import FocusBanner from "@/components/common/FocusBanner";
import NodeEditor, { type NodeEditorValues } from "@/components/rollup-flow/modals/NodeEditor";
import ConfirmDialog from "@/components/rollup-flow/modals/ConfirmDialog";

import {
  listNodes, listEdges, createNode, updateNode, deleteNode,
  createEdge, deleteEdge, toRollupNodes, toRollupEdges,
  attachAdjacencyToNodes, buildAdjacency,
} from "@/lib/api";

import CardNode from "@/components/rollup-flow/nodes/CardNode";
import GroupNode from "@/components/rollup-flow/nodes/GroupNode";

import { DEFAULT_PALETTE, type StatusPalette } from "@/lib/palette";
import { layoutSync, NODE_W, NODE_H } from "@/lib/layout";
import { djb2, kindFromId, uiKindToDbKind, toDbId } from "@/lib/id";

// ---- Focus + zoom tuning
const FOCUS_PADDING = 4;
const FOCUS_DURATION = 160;

// ---- Edge opacity
const BASE_EDGE_OPACITY = 0.95;
const DIM_NODE_OPACITY = 0.22;

// ---------- Public wrapper
export default function RollupFlow(props: Props) {
  return (
    <ReactFlowProvider>
      <RollupFlowInner {...props} />
    </ReactFlowProvider>
  );
}

type Props = {
  mapId: number;
  selectedId?: string | null;
  onSelect?: (nodeId: string, data: RollupNode) => void;
  onClear?: () => void;
  onGraphChange?: (nodes: RollupNode[], edges: RollupEdge[]) => void;
};

// ---------- Inner component
function RollupFlowInner({
  mapId, selectedId = null, onSelect, onClear, onGraphChange,
}: Props) {
  // ---- raw / rf state
  const [rawNodes, setRawNodes] = useState<RollupNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RollupEdge[]>([]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge[]>([]);
  const [statusPalette, setStatusPalette] = useState<StatusPalette>(DEFAULT_PALETTE);
  const rf = useReactFlow();
  const { fitView, setViewport, getViewport, project } = rf;

  // ---- UI state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("edit");
  const [editorParentId, setEditorParentId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{ id: string; label: string; kind?: string; } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(0);
  const isDrawerOpen = Boolean(drawerId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedIds, setFocusedIds] = useState<Set<string> | null>(null);
  const [editMode, setEditMode] = useState(false);
  const isDraggingRef = useRef(false);
  const lastCenteredIdRef = useRef<string | null>(null);

  // ---- Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 1200);
  }, []);

  // ---- externally-selected node -> drawer
  useEffect(() => {
    if (selectedId !== undefined) setDrawerId(selectedId ?? null);
  }, [selectedId]);

  const drawerNode = useMemo(
    () => (drawerId ? rawNodes.find((n) => n.id === drawerId) ?? null : null),
    [drawerId, rawNodes]
  );

  // ---- local positions cache
  const posRef = useRef<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    posRef.current = Object.fromEntries(rfNodes.map(n => [n.id, n.position]));
  }, [rfNodes]);

  // ---- layout key for localStorage
  const layoutKey = useMemo(() => {
    if (!rawNodes.length) return null;
    return djb2(
      rawNodes.map((n) => n.id).sort().join("|") + "::" +
      rawEdges.map((e) => `${e.source}->${e.target}`).sort().join("|")
    );
  }, [rawNodes, rawEdges]);

  // ---- restore saved layout per-graph
  useEffect(() => {
    if (!layoutKey) return;
    const raw = localStorage.getItem(`layout:${layoutKey}`);
    if (!raw) return;
    try {
      const saved: Record<string, { x: number; y: number }> = JSON.parse(raw);
      setRfNodes((nds) => nds.map((n) => ({ ...n, position: saved[n.id] ?? n.position })));
    } catch {}
  }, [layoutKey, setRfNodes]);

  // ---- workerless layout (fast)
  const runLayout = useCallback(async (nodes: RFNode[], edges: RFEdge[]) => {
    const laidOut = layoutSync([...nodes], edges);
    setRfNodes(laidOut);
  }, [setRfNodes]);

  // ---------- define these BEFORE any hook that references them ----------

  // map Rollup -> RF
  const toRF = useCallback((nodes: RollupNode[], edges: RollupEdge[], palette: StatusPalette) => {
    const mappedNodes: RFNode[] = nodes.map((n) => {
      const kind = (n as any).kind ?? (n.type as string) ?? kindFromId(n.id);
      const kpis = (n as any).__kpis ?? ((n as any).data && (n as any).data.kpis) ?? {};
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
      id: e.id, source: e.source, target: e.target, type: "bezier",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { strokeWidth: 2.5, opacity: BASE_EDGE_OPACITY, stroke: "var(--rf-edge)" },
      interactionWidth: 24,
    }));

    return { rfNodes: mappedNodes, rfEdges: mappedEdges };
  }, []);

  // recompute helpers
  const recomputeAll = useCallback((nodes: RollupNode[], edges: RollupEdge[]) => {
    const outdeg = new Map<string, number>();
    nodes.forEach(n => outdeg.set(n.id, 0));
    edges.forEach(e => outdeg.set(e.source, (outdeg.get(e.source) ?? 0) + 1));
    const leaves = nodes.filter(n => (outdeg.get(n.id) ?? 0) === 0).map(n => n.id);
    let cur = nodes;
    for (const leaf of leaves) cur = recomputeUpstream(cur, edges, leaf, DEFAULT_STATUS_CONFIG);
    return cur;
  }, []);

  const recomputeAndSync = useCallback((changedId: string, nextRawNodes: RollupNode[], curRawEdges: RollupEdge[]) => {
    const updated = recomputeUpstream(nextRawNodes, curRawEdges, changedId, DEFAULT_STATUS_CONFIG);
    setRawNodes(updated);
    const { rfNodes: mappedNodes, rfEdges: mappedEdges } = toRF(updated, curRawEdges, statusPalette);
    setRfNodes(mappedNodes); setRfEdges(mappedEdges);
  }, [statusPalette, toRF]);

  // ----------------------------------------------------------------------

  // ---- Save/Reset layout
  const saveLayout = useCallback(() => {
    if (!layoutKey) return;
    const posMap = Object.fromEntries(rf.getNodes().map((n) => [n.id, n.position]));
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

  // ---- status filter
  const [statusFilter, setStatusFilter] = useState<Record<Status, boolean>>({
    GREEN: true, AMBER: true, RED: true, GRAY: true,
  });
  const dimmedIds = useMemo(() => {
    const s = new Set<string>();
    for (const n of rawNodes) {
      const st = n.status as Status | undefined;
      if (st && !statusFilter[st]) s.add(n.id);
    }
    return s;
  }, [rawNodes, statusFilter]);

  // ---- search
  const [q, setQ] = useState(""); const [hitIndex, setHitIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const fuzzyScore = (query: string, text: string) => {
    if (!query) return 0;
    const qq = query.toLowerCase().trim(); const s = text.toLowerCase();
    let qi = 0, score = 0, streak = 0;
    for (let i = 0; i < s.length && qi < qq.length; i++) {
      if (s[i] === qq[qi]) { let b = 1; if (i === 0 || /\W|_|\s/.test(s[i-1])) b += 3; if (streak > 0) b += 2; streak++; qi++; score += b; }
      else streak = 0;
    }
    if (qi < qq.length) return 0;
    return score + Math.max(0, 4 - (s.length - qq.length));
  };
  const hits = useMemo(() => {
    const s = q.trim(); if (!s) return [];
    const scored = rfNodes.map(n => ({ node: n, score: fuzzyScore(s, String(n.data?.label || "")) }))
      .filter(h => h.score > 0)
      .sort((a,b) => b.score - a.score || String(a.node.data?.label || "").length - String(b.node.data?.label || "").length);
    return scored.map(h => h.node);
  }, [q, rfNodes]);

  // ---- URL params (viewport + selection)
  const urlParams = useMemo(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search)), []);
  const initialViewport = useMemo(() => ({
    x: Number(urlParams?.get("x") ?? 0),
    y: Number(urlParams?.get("y") ?? 0),
    zoom: Number(urlParams?.get("z") ?? 1),
  }), [urlParams]);
  const initialSelected = useMemo(() => urlParams?.get("node") ?? null, [urlParams]);
  const writeSelToUrl = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    if (id) qs.set("node", id); else qs.delete("node");
    window.history.replaceState(null, "", `?${qs.toString()}`);
  }, []);

  // ---- jump helpers
  const centerOnId = useCallback((id: string) => fitView({ nodes: [{ id }], padding: FOCUS_PADDING, duration: FOCUS_DURATION }), [fitView]);
  const jumpToActive = useCallback(() => {
    if (!hits.length) return;
    const id = hits[Math.max(0, Math.min(hitIndex, hits.length - 1))].id;
    centerOnId(id); writeSelToUrl(id);
    const found = rawNodes.find((n) => n.id === id);
    if (found) onSelect?.(id, found);
  }, [hits, hitIndex, centerOnId, writeSelToUrl, onSelect, rawNodes]);
  const jumpNext = useCallback(() => { if (hits.length) setHitIndex((i) => (i + 1) % hits.length); }, [hits.length]);
  const jumpPrev = useCallback(() => { if (hits.length) setHitIndex((i) => (i - 1 + hits.length) % hits.length); }, [hits.length]);

  // ---- clear selection
  const clearSelection = useCallback(() => {
    setRfNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    onClear?.();
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      qs.delete("node"); window.history.replaceState(null, "", `?${qs.toString()}`);
      lastCenteredIdRef.current = null;
    }
  }, [onClear, setRfNodes]);

  // ---- Push palette into node data when changed
  useEffect(() => {
    setRfNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, palette: statusPalette } })));
  }, [statusPalette, setRfNodes]);

  // ---- Dim/filter + related highlight
  useEffect(() => {
    const active = selectedId ?? hoveredId;
    setRfNodes(nds => nds.map(n => {
      const hiddenByFocus = focusedIds ? !focusedIds.has(n.id) : false;
      const dimByStatus = dimmedIds.has(n.id);
      const opacity = hiddenByFocus ? 0 : dimByStatus ? DIM_NODE_OPACITY : 1;
      return { ...n, hidden: hiddenByFocus, style: { ...(n.style || {}), opacity } };
    }));
    setRfEdges(eds => eds.map(e => {
      const isRelated = !!active && (e.source === active || e.target === active);
      const stroke = isRelated ? "var(--ring)" : "var(--rf-edge)";
      return { ...e, animated: isRelated, style: { ...(e.style || {}), stroke, opacity: isRelated ? 1 : BASE_EDGE_OPACITY }, markerEnd: { ...(e.markerEnd || {}), color: stroke } };
    }));
  }, [selectedId, hoveredId, focusedIds, dimmedIds, setRfNodes, setRfEdges]);

  // ---- Fetch graph once (toRF now safely defined above)
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const [nrows, erows] = await Promise.all([listNodes(mapId), listEdges(mapId)]);
        const nodes = toRollupNodes(nrows);
        const edges = toRollupEdges(erows);

        // optional helpers
        attachAdjacencyToNodes(nodes, edges);
        buildAdjacency(nodes, edges);

        const rolled = recomputeAll(nodes, edges);
        setStatusPalette(DEFAULT_PALETTE);
        setRawNodes(rolled); setRawEdges(edges);
        onGraphChange?.(rolled, edges);

        const { rfNodes: mappedNodes, rfEdges: mappedEdges } = toRF(rolled, edges, DEFAULT_PALETTE);
        setRfNodes(mappedNodes); setRfEdges(mappedEdges);

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
  }, [mapId, toRF, setRfNodes, setRfEdges, fitView, setViewport, initialViewport, initialSelected, onSelect, runLayout, recomputeAll]);

  // ---- keyboard, viewport persistence, etc. (unchanged below)

  const VIEWPORT_STORAGE_KEY = "rf_viewport";
  useEffect(() => {
    const saved = typeof window === "undefined" ? null : localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (saved) { try { setViewport?.(JSON.parse(saved)); } catch {} }
  }, [setViewport]);
  useOnViewportChange({ onChange: (vp) => {
    try { localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp)); } catch {}
  }});

  const moveTimer = useRef<number | null>(null);
  const handleMoveEnd = useCallback(() => {
    if (typeof window === "undefined") return;
    if (moveTimer.current) cancelAnimationFrame(moveTimer.current);
    moveTimer.current = requestAnimationFrame(() => {
      const vp = getViewport();
      const qs = new URLSearchParams(window.location.search);
      qs.set("x", String(Math.round(vp.x))); qs.set("y", String(Math.round(vp.y)));
      qs.set("z", vp.zoom.toFixed(2));
      window.history.replaceState(null, "", `?${qs.toString()}`);
    });
  }, [getViewport]);

  const handleSelectionChange = useCallback((params: { nodes: RFNode[] }) => {
    if (typeof window === "undefined") return;
    if (editMode && isDraggingRef.current) return;
    const id = params.nodes[0]?.id ?? null;
    if (!editMode && id && lastCenteredIdRef.current !== id) {
      fitView({ nodes: [{ id }], padding: FOCUS_PADDING, duration: FOCUS_DURATION });
      lastCenteredIdRef.current = id;
    }
    if (!id) { lastCenteredIdRef.current = null; onClear?.(); }
  }, [onClear, fitView, editMode]);

  const openEditor = useCallback((id: string) => {
    const n = rawNodes.find((x) => x.id === id);
    if (!n) return;
    setEditorMode("edit"); setEditorParentId(null);
    setEditingNode({ id: n.id, label: n.label, kind: (n as any).type ?? "standard" });
    setEditorOpen(true);
  }, [rawNodes]);

  const openCreate = useCallback((parentId: string | null) => {
    setEditorMode("create"); setEditorParentId(parentId); setEditingNode(null); setEditorOpen(true);
  }, []);

  const handleConnect = useCallback(async (conn: Connection) => {
    const source = conn.source!; const target = conn.target!;
    if (!source || !target || source === target) return;
    const exists = rfEdges.some(e => e.source === source && e.target === target);
    if (exists) return;

    let createdId: string = `${source}->${target}`;
    try {
      const created = await createEdge({ mapId, sourceId: toDbId(source), targetId: toDbId(target) });
      createdId = String(created.id);
    } catch {}

    setRawEdges(prev => [...prev, { id: createdId, source, target }]);
    setRfEdges(prev => [...prev, {
      id: createdId, source, target, type: "bezier",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { strokeWidth: 2.5, opacity: BASE_EDGE_OPACITY, stroke: "var(--rf-edge)" },
      interactionWidth: 24,
    }]);

    await runLayout(rf.getNodes(), [...rf.getEdges(), { id: createdId, source, target } as RFEdge]);
  }, [rfEdges, mapId, setRawEdges, setRfEdges, runLayout, rf]);

  const tryDeleteEdge = async (id: string) => { try { await deleteEdge(toDbId(id)); } catch {} };

  const saveEditor = useCallback(async (values: NodeEditorValues) => {
    if (editorMode === "edit") {
      if (!editingNode) return;
      const id = editingNode.id;

      const n = await updateNode(toDbId(id), {
        kind: uiKindToDbKind(values.kind),
        title: values.label,
      });

      setRawNodes(prev => prev.map(node =>
        node.id === id ? { ...node, label: n.title, kind: values.kind ?? (node as any).kind ?? "standard" } : node
      ));
      setRfNodes(prev => prev.map(node =>
        node.id === id ? { ...node, data: { ...node.data, label: n.title, kind: values.kind ?? node.data?.kind } } : node
      ));

      const prevKind = editingNode.kind ?? "standard";
      const nextKind = values.kind ?? prevKind;
      if (prevKind !== nextKind) await runLayout(rf.getNodes(), rf.getEdges());
      return;
    }

    const center = project({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const created = await createNode({
      mapId,
      kind: uiKindToDbKind(values.kind),
      title: values.label,
      x: center.x, y: center.y,
    });

    const newRaw: RollupNode = {
      id: String(created.id), label: created.title, status: "GRAY",
      kind: values.kind ?? "standard",
    };
    setRawNodes(prev => [...prev, newRaw]);

    const rfNew: RFNode = {
      id: String(created.id), type: "card",
      position: { x: (created as any).x ?? center.x, y: (created as any).y ?? center.y },
      style: { width: NODE_W, height: NODE_H },
      data: { label: created.title, status: "GRAY", kind: values.kind ?? "standard", palette: statusPalette },
      selectable: true,
    };
    setRfNodes(prev => [...prev, rfNew]);

    const parentId = (values.parentId ?? editorParentId) ?? null;
    if (parentId) {
      try {
        const e = await createEdge({ mapId, sourceId: toDbId(parentId), targetId: toDbId(created.id) });
        setRawEdges(prev => [...prev, { id: String(e.id), source: parentId, target: String(created.id) }]);
        setRfEdges(prev => [...prev, {
          id: String(e.id), source: parentId, target: String(created.id), type: "bezier",
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
          style: { strokeWidth: 2.5, opacity: BASE_EDGE_OPACITY, stroke: "var(--rf-edge)" },
          interactionWidth: 24,
        }]);
        await runLayout([...rf.getNodes(), rfNew], [...rf.getEdges(), { id: String(e.id), source: parentId, target: String(created.id) } as RFEdge]);
      } catch {}
    }

    requestAnimationFrame(() => { writeSelToUrl(String(created.id)); centerOnId(String(created.id)); });
  }, [editorMode, editingNode, editorParentId, mapId, project, runLayout, rf, setRawNodes, setRawEdges, setRfNodes, setRfEdges, statusPalette, writeSelToUrl, centerOnId]);

  const handleDeleteNode = useCallback(async (id: string) => { setConfirmIds([id]); setConfirmOpen(true); }, []);
  const handleDeleteSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected).map((n) => n.id);
    if (!selected.length) return;
    setConfirmIds(selected); setConfirmOpen(true);
  }, [rf]);

  const confirmDelete = useCallback(async () => {
    if (!confirmIds?.length) return;
    const doomed = new Set(confirmIds);

    const touchingEdges = rf.getEdges().filter(e => doomed.has(e.source) || doomed.has(e.target));
    await Promise.allSettled(touchingEdges.map(e => deleteEdge(toDbId(e.id))));
    await Promise.allSettled([...doomed].map(id => deleteNode(toDbId(id))));

    setRawNodes(prev => prev.filter(n => !doomed.has(n.id)));
    setRawEdges(prev => prev.filter(e => !doomed.has(e.source) && !doomed.has(e.target)));
    setRfNodes(prev => prev.filter(n => !doomed.has(n.id)));
    setRfEdges(prev => prev.filter(e => !doomed.has(e.source) && !doomed.has(e.target)));

    setConfirmIds(null); setConfirmOpen(false); setDrawerId(null);
    await runLayout(rf.getNodes(), rf.getEdges());
  }, [confirmIds, rf, runLayout]);

  const cancelDelete = useCallback(() => { setConfirmIds(null); setConfirmOpen(false); }, []);

  const prevViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const computeBranchIds = useCallback((centerId: string) => {
    const parentsMap = new Map<string, string[]>(); const childrenMap = new Map<string, string[]>();
    for (const e of rawEdges) {
      if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
      if (!parentsMap.has(e.target)) parentsMap.set(e.target, []);
      childrenMap.get(e.source)!.push(e.target); parentsMap.get(e.target)!.push(e.source);
    }
    const seen = new Set<string>();
    const up = (id: string) => (parentsMap.get(id) || []).forEach((p) => { if (!seen.has(p)) { seen.add(p); up(p); } });
    const down = (id: string) => (childrenMap.get(id) || []).forEach((c) => { if (!seen.has(c)) { seen.add(c); down(c); } });
    seen.add(centerId); up(centerId); down(centerId); return seen;
  }, [rawEdges]);

  const handleFocusBranch = useCallback((id: string) => {
    if (!focusedIds) { try { prevViewportRef.current = getViewport(); } catch { prevViewportRef.current = null; } }
    setFocusedIds(computeBranchIds(id)); centerOnId(id);
  }, [computeBranchIds, centerOnId, focusedIds, getViewport]);

  const handleExitFocus = useCallback(() => {
    setFocusedIds(null);
    const prev = prevViewportRef.current;
    if (prev && setViewport) setViewport(prev, { duration: 180 });
    prevViewportRef.current = null;
  }, [setViewport]);

  const focusedLabel = useMemo(() => {
    if (!focusedIds) return null;
    const activeId = (selectedId ?? hoveredId) || null;
    const active = activeId ? rawNodes.find((n) => n.id === activeId) : null;
    if (active && focusedIds.has(active.id)) return active.label;
    const any = rawNodes.find((n) => focusedIds.has(n.id));
    return any?.label ?? null;
  }, [focusedIds, selectedId, hoveredId, rawNodes]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const isTouchOnly = false;

  if (isTouchOnly) {
    return (
      <div className="relative h-[70vh] rounded-2xl border border-slate-800 bg-slate-900 grid place-items-center">
        <div className="text-center text-slate-200">
          <div className="text-sm font-medium">This view is Desktop-Only for now.</div>
          <div className="text-xs opacity-80 mt-1">Use a desktop browser. Right-click nodes to open the data panel.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-[calc(100vh-3.5rem)] rounded-2xl border"
      style={{ borderColor: "var(--color-border)", background: `linear-gradient(to bottom, var(--rf-bg-start), var(--rf-bg-mid), var(--rf-bg-end))` }}
    >
      {/* Search + Status Filter */}
      <div className="pointer-events-auto absolute left-3 top-3 z-40 flex items-center gap-2">
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setHitIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.shiftKey ? jumpPrev() : jumpToActive();
            if (e.key === "Escape") { setQ(""); setHitIndex(0); setHoveredId(null); (e.target as HTMLInputElement).blur(); }
            if (e.key === "ArrowDown") { e.preventDefault(); jumpNext(); }
            if (e.key === "ArrowUp") { e.preventDefault(); jumpPrev(); }
          }}
          className="h-8 w-56 rounded-md px-2 text-sm shadow-sm outline-none"
          style={{ background: "color-mix(in oklab, var(--card), transparent 0%)", color: "var(--card-foreground)", border: "1px solid var(--border)" }}
          placeholder='Find node… ("/" or Ctrl+K)'
        />
        <StatusFilter
          active={statusFilter}
          onToggle={(s) => setStatusFilter((prev) => ({ ...prev, [s]: !prev[s] }))}
          onReset={() => setStatusFilter({ GREEN: true, AMBER: true, RED: true, GRAY: true })}
        />
        <div className="hidden md:block text-[11px] text-slate-100/90 bg-black/30 px-2 py-1 rounded">
          Right-click a node to open its data panel.
        </div>
      </div>

      {/* Focus banner */}
      <div className="absolute left-3 top-12 z-40">
        <FocusBanner nodeLabel={focusedLabel} onExit={handleExitFocus} />
      </div>

      {/* Bottom-left toolbar */}
      <div className="absolute bottom-3 left-3 z-40">
        <FlowToolbar
          editMode={editMode}
          onToggleEdit={() => setEditMode((m) => !m)}
          onSave={saveLayout}
          onResetLayout={resetLayout}
          onFitView={() => fitView({ padding: 0.2, duration: 250 })}
          onCreateNode={() => {
            const selected = rf.getNodes().find((n) => n.selected);
            openCreate(selected?.id ?? null);
          }}
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
        parentTitle={editorParentId ? (rawNodes.find(n => n.id === editorParentId)?.label ?? null) : null}
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

      {/* Drawer */}
      {drawerNode && (
        <InsightsDrawer
          node={drawerNode}
          nodes={rawNodes}
          edges={rawEdges}
          isFocused={!!focusedIds}
          onClose={() => { setDrawerId(null); setDrawerWidth(0); clearSelection(); }}
          onFocusBranch={handleFocusBranch}
          onExitFocus={handleExitFocus}
          onCopyLink={(id) => {
            const qs = new URLSearchParams(window.location.search);
            qs.set("node", id);
            const url = `${window.location.pathname}?${qs.toString()}`;
            navigator.clipboard?.writeText(url).then(() => showToast("Link copied"));
          }}
          onJumpTo={(id) => {
            const found = rawNodes.find((n) => n.id === id);
            if (found) { onSelect?.(id, found); writeSelToUrl(id); centerOnId(id); }
          }}
          onEdit={openEditor}
          onCreateChild={(parentId) => openCreate(parentId)}
          onDeleteNode={(id) => { setConfirmIds([id]); setConfirmOpen(true); }}
          onUpdateNode={async (id, partial) => {
            const dataPatch = partial.data as Partial<NodeData> | undefined;
            if (dataPatch) {
              await updateNode(toDbId(id), { meta: dataPatch });
              const nextRaw = rawNodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...dataPatch } } : n);
              recomputeAndSync(id, nextRaw, rawEdges);
              return;
            }
            if (partial.label || partial.type || (partial as any).kind) {
              await updateNode(toDbId(id), { title: partial.label });
            }
            setRawNodes(prev => prev.map(n => (n.id === id ? { ...n, ...partial } : n)));
            setRfNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, label: partial.label ?? n.data?.label } } : n));
          }}
          onWidthChange={setDrawerWidth}
        />
      )}

      {/* Flow */}
      <div className="absolute inset-0 duration-100" style={{ paddingRight: isDrawerOpen ? drawerWidth : 0 }}>
        <ReactFlow
          nodesConnectable
          onConnect={handleConnect}
          onEdgesDelete={(eds) => eds.forEach((e) => { if (e?.id) tryDeleteEdge(e.id as string); })}
          onMoveEnd={handleMoveEnd}
          onSelectionChange={handleSelectionChange}
          nodeTypes={{ card: CardNode as any, group: GroupNode as any }}
          nodes={rfNodes} edges={rfEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={(e, node) => {
            e.stopPropagation(); if (editMode) return;
            setRfNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
          }}
          onNodeDoubleClick={(e, node) => { e.stopPropagation(); openEditor(node.id); }}
          onNodeContextMenu={(e, node) => {
            e.preventDefault(); e.stopPropagation(); if (editMode) return;
            setRfNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
            setDrawerId(node.id);
            const found = rawNodes.find((n) => n.id === node.id);
            if (found) onSelect?.(node.id, found);
            const qs = new URLSearchParams(window.location.search); qs.set("node", node.id);
            window.history.replaceState(null, "", `?${qs.toString()}`);
          }}
          onNodeDragStart={() => { if (!editMode) return; isDraggingRef.current = true; }}
          onNodeDragStop={() => {
            if (!editMode) return; isDraggingRef.current = true;
            setTimeout(() => { isDraggingRef.current = false; }, 120);
          }}
          onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={() => {
            setDrawerId(null); setDrawerWidth(0); setHoveredId(null); onClear?.();
            const qs = new URLSearchParams(window.location.search); qs.delete("node");
            window.history.replaceState(null, "", `?${qs.toString()}`); lastCenteredIdRef.current = null;
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1} maxZoom={2.5}
          translateExtent={[[-50000, -50000], [50000, 50000]]}
          panOnScroll panOnScrollMode="free" zoomOnScroll={false} zoomOnPinch
          selectionOnDrag={editMode} zoomOnDoubleClick={false}
          elevateEdgesOnSelect elevateNodesOnSelect onlyRenderVisibleElements
          proOptions={proOptions} snapToGrid snapGrid={[16, 16]}
          nodesDraggable={editMode} selectNodesOnDrag={editMode} panOnDrag={!editMode}
          nodesFocusable
          defaultEdgeOptions={{
            type: "bezier",
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--rf-edge)" },
            style: { strokeWidth: 2.25, opacity: 0.95, stroke: "var(--rf-edge)" },
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
