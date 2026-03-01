import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const canvasW = 1440;
const canvasH = 900;

export default function DesignPreviewModal({
  open,
  dna,
  deviceFrame,
  selectedIndices,
  onConfirm,
  onClose,
}) {
  const [selected, setSelected] = useState(new Set(selectedIndices || []));
  const [previewZoom, setPreviewZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // 要素ソース: デバイスフレーム優先
  const elements = useMemo(() => {
    if (!dna) return [];
    if (deviceFrame && dna.deviceFrames?.[deviceFrame]?.elements) {
      return dna.deviceFrames[deviceFrame].elements;
    }
    return dna.elements || [];
  }, [dna, deviceFrame]);

  // マスター画像ソース
  const masterImage = useMemo(() => {
    if (!dna) return null;
    if (deviceFrame && dna.deviceFrames?.[deviceFrame]?.masterImage?.filename) {
      return dna.deviceFrames[deviceFrame].masterImage;
    }
    return dna.masterImage || null;
  }, [dna, deviceFrame]);

  // ルート BB 計算
  const rootBB = useMemo(() => {
    if (!elements.length) return { x: 0, y: 0, width: canvasW, height: canvasH };
    let best = null;
    let bestArea = 0;
    for (const el of elements) {
      const bb = el.boundingBox;
      if (!bb || bb.width <= 0 || bb.height <= 0) continue;
      const a = bb.width * bb.height;
      if (a > bestArea) { bestArea = a; best = bb; }
    }
    return best || { x: 0, y: 0, width: canvasW, height: canvasH };
  }, [elements]);

  // フィルター済み要素（ルート幅の 30% 以上）
  const filteredElements = useMemo(() => {
    if (!elements.length) return [];
    return elements
      .map((el, idx) => ({ el, idx }))
      .filter(({ el, idx }) => {
        if (idx === 0) return false;
        const bb = el.boundingBox;
        if (!bb || bb.width <= 0 || bb.height <= 0) return false;
        return bb.width >= rootBB.width * 0.3;
      })
      .sort((a, b) => (a.el.boundingBox.y || 0) - (b.el.boundingBox.y || 0));
  }, [elements, rootBB]);

  // オートフィット: モーダルが開いた時にコンテナ幅に100%フィット
  useEffect(() => {
    if (!open || !containerRef.current || !masterImage) return;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth - 24; // padding 分
      const imgWidth = rootBB.width;
      if (imgWidth > 0 && containerWidth > 0) {
        const fitScale = containerWidth / imgWidth;
        setPreviewZoom(Math.min(fitScale, 1)); // 1 以下にフィット
      }
      setPanOffset({ x: 0, y: 0 });
    }, 100);
    return () => clearTimeout(timer);
  }, [open, masterImage, rootBB.width]);

  // Ctrl+Wheel ズーム
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setPreviewZoom((z) => Math.min(Math.max(z * delta, 0.1), 8));
  }, []);

  // Space キーでパンモード
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(false);
        setIsPanning(false);
        panStartRef.current = null;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [open]);

  // パン操作ハンドラ
  const handlePanStart = useCallback((e) => {
    if (!spaceHeld) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  }, [spaceHeld, panOffset]);

  const handlePanMove = useCallback((e) => {
    if (!isPanning || !panStartRef.current) return;
    e.preventDefault();
    setPanOffset({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const toggleSelection = (idx) => {
    if (spaceHeld) return; // パン中はクリック無効
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filteredElements.map(({ idx }) => idx)));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const resetView = () => {
    setPanOffset({ x: 0, y: 0 });
    // オートフィット再計算
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 24;
      const fitScale = containerWidth / rootBB.width;
      setPreviewZoom(Math.min(fitScale, 1));
    }
  };

  const hasMaster = !!masterImage?.filename;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1100px] flex flex-col overflow-hidden"
            style={{ height: "min(85vh, 800px)" }}
          >
            {/* ── ヘッダー ── */}
            <div className="px-6 py-3 border-b border-[#E8D5B0]/50 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#7c3aed]/5 to-[#a259ff]/5">
              <div>
                <h2 className="text-[15px] font-bold text-[#5A4E3A]">
                  使用する要素を選択
                </h2>
                <p className="text-[12px] text-[#8A7E6B] mt-0.5">
                  「{dna?.name || ""}」からこのセクションに使う部分をクリックで選択
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
              >
                ×
              </button>
            </div>

            {/* ── ボディ ── */}
            <div className="flex-1 min-h-0 flex">
              {/* 左: プレビュー */}
              <div className="flex-1 min-w-0 flex flex-col">
                {hasMaster && (
                  <div className="px-3 pt-2 flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setPreviewZoom((z) => Math.min(z * 1.25, 8))}
                      className="w-7 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-sm font-bold hover:bg-white shadow-sm transition-all"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setPreviewZoom((z) => Math.max(z / 1.25, 0.1))}
                      className="w-7 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-sm font-bold hover:bg-white shadow-sm transition-all"
                    >
                      -
                    </button>
                    <button
                      onClick={resetView}
                      className="px-2 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-[11px] font-semibold hover:bg-white shadow-sm transition-all"
                    >
                      Fit
                    </button>
                    <span className="text-[11px] text-[#8A7E6B] ml-1">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <span className="text-[10px] text-[#C49A6C] ml-auto">
                      Ctrl+Wheel: ズーム / Space+ドラッグ: 移動
                    </span>
                  </div>
                )}
                <div
                  ref={containerRef}
                  className="flex-1 min-h-0 m-3 overflow-auto bg-gray-100/50 rounded-xl relative"
                  onWheel={handleWheel}
                  onMouseDown={handlePanStart}
                  onMouseMove={handlePanMove}
                  onMouseUp={handlePanEnd}
                  onMouseLeave={handlePanEnd}
                  style={{ cursor: spaceHeld ? (isPanning ? "grabbing" : "grab") : "default" }}
                >
                  {hasMaster ? (
                    <div
                      ref={imageRef}
                      className="relative origin-top-left"
                      style={{
                        width: rootBB.width * previewZoom,
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                        margin: "0 auto",
                      }}
                    >
                      <img
                        src={`/api/images/${masterImage.filename}`}
                        alt="Design"
                        className="w-full h-auto block"
                        draggable={false}
                        onDoubleClick={resetView}
                      />
                      {/* 要素オーバーレイ */}
                      {filteredElements.map(({ el, idx }) => {
                        const bb = el.boundingBox;
                        const relX = ((bb.x - rootBB.x) / rootBB.width) * 100;
                        const relY = ((bb.y - rootBB.y) / rootBB.height) * 100;
                        const relW = (bb.width / rootBB.width) * 100;
                        const relH = (bb.height / rootBB.height) * 100;
                        const isSelected = selected.has(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleSelection(idx)}
                            className="absolute cursor-pointer transition-all group"
                            style={{
                              left: `${relX}%`,
                              top: `${relY}%`,
                              width: `${relW}%`,
                              height: `${relH}%`,
                              border: isSelected
                                ? "3px solid #7c3aed"
                                : "2px solid transparent",
                              background: isSelected
                                ? "rgba(124,58,237,0.12)"
                                : "transparent",
                            }}
                          >
                            <div
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{
                                border: isSelected ? "none" : "2px dashed rgba(58,175,201,0.7)",
                                background: isSelected ? "none" : "rgba(58,175,201,0.06)",
                              }}
                            />
                            {/* ラベルツールチップ */}
                            <div className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <span className="px-1.5 py-0.5 bg-[#5A4E3A]/90 text-white text-[10px] rounded whitespace-nowrap">
                                {el.name || el.figmaNodeName || el.selector || `要素 ${idx}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* マスター画像なし — 要素リスト */
                    <div className="p-4 space-y-1.5">
                      <p className="text-[12px] text-[#8A7E6B] mb-3">
                        マスター画像がないため、要素リストから選択してください
                      </p>
                      {filteredElements.map(({ el, idx }) => {
                        const isSelected = selected.has(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleSelection(idx)}
                            className={`w-full text-left p-2.5 rounded-lg border-2 transition-all ${
                              isSelected
                                ? "border-[#7c3aed] bg-[#7c3aed]/5"
                                : "border-transparent bg-white/50 hover:bg-white/80"
                            }`}
                          >
                            <span className="text-[12px] text-[#5A4E3A] font-medium">
                              {el.name || el.figmaNodeName || `要素 ${idx}`}
                            </span>
                            {el.boundingBox && (
                              <span className="text-[10px] text-[#8A7E6B] ml-2">
                                {Math.round(el.boundingBox.width)}×{Math.round(el.boundingBox.height)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 右: 選択一覧 */}
              <div className="w-[250px] flex-shrink-0 border-l border-[#E8D5B0]/30 flex flex-col">
                <div className="p-4 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-bold text-[#5A4E3A]">
                      選択中: {selected.size} / {filteredElements.length}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={selectAll}
                        className="text-[10px] text-[#7c3aed] hover:underline font-semibold"
                      >
                        全選択
                      </button>
                      <button
                        onClick={clearAll}
                        className="text-[10px] text-[#8A7E6B] hover:underline font-semibold"
                      >
                        解除
                      </button>
                    </div>
                  </div>

                  {selected.size === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[12px] text-[#C49A6C]">
                        {hasMaster
                          ? "左のプレビューから要素をクリックして選択"
                          : "上のリストから要素をクリックして選択"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    {filteredElements
                      .filter(({ idx }) => selected.has(idx))
                      .map(({ el, idx }) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-[#7c3aed]/5 border border-[#7c3aed]/20"
                        >
                          <span className="w-4 h-4 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-[8px]">
                            ✓
                          </span>
                          <span className="text-[11px] text-[#5A4E3A] flex-1 truncate">
                            {el.name || el.figmaNodeName || `要素 ${idx}`}
                          </span>
                          <button
                            onClick={() => toggleSelection(idx)}
                            className="text-[10px] text-[#8A7E6B] hover:text-red-500"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-[#E8D5B0]/30 space-y-2">
                  <p className="text-[11px] text-[#8A7E6B] leading-relaxed">
                    選択なしの場合、デザイン全体が参照されます
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onConfirm(Array.from(selected))}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    {selected.size > 0
                      ? `${selected.size} 要素を選択して確定`
                      : "デザイン全体を参照"}
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="w-full py-2 rounded-xl border border-[#D4A76A]/30 bg-white/50 text-[#8A7E6B] text-[12px] font-semibold hover:bg-white/80 transition-all"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
