import { useState } from "react";
import { motion } from "framer-motion";
import { getRoleColor, getRoleLabel } from "../../constants/roles";
import DesignPreviewModal from "./DesignPreviewModal";

const MODE_OPTIONS = [
  { value: "clone", label: "完全再現", desc: "構造・コードを 100% 流用（AI 介在なし）", color: "#3b82f6" },
  { value: "reference", label: "デザイン参考", desc: "配置・アニメ・装飾を継承し AI が再構築", color: "#7c3aed" },
  { value: "none", label: "参照なし", desc: "AI がラベルのみから新規生成", color: "#8A7E6B" },
];

export default function SectionDesignMapper({ sections: initialSections, dnaLibrary, libraryLoading, onComplete, onBack }) {
  const [sections, setSections] = useState(initialSections.map((s) => ({ ...s })));
  const [activeSection, setActiveSection] = useState(sections[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewModal, setPreviewModal] = useState(null); // { dnaId, sectionId }

  const activeIdx = sections.findIndex((s) => s.id === activeSection);
  const active = sections[activeIdx] || null;

  // デザイン選択
  const handleAssignDesign = (dnaId, elementIndices = []) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === activeSection
          ? { ...s, designRef: { dnaId, deviceFrame: null, elementIndices }, mode: s.mode === "none" ? "reference" : s.mode }
          : s
      )
    );
  };

  // デザイン解除
  const handleUnassign = () => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === activeSection ? { ...s, designRef: null, mode: "none" } : s
      )
    );
  };

  // モード変更
  const handleModeChange = (mode) => {
    setSections((prev) =>
      prev.map((s) => (s.id === activeSection ? { ...s, mode } : s))
    );
  };

  // デバイスフレーム変更
  const handleDeviceChange = (device) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === activeSection && s.designRef
          ? { ...s, designRef: { ...s.designRef, deviceFrame: device } }
          : s
      )
    );
  };

  // ライブラリフィルタ
  const filteredLibrary = dnaLibrary.filter((d) => {
    if (!searchQuery) return true;
    return (d.name || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getAssignedDna = (section) => {
    if (!section.designRef?.dnaId) return null;
    return dnaLibrary.find((d) => d.id === section.designRef.dnaId) || null;
  };

  const canProceed = sections.length > 0;

  return (
    <div className="flex gap-6" style={{ minHeight: "60vh" }}>
      {/* ── 左パネル: セクション一覧 ── */}
      <div className="w-80 flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm"
        >
          <h3 className="text-[14px] font-bold text-[#5A4E3A] mb-4">セクション構成</h3>
          <div className="space-y-2">
            {sections.map((section, i) => {
              const assigned = getAssignedDna(section);
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isActive
                      ? "border-[#D4A76A] bg-[#D4A76A]/10"
                      : "border-transparent bg-white/40 hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: getRoleColor(section.role) }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[13px] font-semibold text-[#5A4E3A] truncate flex-1">
                      {section.label}
                    </span>
                  </div>
                  {assigned ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      {assigned.masterImage?.filename && (
                        <img
                          src={`/api/images/${assigned.masterImage.filename}`}
                          alt=""
                          className="w-10 h-7 object-cover object-top rounded border border-[#E8D5B0]/50 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                              backgroundColor: `${MODE_OPTIONS.find((m) => m.value === section.mode)?.color || "#8A7E6B"}20`,
                              color: MODE_OPTIONS.find((m) => m.value === section.mode)?.color || "#8A7E6B",
                            }}
                          >
                            {MODE_OPTIONS.find((m) => m.value === section.mode)?.label}
                          </span>
                          <span className="text-[11px] text-[#8A7E6B] truncate">
                            {assigned.name || "Unnamed"}
                          </span>
                        </div>
                        {section.designRef?.elementIndices?.length > 0 && (
                          <p className="text-[10px] text-[#C49A6C] mt-0.5">
                            {section.designRef.elementIndices.length} 要素を選択中
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#C49A6C] mt-1">未割り当て</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── ナビゲーション ── */}
          <div className="flex justify-between mt-6">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl border border-[#D4A76A]/30 bg-white/50 text-[#8A7E6B] text-[12px] font-semibold hover:bg-white/80 transition-all"
            >
              ← 戻る
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!canProceed}
              onClick={() => onComplete(sections)}
              className={`px-5 py-2 rounded-xl text-[12px] font-bold transition-all ${
                canProceed
                  ? "bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white shadow-md"
                  : "bg-[#E8D5B0]/50 text-[#8A7E6B] cursor-not-allowed"
              }`}
            >
              次へ →
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* ── 右パネル: デザインライブラリ + モード設定 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 p-5 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm"
      >
        {active ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-bold text-[#5A4E3A]">
                  「{active.label}」のデザイン参照
                </h3>
                <p className="text-[12px] text-[#8A7E6B] mt-0.5">
                  ライブラリからデザインを選択して紐付けます
                </p>
              </div>
            </div>

            {/* ── 割り当て済みの場合 ── */}
            {active.designRef?.dnaId && (
              <div className="mb-5 p-4 rounded-xl bg-[#D4A76A]/10 border border-[#D4A76A]/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const dna = getAssignedDna(active);
                      return (
                        <>
                          {dna?.masterImage?.filename && (
                            <img
                              src={`/api/images/${dna.masterImage.filename}`}
                              alt=""
                              className="w-12 h-12 object-cover rounded-lg border border-[#E8D5B0]/50"
                            />
                          )}
                          <div>
                            <span className="text-[13px] font-bold text-[#5A4E3A]">
                              {dna?.name || "Unnamed"}
                            </span>
                            <p className="text-[11px] text-[#8A7E6B]">
                              {dna?.elementCount || 0} 要素
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={handleUnassign}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold transition-colors"
                  >
                    解除
                  </button>
                </div>

                {/* デバイスフレーム選択（web type の場合） */}
                {(() => {
                  const dna = getAssignedDna(active);
                  if (dna?.type === "web" && dna?.deviceFrames) {
                    return (
                      <div className="flex gap-2 mb-3">
                        {["pc", "sp"].map((d) => (
                          dna.deviceFrames[d] && (
                            <button
                              key={d}
                              onClick={() => handleDeviceChange(d)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                active.designRef?.deviceFrame === d
                                  ? "bg-[#3aafc9] text-white"
                                  : "bg-white/60 text-[#8A7E6B] border border-[#E8D5B0]/50"
                              }`}
                            >
                              {d.toUpperCase()}
                            </button>
                          )
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* モード選択 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#8B6914]">再現モード</span>
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleModeChange(opt.value)}
                      disabled={opt.value !== "none" && !active.designRef?.dnaId}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        active.mode === opt.value
                          ? `border-[${opt.color}]`
                          : "border-transparent"
                      } ${active.mode === opt.value ? "bg-white/80" : "bg-white/30 hover:bg-white/50"}`}
                      style={active.mode === opt.value ? { borderColor: opt.color } : {}}
                    >
                      <span className="text-[12px] font-bold" style={{ color: opt.color }}>
                        {opt.label}
                      </span>
                      <p className="text-[11px] text-[#8A7E6B] mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── ライブラリ検索 ── */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="デザイン名で検索..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-[13px] text-[#5A4E3A] focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/20 placeholder:text-[#C49A6C]/60 mb-4"
            />

            {/* ── ライブラリグリッド ── */}
            {libraryLoading ? (
              <div className="py-12 text-center text-[13px] text-[#8A7E6B] animate-pulse">
                デザインライブラリを読み込み中...
              </div>
            ) : filteredLibrary.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#8A7E6B]">
                デザインが見つかりません。先に Figma インポートからデザインを取り込んでください。
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {filteredLibrary.map((dna) => {
                  const isAssigned = active.designRef?.dnaId === dna.id;
                  return (
                    <button
                      key={dna.id}
                      onClick={() => setPreviewModal({ dnaId: dna.id, sectionId: activeSection })}
                      className={`group relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-md ${
                        isAssigned
                          ? "border-[#D4A76A] ring-2 ring-[#D4A76A]/30"
                          : "border-[#E8D5B0]/50 hover:border-[#D4A76A]/50"
                      }`}
                    >
                      {/* サムネイル */}
                      <div className="aspect-[4/3] bg-[#F5E6C8]/50 overflow-hidden">
                        {dna.masterImage?.filename ? (
                          <img
                            src={`/api/images/${dna.masterImage.filename}`}
                            alt={dna.name}
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#C49A6C] text-[24px]">
                            🎨
                          </div>
                        )}
                      </div>
                      {/* ラベル */}
                      <div className="p-2 bg-white/80">
                        <p className="text-[11px] font-semibold text-[#5A4E3A] truncate">
                          {dna.name || "Unnamed"}
                        </p>
                        <p className="text-[10px] text-[#8A7E6B]">
                          {dna.elementCount || 0} 要素
                          {dna.type === "web" && " ・ Web"}
                        </p>
                      </div>
                      {isAssigned && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#D4A76A] flex items-center justify-center text-white text-[10px]">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center text-[13px] text-[#8A7E6B]">
            左のセクションを選択してください
          </div>
        )}
      </motion.div>

      {/* ── デザインプレビューモーダル ── */}
      {previewModal && (() => {
        const dna = dnaLibrary.find((d) => d.id === previewModal.dnaId);
        const section = sections.find((s) => s.id === previewModal.sectionId);
        if (!dna) return null;
        return (
          <DesignPreviewModal
            open={!!previewModal}
            dna={dna}
            deviceFrame={section?.designRef?.deviceFrame || null}
            selectedIndices={section?.designRef?.elementIndices || []}
            onConfirm={(indices) => {
              setSections((prev) =>
                prev.map((s) =>
                  s.id === previewModal.sectionId
                    ? {
                        ...s,
                        designRef: {
                          dnaId: previewModal.dnaId,
                          deviceFrame: s.designRef?.deviceFrame || null,
                          elementIndices: indices,
                        },
                        mode: s.mode === "none" ? "reference" : s.mode,
                      }
                    : s
                )
              );
              setPreviewModal(null);
            }}
            onClose={() => setPreviewModal(null)}
          />
        );
      })()}
    </div>
  );
}
