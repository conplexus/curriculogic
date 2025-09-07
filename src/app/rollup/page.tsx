"use client";
import { useState, useMemo } from "react";
import RollupFlow from "@/components/RollupFlow";
import type { RollupNode, RollupEdge } from "@/lib/types";

export default function RollupPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<RollupNode[]>([]);
  const [edges, setEdges] = useState<RollupEdge[]>([]);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) || null,
    [nodes, selectedId]
  );

  const incoming = useMemo(() => {
    if (!selectedId) return [];
    return edges
      .filter((e) => e.target === selectedId)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter(Boolean) as RollupNode[];
  }, [edges, nodes, selectedId]);

  const outgoing = useMemo(() => {
    if (!selectedId) return [];
    return edges
      .filter((e) => e.source === selectedId)
      .map((e) => nodes.find((n) => n.id === e.target))
      .filter(Boolean) as RollupNode[];
  }, [edges, nodes, selectedId]);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Curriculum Rollup</h1>
        <div className="text-sm opacity-70">MVP slice</div>
      </header>

      <RollupFlow
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        onClear={() => setSelectedId(null)}
        onGraphChange={(ns, es) => {
          setNodes(ns);
          setEdges(es);
        }}
      />

      <section className="rounded-xl border p-4">
        <h2 className="font-medium mb-2">Selection Details</h2>
        {!selected ? (
          <p className="text-sm opacity-80">(Click a node to see details.)</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Name:</span> {selected.label}
            </div>
            <div>
              <span className="font-medium">Type:</span> {selected.type}
            </div>
            <div>
              <span className="font-medium">Status:</span> {selected.status}
            </div>

            {!!incoming.length && (
              <div>
                <div className="font-medium mt-2">Inputs:</div>
                <ul className="list-disc ml-5">
                  {incoming.map((n) => (
                    <li key={n.id}>{n.label}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!outgoing.length && (
              <div>
                <div className="font-medium mt-2">Outputs:</div>
                <ul className="list-disc ml-5">
                  {outgoing.map((n) => (
                    <li key={n.id}>{n.label}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
