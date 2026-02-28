import { useState } from "react";
import Canvas3D from "./components/Canvas3D";
import DnaPicker from "./components/DnaPicker";

export default function App() {
  const [dnaData, setDnaData] = useState([]);

  return (
    <div className="flex h-screen w-screen bg-oasis-dark">
      {/* サイドパネル - DNA Picker */}
      <aside className="w-80 flex-shrink-0 border-r border-oasis-border bg-oasis-surface flex flex-col">
        <div className="p-4 border-b border-oasis-border">
          <h1 className="text-lg font-bold tracking-wide text-oasis-accent">
            OASIS
          </h1>
          <p className="text-xs text-gray-500 mt-1">Digital Terrarium for Web DNA</p>
        </div>
        <DnaPicker onExtracted={(data) => setDnaData((prev) => [...prev, ...data])} />
      </aside>

      {/* メインキャンバス - Three.js (中央配置) */}
      <main className="flex-1 relative">
        <Canvas3D dnaData={dnaData} />

        {/* バイオーム切替（将来拡張用） */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {["Standard", "Forest", "Marine"].map((biome) => (
            <button
              key={biome}
              className="px-3 py-1.5 text-xs rounded-full border border-oasis-border bg-oasis-surface/80 text-gray-400 hover:text-oasis-accent hover:border-oasis-accent transition-colors backdrop-blur"
            >
              {biome}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
