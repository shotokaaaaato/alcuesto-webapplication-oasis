import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── 役割定義 ── */
const ROLES = [
  { value: "header", label: "ヘッダー", color: "#3b82f6" },
  { value: "fv", label: "ファーストビュー", color: "#f59e0b" },
  { value: "section", label: "セクション", color: "#7c3aed" },
  { value: "footer", label: "フッター", color: "#6b7280" },
  { value: "nav", label: "ナビゲーション", color: "#14b8a6" },
  { value: "cta", label: "CTA", color: "#ef4444" },
  { value: "card", label: "カード", color: "#f97316" },
  { value: "other", label: "その他", color: "#8b5cf6" },
];

function getRoleColor(role) {
  return ROLES.find((r) => r.value === role)?.color || "#7c3aed";
}
function getRoleLabel(role) {
  return ROLES.find((r) => r.value === role)?.label || role;
}

/* ── コンポーネント ── */
export default function PageComposerModal({ open, dna, token, onClose, onProceed }) {
  const [composedParts, setComposedParts] = useState([]);
  const [pendingElementIndex, setPendingElementIndex] = useState(null);
  const [pendingRole, setPendingRole] = useState(null); // role selected, now choosing mode
  const [previewZoom, setPreviewZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [highlightedPartId, setHighlightedPartId] = useState(null);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const listRef = useRef(null);

  const canvasW = dna?.masterImage?.width || 1440;
  const canvasH = dna?.masterImage?.height || 900;

  // Load existing pageStructure
  useEffect(() => {
    if (open && dna?.pageStructure?.parts) {
      const restored = dna.pageStructure.parts.map((p, i) => ({
        id: p.id || crypto.randomUUID(),
        elementIndex: p.elementIndices?.[0] ?? -1,
        role: p.role,
        label: p.label,
        mode: p.mode || "refactor",
        order: p.order ?? i,
      }));
      setComposedParts(restored.sort((a, b) => a.order - b.order));
    } else if (open) {
      setComposedParts([]);
    }
    if (open) {
      setPendingElementIndex(null);
      setPendingRole(null);
      setPreviewZoom(1);
      setHighlightedPartId(null);
      setEditingLabelId(null);
    }
  }, [open, dna?.id]);

  /* ── rootBB ── */
  const rootBB = useMemo(() => {
    if (!dna?.elements?.length) return { x: 0, y: 0, width: canvasW, height: canvasH };
    let best = null;
    let bestArea = 0;
    for (const el of dna.elements) {
      const bb = el.boundingBox;
      if (!bb || bb.width <= 0 || bb.height <= 0) continue;
      const a = bb.width * bb.height;
      if (a > bestArea) { bestArea = a; best = bb; }
    }
    return best || { x: 0, y: 0, width: canvasW, height: canvasH };
  }, [dna?.elements, canvasW, canvasH]);

  /* ── フィルター済み要素 ── */
  const filteredElements = useMemo(() => {
    if (!dna?.elements?.length) return [];
    return dna.elements
      .map((el, idx) => ({ el, idx }))
      .filter(({ el, idx }) => {
        if (idx === 0) return false;
        const bb = el.boundingBox;
        if (!bb || bb.width <= 0 || bb.height <= 0) return false;
        return bb.width >= rootBB.width * 0.3;
      })
      .sort((a, b) => (a.el.boundingBox.y || 0) - (b.el.boundingBox.y || 0));
  }, [dna?.elements, rootBB]);

  /* ── グループ分け ── */
  const cloneParts = useMemo(() => composedParts.filter((p) => p.mode === "clone"), [composedParts]);
  const referenceParts = useMemo(() => composedParts.filter((p) => p.mode === "refactor"), [composedParts]);

  /* ── composedParts ヘルパー ── */
  const getComposedPart = useCallback(
    (elIdx) => composedParts.find((p) => p.elementIndex === elIdx),
    [composedParts]
  );

  /* ── 要素クリック ── */
  const handleElementClick = useCallback(
    (elIdx) => {
      const existing = composedParts.find((p) => p.elementIndex === elIdx);
      if (existing) {
        setHighlightedPartId(existing.id);
        setPendingElementIndex(null);
        setPendingRole(null);
        return;
      }
      setPendingElementIndex(elIdx);
      setPendingRole(null);
      setHighlightedPartId(null);
    },
    [composedParts]
  );

  /* ── 役割選択（次にモード選択へ） ── */
  const handleRoleSelect = useCallback((role) => {
    setPendingRole(role);
  }, []);

  /* ── モード選択 → パーツ追加 ── */
  const addPartWithMode = useCallback(
    (mode) => {
      if (pendingElementIndex === null || !pendingRole) return;
      const el = dna.elements[pendingElementIndex];

      let label = getRoleLabel(pendingRole);
      if (pendingRole === "section") {
        const sectionCount = composedParts.filter((p) => p.role === "section").length;
        label = `セクション${sectionCount + 1}`;
      }

      const newPart = {
        id: crypto.randomUUID(),
        elementIndex: pendingElementIndex,
        role: pendingRole,
        label,
        mode, // "clone" | "refactor"
        order: composedParts.length,
      };
      setComposedParts((prev) => [...prev, newPart]);
      setPendingElementIndex(null);
      setPendingRole(null);
      setHighlightedPartId(newPart.id);
    },
    [pendingElementIndex, pendingRole, dna?.elements, composedParts]
  );

  /* ── ラベル編集 ── */
  const startEditLabel = useCallback((part) => {
    setEditingLabelId(part.id);
    setEditingLabelValue(part.label);
  }, []);

  const commitEditLabel = useCallback(() => {
    if (!editingLabelId || !editingLabelValue.trim()) {
      setEditingLabelId(null);
      return;
    }
    setComposedParts((prev) =>
      prev.map((p) => (p.id === editingLabelId ? { ...p, label: editingLabelValue.trim() } : p))
    );
    setEditingLabelId(null);
  }, [editingLabelId, editingLabelValue]);

  /* ── パーツ削除 ── */
  const removePart = useCallback((id) => {
    setComposedParts((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      let sectionCount = 0;
      return filtered.map((p, i) => {
        const updated = { ...p, order: i };
        if (p.role === "section" && !editingLabelId) {
          sectionCount++;
          updated.label = `セクション${sectionCount}`;
        }
        return updated;
      });
    });
    setHighlightedPartId(null);
  }, [editingLabelId]);

  /* ── 自動検出 ── */
  const handleAutoDetect = useCallback(() => {
    if (filteredElements.length === 0) return;
    const parts = [];
    let sectionCount = 0;

    filteredElements.forEach(({ el, idx }, order) => {
      const name = (el.figmaNodeName || el.selector || el.tagName || "").toLowerCase();
      let role = "section";
      if (name.includes("header") || name.includes("ヘッダー")) role = "header";
      else if (name.includes("footer") || name.includes("フッター")) role = "footer";
      else if (name.includes("nav") || name.includes("ナビ") || name.includes("menu")) role = "nav";
      else if (name.includes("hero") || name.includes("fv") || name.includes("ファースト") || name.includes("first")) role = "fv";
      else if (name.includes("cta")) role = "cta";

      if (order === 0 && role === "section") role = "header";
      if (order === filteredElements.length - 1 && role === "section") role = "footer";

      // header/footer/nav → clone, others → refactor
      const mode = ["header", "footer", "nav"].includes(role) ? "clone" : "refactor";

      let label = getRoleLabel(role);
      if (role === "section") {
        sectionCount++;
        label = `セクション${sectionCount}`;
      }

      parts.push({
        id: crypto.randomUUID(),
        elementIndex: idx,
        role,
        label,
        mode,
        order,
      });
    });

    setComposedParts(parts);
    setPendingElementIndex(null);
    setPendingRole(null);
  }, [filteredElements]);

  /* ── 保存 & 次へ ── */
  const handleProceed = useCallback(async () => {
    if (!dna?.id || !token || composedParts.length === 0) return;
    setSaving(true);
    try {
      const parts = composedParts.map((p) => {
        const el = dna.elements?.[p.elementIndex];
        const bb = el?.boundingBox;
        const region = bb
          ? {
              x: (bb.x - rootBB.x) / rootBB.width,
              y: (bb.y - rootBB.y) / rootBB.height,
              width: bb.width / rootBB.width,
              height: bb.height / rootBB.height,
            }
          : { x: 0, y: 0, width: 1, height: 0.1 };
        return {
          id: p.id,
          role: p.role,
          label: p.label,
          region,
          elementIndices: [p.elementIndex],
          mode: p.mode,
          order: p.order,
        };
      });
      await fetch(`/api/dna/${dna.id}/page-structure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pageStructure: { parts, savedAt: new Date().toISOString() } }),
      });
      onProceed(composedParts);
    } catch (err) {
      console.error("Failed to save page structure:", err);
    } finally {
      setSaving(false);
    }
  }, [dna, token, composedParts, rootBB, onProceed]);

  /* ── 要素名取得 ── */
  const getElName = (elIdx) => {
    const el = dna?.elements?.[elIdx];
    return el?.figmaNodeName || el?.selector || `要素${elIdx}`;
  };

  if (!open || !dna) return null;

  /* ── サイドバーモード判定 ── */
  // A: 要素選択中 → 役割選択
  // B: 役割選択済み → モード選択（完全再現 / デザイン参考）
  // C: デフォルト → パーツ一覧（2グループ）
  const sidebarMode = pendingRole ? "mode" : pendingElementIndex !== null ? "role" : "list";

  /* ── パーツカード（共通） ── */
  const renderPartCard = (part, i, listParts) => (
    <div
      key={part.id}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-default ${
        highlightedPartId === part.id
          ? "border-[#7c3aed]/50 bg-[#7c3aed]/5 shadow-sm"
          : "border-[#E8D5B0]/40 hover:border-[#E8D5B0]"
      }`}
      onClick={() => setHighlightedPartId(part.id)}
    >
      <div
        className="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
        style={{ backgroundColor: getRoleColor(part.role) }}
      >
        {part.order + 1}
      </div>
      <div className="flex-1 min-w-0">
        {editingLabelId === part.id ? (
          <input
            autoFocus
            value={editingLabelValue}
            onChange={(e) => setEditingLabelValue(e.target.value)}
            onBlur={commitEditLabel}
            onKeyDown={(e) => { if (e.key === "Enter") commitEditLabel(); if (e.key === "Escape") setEditingLabelId(null); }}
            className="w-full text-[11px] font-semibold text-[#5A4E3A] bg-white border border-[#7c3aed]/30 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/40"
          />
        ) : (
          <p
            className="text-[11px] font-semibold text-[#5A4E3A] truncate cursor-pointer hover:text-[#7c3aed] transition-colors"
            onClick={(e) => { e.stopPropagation(); startEditLabel(part); }}
            title="クリックで名前を編集"
          >
            {part.label}
          </p>
        )}
        <p className="text-[9px] text-[#8A7E6B] truncate">{getElName(part.elementIndex)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); removePart(part.id); }}
        className="w-5 h-5 rounded text-[10px] text-red-400 hover:bg-red-50 transition-all flex items-center justify-center flex-shrink-0"
      >×</button>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1300px] flex flex-col overflow-hidden"
            style={{ height: "min(92vh, 920px)" }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E8D5B0]/30 bg-gradient-to-r from-[#7c3aed]/5 to-[#a259ff]/5 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[16px] font-bold text-[#5A4E3A]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                  ページ構成の設定
                </h2>
                <p className="text-[12px] text-[#8A7E6B] truncate">
                  {dna.name || "無題のデザイン"} — {filteredElements.length} 個の要素
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#E8D5B0]/30 flex items-center justify-center text-[#8A7E6B] transition-all">
                ×
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left: Preview */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex-1 min-h-0 m-4 relative bg-gray-100/50 rounded-xl overflow-auto">
                  <div className="sticky top-2 z-20 flex gap-1 justify-end pr-2 pt-2 pointer-events-none">
                    <button onClick={() => setPreviewZoom((z) => Math.min(z * 1.25, 5))} className="pointer-events-auto w-7 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-sm font-bold hover:bg-white shadow-sm transition-all">+</button>
                    <button onClick={() => setPreviewZoom((z) => Math.max(z / 1.25, 0.1))} className="pointer-events-auto w-7 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-sm font-bold hover:bg-white shadow-sm transition-all">−</button>
                    <button onClick={() => setPreviewZoom(1)} className="pointer-events-auto px-2 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-[11px] font-semibold hover:bg-white shadow-sm transition-all">Reset</button>
                  </div>

                  <div className="flex justify-center pb-4">
                    <div className="relative" style={{ width: canvasW * previewZoom, flexShrink: 0 }}>
                      <img
                        src={`/api/images/${dna.masterImage?.filename}`}
                        alt="Design Master"
                        className="max-w-none block"
                        style={{ width: canvasW * previewZoom, height: "auto" }}
                        draggable={false}
                        onDoubleClick={() => setPreviewZoom(1)}
                      />

                      {filteredElements.map(({ el, idx }) => {
                        const bb = el.boundingBox;
                        const relX = ((bb.x - rootBB.x) / rootBB.width) * 100;
                        const relY = ((bb.y - rootBB.y) / rootBB.height) * 100;
                        const relW = (bb.width / rootBB.width) * 100;
                        const relH = (bb.height / rootBB.height) * 100;
                        const composed = getComposedPart(idx);
                        const isPending = pendingElementIndex === idx;

                        // mode-based overlay style
                        const modeIsDashed = composed?.mode === "refactor";

                        return (
                          <div
                            key={idx}
                            onClick={() => handleElementClick(idx)}
                            className="absolute cursor-pointer transition-all group"
                            style={{
                              left: `${relX}%`,
                              top: `${relY}%`,
                              width: `${relW}%`,
                              height: `${relH}%`,
                              border: composed
                                ? `3px ${modeIsDashed ? "dashed" : "solid"} ${getRoleColor(composed.role)}`
                                : isPending
                                  ? "3px dashed #7c3aed"
                                  : "2px solid transparent",
                              background: composed
                                ? `${getRoleColor(composed.role)}18`
                                : isPending
                                  ? "rgba(124,58,237,0.08)"
                                  : "transparent",
                              zIndex: isPending ? 20 : composed ? 10 : 5,
                            }}
                          >
                            {!composed && !isPending && (
                              <div className="absolute inset-0 border-2 border-[#7c3aed]/40 bg-[#7c3aed]/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />
                            )}
                            <div className="absolute -top-6 left-0 px-2 py-0.5 bg-black/75 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                              {getElName(idx)}
                            </div>
                            {composed && (
                              <div
                                className="absolute left-0 px-1.5 py-0.5 text-[10px] font-bold text-white rounded-br pointer-events-none"
                                style={{ top: 0, background: getRoleColor(composed.role) }}
                              >
                                {composed.label} {composed.mode === "clone" ? "●" : "◇"}
                              </div>
                            )}
                            {isPending && (
                              <div className="absolute left-0 top-0 px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#7c3aed] rounded-br pointer-events-none">
                                選択中...
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Sidebar */}
              <div className="w-[300px] flex-shrink-0 border-l border-[#E8D5B0]/30 flex flex-col overflow-hidden">
                {sidebarMode === "role" ? (
                  /* ── [A] 役割選択 ── */
                  <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-[13px] font-semibold text-[#8A7E6B] mb-1">この要素の役割を選択</p>
                    <p className="text-[12px] text-[#5A4E3A] font-medium mb-4 truncate">
                      {getElName(pendingElementIndex)}
                    </p>
                    <div className="space-y-1.5">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => handleRoleSelect(r.value)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-[#E8D5B0]/40 hover:border-[#E8D5B0] hover:shadow-sm transition-all text-left group"
                        >
                          <div className="w-4 h-4 rounded-md flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <span className="text-[13px] font-semibold text-[#5A4E3A] group-hover:text-[#3A3020]">{r.label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setPendingElementIndex(null); setPendingRole(null); }}
                      className="mt-4 w-full px-3 py-2 rounded-xl border border-[#E8D5B0]/40 text-[13px] font-semibold text-[#8A7E6B] hover:bg-[#E8D5B0]/10 transition-all"
                    >
                      戻る
                    </button>
                  </div>
                ) : sidebarMode === "mode" ? (
                  /* ── [B] モード選択（完全再現 / デザイン参考） ── */
                  <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-[13px] font-semibold text-[#8A7E6B] mb-1">使い方を選択</p>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-4 h-4 rounded-md" style={{ backgroundColor: getRoleColor(pendingRole) }} />
                      <span className="text-[13px] font-semibold text-[#5A4E3A]">{getRoleLabel(pendingRole)}</span>
                      <span className="text-[11px] text-[#8A7E6B]">— {getElName(pendingElementIndex)}</span>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={() => addPartWithMode("clone")}
                        className="w-full text-left p-4 rounded-xl border-2 border-[#f59e0b]/40 hover:border-[#f59e0b] hover:shadow-md transition-all group bg-[#f59e0b]/3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[14px]">●</span>
                          <span className="text-[14px] font-bold text-[#5A4E3A] group-hover:text-[#f59e0b]">完全再現</span>
                        </div>
                        <p className="text-[11px] text-[#8A7E6B] leading-relaxed">
                          このパーツのデザインをそのまま使用します。レイアウト・色・フォントを忠実に再現します。
                        </p>
                      </button>

                      <button
                        onClick={() => addPartWithMode("refactor")}
                        className="w-full text-left p-4 rounded-xl border-2 border-[#7c3aed]/40 hover:border-[#7c3aed] hover:shadow-md transition-all group bg-[#7c3aed]/3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[14px]">◇</span>
                          <span className="text-[14px] font-bold text-[#5A4E3A] group-hover:text-[#7c3aed]">デザイン参考</span>
                        </div>
                        <p className="text-[11px] text-[#8A7E6B] leading-relaxed">
                          このパーツの配置やスタイルを参考にして、AIが新しいコンテンツを生成します。
                        </p>
                      </button>
                    </div>

                    <button
                      onClick={() => setPendingRole(null)}
                      className="mt-4 w-full px-3 py-2 rounded-xl border border-[#E8D5B0]/40 text-[13px] font-semibold text-[#8A7E6B] hover:bg-[#E8D5B0]/10 transition-all"
                    >
                      戻る
                    </button>
                  </div>
                ) : (
                  /* ── [C] パーツ一覧（2グループ） ── */
                  <div className="flex-1 overflow-y-auto p-4" ref={listRef}>
                    {composedParts.length === 0 ? (
                      <div className="text-center py-8 text-[12px] text-[#C49A6C]">
                        <svg className="mx-auto mb-2 w-8 h-8 text-[#E8D5B0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                        左のプレビューから<br />要素をクリックして追加
                      </div>
                    ) : (
                      <>
                        {/* 完全再現グループ */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[13px]">●</span>
                            <p className="text-[12px] font-bold text-[#f59e0b]">完全再現</p>
                            <span className="text-[10px] text-[#8A7E6B]">({cloneParts.length})</span>
                          </div>
                          {cloneParts.length === 0 ? (
                            <p className="text-[10px] text-[#C49A6C] pl-5">そのまま使うパーツはまだありません</p>
                          ) : (
                            <div className="space-y-1.5">
                              {cloneParts.map((part, i) => renderPartCard(part, i, cloneParts))}
                            </div>
                          )}
                        </div>

                        {/* デザイン参考グループ */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[13px]">◇</span>
                            <p className="text-[12px] font-bold text-[#7c3aed]">デザイン参考</p>
                            <span className="text-[10px] text-[#8A7E6B]">({referenceParts.length})</span>
                          </div>
                          {referenceParts.length === 0 ? (
                            <p className="text-[10px] text-[#C49A6C] pl-5">参考にするパーツはまだありません</p>
                          ) : (
                            <div className="space-y-1.5">
                              {referenceParts.map((part, i) => renderPartCard(part, i, referenceParts))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#E8D5B0]/30 bg-[#FEFCF9] flex-shrink-0">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#E8D5B0]/50 text-[13px] font-semibold text-[#8A7E6B] hover:bg-[#E8D5B0]/10 transition-all">
                キャンセル
              </button>
              <button onClick={handleAutoDetect} className="px-4 py-2 rounded-xl border border-[#E8D5B0]/50 text-[13px] font-semibold text-[#5A4E3A] hover:bg-[#E8D5B0]/10 transition-all">
                自動検出
              </button>
              <button
                onClick={handleProceed}
                disabled={composedParts.length === 0 || saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "次へ: 生成設定 →"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
