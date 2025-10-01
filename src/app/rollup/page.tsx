// src/app/admin/rollup/page.tsx
"use client";

import { useState } from "react";
import RollupFlow from "@/components/rollup-flow/RollupFlow";

export default function RollupPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapId = 1; // TEMP: hardcoded for MVP demo
  
  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Curriculum Rollup</h1>
        <div className="text-sm opacity-70">MVP slice</div>
      </header>

      <div className="relative flex-1 min-h-[500px] border rounded-lg overflow-hidden">
        <RollupFlow
          mapId={mapId}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onClear={() => setSelectedId(null)}
        />
      </div>

      {selectedId && (
        <div className="p-2 text-sm rounded bg-gray-100 dark:bg-gray-800">
          <span className="font-medium">Selected node:</span> {selectedId}
        </div>
      )}
    </div>
  );
}
