import { useState } from "react";
import { motion } from "framer-motion";
import { getRoleColor } from "../../constants/roles";

const CONTENT_MODES = [
  { value: "ai", label: "生成AIで作成", desc: "AI がセクションにふさわしいコンテンツを生成" },
  { value: "dummy", label: "仮テキスト", desc: "「見出し見出し」「本文本文...」を配置" },
  { value: "manual", label: "自分で入力", desc: "テキストを手動で入力します" },
];

const INHERIT_ITEMS = [
  { key: "inheritColors", label: "配色", desc: "元デザインのカラーパレットを継承" },
  { key: "inheritFonts", label: "フォント", desc: "元デザインのフォントファミリーを継承" },
  { key: "inheritLayout", label: "配置・レイアウト", desc: "元デザインの配置構造を踏襲" },
];

const CLONE_CONTENT_OPTIONS = [
  { value: "keep", label: "そのまま使用", desc: "テキスト・画像を元デザインそのまま流用" },
  { value: "replace", label: "テキスト・画像を入れ替え", desc: "レイアウトは維持し、AI がテキストと画像を新しいものに差し替え" },
];

export default function ReferenceConfigPanel({ sections: initialSections, onComplete, onBack }) {
  const [sections, setSections] = useState(
    initialSections.map((s) => ({
      ...s,
      referenceConfig: s.referenceConfig || {
        inheritColors: true,
        inheritFonts: true,
        inheritLayout: false,
        contentMode: "ai",
        manualContent: "",
        customInstructions: "",
        cloneContent: "keep",
      },
    }))
  );

  // clone または reference のセクションを表示
  const configurableSections = sections.filter(
    (s) => s.mode === "reference" || (s.mode === "clone" && s.designRef?.dnaId)
  );

  const [activeId, setActiveId] = useState(
    configurableSections[0]?.id || sections[0]?.id
  );

  const activeSection = sections.find((s) => s.id === activeId) || null;

  // 設定更新
  const updateConfig = (id, key, value) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, referenceConfig: { ...s.referenceConfig, [key]: value } }
          : s
      )
    );
  };

  return (
    <div className="flex gap-6" style={{ minHeight: "60vh" }}>
      {/* ── 左パネル: セクション切り替え ── */}
      <div className="w-72 flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm"
        >
          <h3 className="text-[14px] font-bold text-[#5A4E3A] mb-1">詳細設定</h3>
          <p className="text-[12px] text-[#8A7E6B] mb-4">
            各セクションのコンテンツと参照設定を行います
          </p>

          {configurableSections.length === 0 ? (
            <p className="text-[12px] text-[#C49A6C] py-4 text-center">
              設定可能なセクションがありません
            </p>
          ) : (
            <div className="space-y-1.5">
              {configurableSections.map((section) => {
                const isActive = section.id === activeId;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveId(section.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      isActive
                        ? "border-[#7c3aed] bg-[#7c3aed]/5"
                        : "border-transparent bg-white/40 hover:bg-white/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getRoleColor(section.role) }}
                      />
                      <span className="text-[13px] font-semibold text-[#5A4E3A] truncate flex-1">
                        {section.label}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: section.mode === "clone" ? "#3b82f620" : "#7c3aed20",
                          color: section.mode === "clone" ? "#3b82f6" : "#7c3aed",
                        }}
                      >
                        {section.mode === "clone" ? "完全再現" : "デザイン参考"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

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
              onClick={() => onComplete(sections)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white text-[12px] font-bold shadow-md transition-all"
            >
              生成へ →
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* ── 右パネル: 設定フォーム ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm overflow-y-auto"
        style={{ maxHeight: "70vh" }}
      >
        {activeSection && activeSection.mode === "clone" ? (
          /* ── 完全再現モードの設定 ── */
          <>
            <h3 className="text-[15px] font-bold text-[#5A4E3A] mb-5">
              「{activeSection.label}」の詳細設定
            </h3>

            <div className="mb-5 p-3 rounded-xl bg-blue-50/80 border border-blue-200/60">
              <p className="text-[12px] text-blue-700 leading-relaxed">
                <strong>完全再現モード:</strong> レイアウト・スタイルを元デザインから 100% 再現します。API は消費されません。
              </p>
            </div>

            {/* ── コンテンツ設定 ── */}
            <div className="mb-6">
              <h4 className="text-[13px] font-bold text-[#8B6914] mb-3">
                テキスト・画像の扱い
              </h4>
              <div className="space-y-2">
                {CLONE_CONTENT_OPTIONS.map((opt) => {
                  const isSelected = (activeSection.referenceConfig?.cloneContent || "keep") === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#3b82f6] bg-[#3b82f6]/5"
                          : "border-transparent bg-white/40 hover:bg-white/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`cloneContent-${activeSection.id}`}
                        checked={isSelected}
                        onChange={() => updateConfig(activeSection.id, "cloneContent", opt.value)}
                        className="mt-0.5 w-4 h-4 text-[#3b82f6] focus:ring-[#3b82f6]/30"
                      />
                      <div>
                        <span className="text-[13px] font-semibold text-[#5A4E3A]">{opt.label}</span>
                        <p className="text-[11px] text-[#8A7E6B] mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ── 入れ替え時のみ: 手動テキスト or AI 生成 ── */}
            {(activeSection.referenceConfig?.cloneContent || "keep") === "replace" && (
              <>
                <div className="mb-5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/60">
                  <p className="text-[12px] text-amber-700 leading-relaxed">
                    <strong>API クレジット消費:</strong> テキスト・画像の入れ替え時は AI が新しいコンテンツを生成するため、API クレジットが消費されます。
                  </p>
                </div>

                <div className="mb-6">
                  <h4 className="text-[13px] font-bold text-[#8B6914] mb-3">
                    コンテンツ生成モード
                  </h4>
                  <div className="space-y-2">
                    {CONTENT_MODES.map((cm) => (
                      <label
                        key={cm.value}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          activeSection.referenceConfig?.contentMode === cm.value
                            ? "border-[#3b82f6] bg-[#3b82f6]/5"
                            : "border-transparent bg-white/40 hover:bg-white/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`contentMode-${activeSection.id}`}
                          checked={activeSection.referenceConfig?.contentMode === cm.value}
                          onChange={() => updateConfig(activeSection.id, "contentMode", cm.value)}
                          className="mt-0.5 w-4 h-4 text-[#3b82f6] focus:ring-[#3b82f6]/30"
                        />
                        <div>
                          <span className="text-[13px] font-semibold text-[#5A4E3A]">{cm.label}</span>
                          <p className="text-[11px] text-[#8A7E6B] mt-0.5">{cm.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {activeSection.referenceConfig?.contentMode === "manual" && (
                  <div className="mb-6">
                    <label className="block text-[13px] font-semibold text-[#8B6914] mb-1.5">
                      テキスト内容
                    </label>
                    <textarea
                      value={activeSection.referenceConfig?.manualContent || ""}
                      onChange={(e) => updateConfig(activeSection.id, "manualContent", e.target.value)}
                      placeholder="このセクションに表示するテキストを入力..."
                      rows={5}
                      className="w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-[13px] text-[#5A4E3A] focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/20 placeholder:text-[#C49A6C]/60 resize-y"
                    />
                  </div>
                )}
              </>
            )}
          </>
        ) : activeSection && activeSection.mode === "reference" ? (
          /* ── デザイン参考モードの設定 ── */
          <>
            <h3 className="text-[15px] font-bold text-[#5A4E3A] mb-5">
              「{activeSection.label}」の詳細設定
            </h3>

            {/* ── API 消費警告 ── */}
            <div className="mb-5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/60">
              <p className="text-[12px] text-amber-700 leading-relaxed">
                <strong>API クレジット消費:</strong> どのコンテンツモードを選択しても、セクション生成時に AI モデルの API クレジットが消費されます。
              </p>
            </div>

            {/* ── 継承設定 ── */}
            <div className="mb-6">
              <h4 className="text-[13px] font-bold text-[#8B6914] mb-3">
                デザイン属性の継承
              </h4>
              <div className="space-y-2">
                {INHERIT_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/40 border border-[#E8D5B0]/30 cursor-pointer hover:bg-white/60 transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={activeSection.referenceConfig?.[item.key] || false}
                      onChange={(e) => updateConfig(activeSection.id, item.key, e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-[#D4A76A]/50 text-[#D4A76A] focus:ring-[#D4A76A]/30"
                    />
                    <div>
                      <span className="text-[13px] font-semibold text-[#5A4E3A]">{item.label}</span>
                      <p className="text-[11px] text-[#8A7E6B] mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ── コンテンツ生成モード ── */}
            <div className="mb-6">
              <h4 className="text-[13px] font-bold text-[#8B6914] mb-3">
                コンテンツ生成モード
              </h4>
              <div className="space-y-2">
                {CONTENT_MODES.map((cm) => (
                  <label
                    key={cm.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      activeSection.referenceConfig?.contentMode === cm.value
                        ? "border-[#7c3aed] bg-[#7c3aed]/5"
                        : "border-transparent bg-white/40 hover:bg-white/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`contentMode-${activeSection.id}`}
                      checked={activeSection.referenceConfig?.contentMode === cm.value}
                      onChange={() => updateConfig(activeSection.id, "contentMode", cm.value)}
                      className="mt-0.5 w-4 h-4 text-[#7c3aed] focus:ring-[#7c3aed]/30"
                    />
                    <div>
                      <span className="text-[13px] font-semibold text-[#5A4E3A]">{cm.label}</span>
                      <p className="text-[11px] text-[#8A7E6B] mt-0.5">{cm.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 手動入力テキスト ── */}
            {activeSection.referenceConfig?.contentMode === "manual" && (
              <div className="mb-6">
                <label className="block text-[13px] font-semibold text-[#8B6914] mb-1.5">
                  テキスト内容
                </label>
                <textarea
                  value={activeSection.referenceConfig?.manualContent || ""}
                  onChange={(e) => updateConfig(activeSection.id, "manualContent", e.target.value)}
                  placeholder="このセクションに表示するテキストを入力..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-[13px] text-[#5A4E3A] focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/20 placeholder:text-[#C49A6C]/60 resize-y"
                />
              </div>
            )}

            {/* ── カスタム指示 ── */}
            <div className="mb-2">
              <label className="block text-[13px] font-semibold text-[#8B6914] mb-1.5">
                カスタム指示（任意）
              </label>
              <textarea
                value={activeSection.referenceConfig?.customInstructions || ""}
                onChange={(e) => updateConfig(activeSection.id, "customInstructions", e.target.value)}
                placeholder="AI への追加指示があれば入力... 例:「写真は使わずイラスト風に」"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-[13px] text-[#5A4E3A] focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/20 placeholder:text-[#C49A6C]/60 resize-y"
              />
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-[13px] text-[#8A7E6B]">
            左のセクションを選択して詳細設定を行ってください
          </div>
        )}
      </motion.div>
    </div>
  );
}
