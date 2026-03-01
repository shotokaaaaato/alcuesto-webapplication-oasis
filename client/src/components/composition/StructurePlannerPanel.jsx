import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { ROLES, getRoleColor, getRoleLabel } from "../../constants/roles";

export default function StructurePlannerPanel({ pageName, aiModel, apiKey, headers, initialSections, onComplete, onBack }) {
  const [sections, setSections] = useState(
    initialSections && initialSections.length > 0
      ? initialSections.map((s) => ({ ...s }))
      : []
  );
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");

  // AI 構成提案
  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestError("");
    try {
      const res = await fetch("/api/compose/suggest-structure", {
        method: "POST",
        headers,
        body: JSON.stringify({ pageName, model: aiModel, apiKey }),
      });
      const data = await res.json();
      if (data.success && data.sections) {
        const mapped = data.sections.map((s, i) => ({
          id: crypto.randomUUID(),
          label: s.label,
          role: s.role || "section",
          order: i,
          suggestedContent: s.suggestedContent || "",
          designRef: null,
          mode: "none",
          referenceConfig: null,
          status: "pending",
          html: "",
          code: "",
        }));
        setSections(mapped);
      } else {
        setSuggestError(data.error || "提案に失敗しました");
      }
    } catch (err) {
      setSuggestError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  // セクション追加
  const handleAdd = () => {
    setSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: `セクション ${prev.length + 1}`,
        role: "section",
        order: prev.length,
        suggestedContent: "",
        designRef: null,
        mode: "none",
        referenceConfig: null,
        status: "pending",
        html: "",
        code: "",
      },
    ]);
  };

  // セクション削除
  const handleDelete = (id) => {
    setSections((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  // ラベル編集
  const handleLabelSave = (id) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, label: editingLabel } : s)));
    setEditingId(null);
  };

  // 役割変更
  const handleRoleChange = (id, role) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
  };

  const canProceed = sections.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[17px] font-bold text-[#5A4E3A]">構成プランニング</h2>
            <p className="text-[13px] text-[#8A7E6B] mt-1">
              「{pageName}」のセクション構成を定義します
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSuggest}
            disabled={suggesting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-[13px] font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
          >
            {suggesting ? "提案中..." : "AI に構成を提案させる"}
          </motion.button>
        </div>

        {suggestError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-600">
            {suggestError}
          </div>
        )}

        {/* ── セクションリスト ── */}
        {sections.length > 0 ? (
          <Reorder.Group
            axis="y"
            values={sections}
            onReorder={(newOrder) => setSections(newOrder.map((s, i) => ({ ...s, order: i })))}
            className="space-y-2 mb-6"
          >
            {sections.map((section, index) => (
              <Reorder.Item
                key={section.id}
                value={section}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/60 border border-[#E8D5B0]/30 cursor-grab active:cursor-grabbing"
                whileDrag={{ scale: 1.02, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 50 }}
              >
                {/* ドラッグハンドル */}
                <div className="flex items-center text-[#C49A6C] hover:text-[#8A7E6B] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="5" r="1.5" />
                    <circle cx="15" cy="5" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="19" r="1.5" />
                    <circle cx="15" cy="19" r="1.5" />
                  </svg>
                </div>

                {/* 番号 */}
                <span className="w-6 h-6 rounded-full bg-[#E8D5B0]/50 flex items-center justify-center text-[11px] font-bold text-[#8A7E6B]">
                  {index + 1}
                </span>

                {/* 役割バッジ */}
                <select
                  value={section.role}
                  onChange={(e) => handleRoleChange(section.id, e.target.value)}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border-0 cursor-pointer"
                  style={{
                    backgroundColor: `${getRoleColor(section.role)}20`,
                    color: getRoleColor(section.role),
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>

                {/* ラベル */}
                {editingId === section.id ? (
                  <input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => handleLabelSave(section.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleLabelSave(section.id)}
                    autoFocus
                    className="flex-1 px-2 py-1 text-[13px] rounded-lg border border-[#D4A76A]/30 bg-white/80 text-[#5A4E3A] focus:outline-none focus:ring-1 focus:ring-[#D4A76A]/40"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(section.id); setEditingLabel(section.label); }}
                    className="flex-1 text-left text-[13px] text-[#5A4E3A] hover:text-[#8B6914] transition-colors"
                  >
                    {section.label}
                  </button>
                )}

                {/* 提案内容 */}
                {section.suggestedContent && (
                  <span className="text-[11px] text-[#8A7E6B] max-w-[200px] truncate" title={section.suggestedContent}>
                    {section.suggestedContent}
                  </span>
                )}

                {/* 削除 */}
                <button
                  onClick={() => handleDelete(section.id)}
                  className="text-[13px] text-red-400 hover:text-red-600 transition-colors ml-auto"
                >
                  ✕
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div className="py-12 text-center mb-6">
            <p className="text-[13px] text-[#8A7E6B]">
              AI に提案させるか、手動でセクションを追加してください
            </p>
          </div>
        )}

        {/* ── セクション追加 ── */}
        <button
          onClick={handleAdd}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#D4A76A]/30 text-[13px] text-[#C49A6C] font-semibold hover:border-[#D4A76A]/60 hover:text-[#8B6914] transition-all"
        >
          + セクションを追加
        </button>

        {/* ── ナビゲーション ── */}
        <div className="flex justify-between mt-8">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-[#D4A76A]/30 bg-white/50 text-[#8A7E6B] text-[13px] font-semibold hover:bg-white/80 transition-all"
          >
            ← 戻る
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!canProceed}
            onClick={() => onComplete(sections)}
            className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
              canProceed
                ? "bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white shadow-md hover:shadow-lg"
                : "bg-[#E8D5B0]/50 text-[#8A7E6B] cursor-not-allowed"
            }`}
          >
            デザインマッピングへ →
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
