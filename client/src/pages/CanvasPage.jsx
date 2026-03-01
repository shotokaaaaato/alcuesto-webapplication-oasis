import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Canvas3D from "../components/Canvas3D";
import DnaPicker from "../components/DnaPicker";
import PropertyPanel from "../components/PropertyPanel";

const BIOMES = [
  { id: "standard", label: "スタンダード", icon: "◇" },
  { id: "forest", label: "森", icon: "🌿" },
  { id: "marine", label: "海", icon: "🌊" },
];

/**
 * 3Dキャンバスページ — 旧App.jsxのメイン機能
 * ダッシュボードからアクセス
 */
export default function CanvasPage() {
  const navigate = useNavigate();
  const [dnaData, setDnaData] = useState([]);
  const [biome, setBiome] = useState("standard");
  const [selectedDna, setSelectedDna] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  const isForest = biome === "forest";

  function handleMenuClick(key) {
    setActivePanel((prev) => (prev === key ? null : key));
  }

  function handleBiomeChange(id) {
    setBiome(id);
    if (id !== "standard") setActivePanel(null);
  }

  const showLeftPanel = isForest || activePanel;

  return (
    <div
      className={`flex h-screen w-screen transition-colors duration-500 ${
        isForest ? "bg-[#001a08]" : "bg-[#F0C878]"
      }`}
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}
    >
      {/* 左パネル */}
      {showLeftPanel && (
        <aside
          className={`w-72 flex-shrink-0 border-r flex flex-col transition-all duration-500 ${
            isForest
              ? "border-[#1a3a10] bg-[#0a1a04]"
              : "border-[#D4A76A]/30 bg-[#FFF8E7]/95 backdrop-blur-md"
          }`}
          style={{ animation: "panelSlideIn 0.4s ease-out" }}
        >
          <div
            className={`p-4 border-b transition-colors duration-500 ${
              isForest ? "border-[#1a3a10]" : "border-[#D4A76A]/20"
            }`}
          >
            <h1
              className={`text-lg font-bold tracking-wide ${
                isForest ? "text-[#7ab83e]" : "text-[#8B6914]"
              }`}
            >
              OASIS
            </h1>
            <p
              className={`text-xs mt-1 ${
                isForest ? "text-[#4a7a30]" : "text-[#C49A6C]"
              }`}
            >
              {isForest
                ? "森のテラリウム"
                : activePanel === "extract"
                ? "デザイン抽出"
                : activePanel === "settings"
                ? "環境設定"
                : activePanel === "export"
                ? "コード出力"
                : "デザインのデジタルテラリウム"}
            </p>
          </div>

          {(isForest || activePanel === "extract") && (
            <DnaPicker
              biome={biome}
              onExtracted={(data) => setDnaData((prev) => [...prev, ...data])}
            />
          )}
          {activePanel === "settings" && (
            <SettingsPanel biome={biome} onBiomeChange={handleBiomeChange} />
          )}
          {activePanel === "export" && <ExportPanel />}
        </aside>
      )}

      {/* 中央キャンバス */}
      <main className="flex-1 relative">
        <Canvas3D
          dnaData={dnaData}
          biome={biome}
          selectedId={selectedDna?.id || null}
          onSelectDna={setSelectedDna}
          activePanel={activePanel}
          onMenuClick={handleMenuClick}
        />

        {/* ダッシュボードへ戻る */}
        <button
          onClick={() => navigate("/dashboard")}
          className={`absolute top-4 left-4 px-3 py-1.5 text-xs rounded-full border backdrop-blur transition-all ${
            isForest
              ? "border-[#2a4a1a] bg-[#0a1a04]/80 text-[#7ab83e] hover:bg-[#0a1a04]"
              : "border-[#D4A76A]/30 bg-[#FFF8E7]/80 text-[#8B6914] hover:bg-[#FFF8E7]"
          }`}
        >
          ← ダッシュボード
        </button>

        {/* バイオーム切替ボタン */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {BIOMES.map((b) => {
            const isActive = biome === b.id;
            const isDisabled = b.id === "marine";
            return (
              <button
                key={b.id}
                onClick={() => !isDisabled && handleBiomeChange(b.id)}
                disabled={isDisabled}
                className={`px-3 py-1.5 text-xs rounded-full border backdrop-blur transition-all duration-300 ${
                  isDisabled
                    ? isForest
                      ? "border-[#1a3a10]/50 bg-[#0a1a04]/50 text-[#2a4a1a] cursor-not-allowed"
                      : "border-[#D4A76A]/20 bg-[#FFF8E7]/30 text-[#C4B89A] cursor-not-allowed"
                    : isActive
                    ? isForest
                      ? "border-[#7ab83e] bg-[#7ab83e]/20 text-[#b8e07c] shadow-[0_0_12px_rgba(122,184,62,0.3)]"
                      : "border-[#D4A76A] bg-[#D4A76A]/20 text-[#8B6914] shadow-[0_0_12px_rgba(212,167,106,0.3)]"
                    : isForest
                    ? "border-[#2a4a1a] bg-[#0a1a04]/80 text-[#4a7a30] hover:text-[#7ab83e]"
                    : "border-[#D4A76A]/30 bg-[#FFF8E7]/60 text-[#C49A6C] hover:text-[#8B6914]"
                }`}
              >
                <span className="mr-1">{b.icon}</span>
                {b.label}
              </button>
            );
          })}
        </div>
      </main>

      {/* 右パネル — プロパティ */}
      {selectedDna && (
        <PropertyPanel
          dna={selectedDna}
          biome={biome}
          onClose={() => setSelectedDna(null)}
        />
      )}

      <style>{`
        @keyframes panelSlideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── 環境設定パネル ── */
function SettingsPanel({ biome, onBiomeChange }) {
  const biomes = [
    { id: "standard", label: "砂漠のオアシス", desc: "黄金色の砂丘と翡翠の泉", icon: "◇" },
    { id: "forest", label: "幻想の森", desc: "翡翠と胞子の和テラリウム", icon: "🌿" },
    { id: "marine", label: "深海（開発中）", desc: "近日公開", icon: "🌊" },
  ];

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-3">
      <h2 className="text-sm font-semibold text-[#8B6914] mb-2">バイオーム選択</h2>
      {biomes.map((b) => {
        const isActive = biome === b.id;
        const isDisabled = b.id === "marine";
        return (
          <button
            key={b.id}
            onClick={() => !isDisabled && onBiomeChange(b.id)}
            disabled={isDisabled}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              isDisabled
                ? "border-[#DDD0B8]/30 text-[#C4B89A] cursor-not-allowed opacity-50"
                : isActive
                ? "border-[#D4A76A] bg-[#D4A76A]/10 text-[#8B6914]"
                : "border-[#DDD0B8] bg-white/50 text-[#6B5E4F] hover:border-[#D4A76A]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{b.icon}</span>
              <div>
                <div className="text-sm font-medium">{b.label}</div>
                <div className="text-[12px] opacity-70">{b.desc}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── コード出力パネル ── */
function ExportPanel() {
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold text-[#8B6914] mb-2">コード出力</h2>
      <p className="text-xs text-[#8A7E6B] mb-4">
        デザインノードを選択して、CSSコードを出力できます。
      </p>
      <div className="p-3 rounded-lg border border-[#DDD0B8] bg-white/30 text-xs text-[#6B5E4F] space-y-1">
        <p>1. 3Dシーン上のノードをクリック</p>
        <p>2. 右パネルでプロパティを確認</p>
        <p>3.「CSSとしてコピー」ボタンで出力</p>
      </div>
    </div>
  );
}
