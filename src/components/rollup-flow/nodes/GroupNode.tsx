// src/components/rollup-flow/nodes/GroupNode.tsx
export default function GroupNode({ data }: any) {
  return (
    <div className="rounded-2xl border-2 bg-gray-50 px-4 py-3 shadow-inner">
      <div className="text-[13.5px] font-bold text-gray-800">{data.label}</div>
    </div>
  );
}
