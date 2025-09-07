// src/app/rollup/page.tsx
"use client";
import { useState } from "react";
import RollupFlow from "@/components/RollupFlow";

export default function RollupPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Curriculum Rollup</h1>
        <div className="text-sm opacity-70">MVP slice</div>
      </header>

      <RollupFlow
        selectedId={selectedId}
        onSelect={(id /*, node */) => setSelectedId(id)} // node is available if you need it later
        onClear={() => setSelectedId(null)}
      />
    </div>
  );
}
