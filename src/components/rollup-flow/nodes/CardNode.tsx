// src/components/rollup-flow/nodes/CardNode.tsx
import { Handle, Position } from "reactflow";
import type { Status } from "@/lib/types";
import { DEFAULT_PALETTE, type StatusPalette } from "@/lib/palette";

export default function CardNode({ data, selected }: any) {
  const palette: StatusPalette = data?.palette ?? DEFAULT_PALETTE;
  const border = palette[data.status as Status] ?? palette.GRAY;

  const k = (data?.kpis ?? {}) as {
    proficiency?: number; alignment?: number; completion?: number;
  };
  const fmt = (v?: number) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

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
        background: "#ffffff",
        color: "#0f172a",
        opacity: data?.opacity ?? 1,
      }}
      title={data.label}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[14px]"
        style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--rf-card-border), transparent 65%)" }}
      />

      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold leading-5 truncate">{data.label}</div>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: border }} />
      </div>

      <div className="mt-1 text-[12px]">
        <span className="font-medium mr-1">{kpiLabel}</span>
        <span>{kpiValue}</span>
      </div>

      <Handle type="target" position={Position.Left} id="in"
        style={{ left: -6, width: 10, height: 10, background: "#ffffff", borderColor: "var(--rf-card-border)" }}
      />
      <Handle type="source" position={Position.Right} id="out"
        style={{ right: -6, width: 10, height: 10, background: "#ffffff", borderColor: "var(--rf-card-border)" }}
      />
    </div>
  );
}
