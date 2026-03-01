import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { getRoleColor } from "../../constants/roles";

export default function CompositionPreviewPanel({
  sections: initialSections,
  dnaLibrary,
  pageName,
  aiModel,
  apiKey,
  imageMode,
  headers,
  onComplete,
  onBack,
}) {
  const [sections, setSections] = useState(
    initialSections.map((s) => ({
      ...s,
      status: s.status || "pending",
      html: s.html || "",
      code: s.code || "",
    }))
  );
  // 最初のユーザーアクション必要なセクションを初期表示 (clone+keep は自動生成のためスキップ)
  const isAutoCloneInit = (s) => s?.mode === "clone" && (s?.referenceConfig?.cloneContent || "keep") === "keep";
  const firstActionNeeded = initialSections.findIndex((s) => !isAutoCloneInit(s));
  const [currentIndex, setCurrentIndex] = useState(firstActionNeeded !== -1 ? firstActionNeeded : 0);
  const [generatingSet, setGeneratingSet] = useState(new Set());
  const [error, setError] = useState("");
  const [previewDevice, setPreviewDevice] = useState("pc");

  const generating = generatingSet.size > 0;
  const current = sections[currentIndex];
  const approvedCount = sections.filter((s) => s.status === "done").length;
  const allDone = sections.every((s) => s.status === "done" || s.status === "skipped");
  const cloneInitRef = useRef(false);

  // clone+keep (純粋な完全再現、自動生成) かどうか
  const isAutoClone = (s) => s?.mode === "clone" && (s?.referenceConfig?.cloneContent || "keep") === "keep";

  // 最新の sections を常に参照可能にする ref
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  // ソースデザインの elements を取得
  const getSourceElements = useCallback(
    (section) => {
      if (!section.designRef?.dnaId) return null;
      const dna = dnaLibrary.find((d) => d.id === section.designRef.dnaId);
      if (!dna) return null;
      // デバイスフレームが指定されている場合
      let elements;
      if (section.designRef.deviceFrame && dna.deviceFrames?.[section.designRef.deviceFrame]) {
        elements = dna.deviceFrames[section.designRef.deviceFrame].elements;
      } else {
        elements = dna.elements;
      }
      // 要素選択がある場合はフィルタ
      const indices = section.designRef.elementIndices;
      if (indices && indices.length > 0) {
        return elements.filter((_, i) => indices.includes(i));
      }
      return elements;
    },
    [dnaLibrary]
  );

  // Clone モード (そのまま) は初期化時に全て一括生成
  useEffect(() => {
    if (cloneInitRef.current) return;
    const cloneKeepIndices = initialSections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => isAutoClone(s) && s.status !== "done" && s.designRef?.dnaId)
      .map(({ i }) => i);
    if (cloneKeepIndices.length === 0) return;
    cloneInitRef.current = true;
    cloneKeepIndices.forEach((idx) => generateSection(idx));
  }, []);

  // 前セクションの HTML コンテキスト
  const previousSectionsHtml = useMemo(
    () =>
      sections
        .filter((s, i) => i < currentIndex && s.status === "done")
        .map((s) => s.html)
        .join("\n"),
    [sections, currentIndex]
  );

  // DNA カラーパレットから CSS を生成
  const dnaCssBlock = useMemo(() => {
    const cssRules = [];
    const seenColors = new Set();
    for (const s of sections) {
      if (!s.designRef?.dnaId) continue;
      const dna = dnaLibrary.find((d) => d.id === s.designRef.dnaId);
      if (!dna) continue;
      const els = s.designRef.deviceFrame && dna.deviceFrames?.[s.designRef.deviceFrame]
        ? dna.deviceFrames[s.designRef.deviceFrame].elements
        : dna.elements;
      if (!els) continue;
      for (const el of els) {
        const bg = el.styles?.visual?.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && !seenColors.has(bg)) {
          seenColors.add(bg);
          cssRules.push(`  --dna-bg-${seenColors.size}: ${bg};`);
        }
        const color = el.styles?.typography?.color;
        if (color && color.startsWith("rgb") && !seenColors.has(color)) {
          seenColors.add(color);
          cssRules.push(`  --dna-text-${seenColors.size}: ${color};`);
        }
        const font = el.styles?.typography?.fontFamily;
        if (font && !seenColors.has(`font:${font}`)) {
          seenColors.add(`font:${font}`);
          cssRules.push(`  --dna-font: ${font}, sans-serif;`);
        }
      }
    }
    if (cssRules.length === 0) return "";
    return `:root {\n${cssRules.join("\n")}\n}\nsection { font-family: var(--dna-font, 'Noto Sans JP', sans-serif); }`;
  }, [sections, dnaLibrary]);

  // プレビュー srcDoc — 全セクションの状態に応じて構築
  const previewSrcDoc = useMemo(() => {
    const partsHtml = sections
      .map((s, i) => {
        if (s.status === "done" && s.html) {
          const isCurrent = i === currentIndex;
          if (isCurrent) {
            return `<div style="outline:2px dashed #7c3aed;outline-offset:-2px;position:relative;">
              <div style="position:absolute;top:0;right:0;background:#7c3aed;color:#fff;font-size:11px;padding:2px 8px;border-radius:0 0 0 6px;z-index:10;">
                ${s.label || ""}
              </div>
              ${s.html}
            </div>`;
          }
          return s.html;
        }
        if (s.status === "generating") {
          return `<div style="min-height:150px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f3e8ff,#ede9fe);border:2px dashed #7c3aed;border-radius:12px;margin:16px;">
            <p style="color:#7c3aed;font-size:14px;font-weight:600;">${s.label} — 生成中...</p>
          </div>`;
        }
        return `<div style="min-height:100px;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px dashed #ddd;border-radius:8px;margin:16px;">
          <p style="color:#bbb;font-size:13px;">${s.label}</p>
        </div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html><head>
  <base href="/" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>* { box-sizing: border-box; } body { margin: 0; } img { max-width: 100%; height: auto; }${dnaCssBlock ? `\n${dnaCssBlock}` : ""}</style>
</head><body>
${partsHtml}
</body></html>`;
  }, [sections, currentIndex]);

  // セクション生成（並列対応）
  async function generateSection(idx) {
    // ref から最新のセクションデータを取得
    const section = sectionsRef.current[idx];
    if (!section) return;

    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, status: "generating" } : s))
    );
    setGeneratingSet((prev) => new Set([...prev, idx]));
    setError("");

    try {

      let sectionHtml = "";
      let sectionCode = "";

      const cloneContent = section.referenceConfig?.cloneContent || "keep";

      if (section.mode === "clone" && section.designRef?.dnaId && cloneContent === "keep") {
        // 完全再現 (そのまま): マスター画像でプレビューHTML生成 (API不要)
        const dna = dnaLibrary.find((d) => d.id === section.designRef.dnaId);
        if (!dna) throw new Error("ソースデザインが見つかりません");

        // マスター画像を取得
        let masterImg = null;
        let rootElements = null;
        if (section.designRef.deviceFrame && dna.deviceFrames?.[section.designRef.deviceFrame]) {
          masterImg = dna.deviceFrames[section.designRef.deviceFrame].masterImage;
          rootElements = dna.deviceFrames[section.designRef.deviceFrame].elements;
        } else {
          masterImg = dna.masterImage;
          rootElements = dna.elements;
        }

        if (masterImg?.filename) {
          const rootBB = rootElements?.[0]?.boundingBox || {
            x: 0, y: 0, width: masterImg.width || 1440, height: masterImg.height || 900,
          };
          const elIndices = section.designRef.elementIndices;
          const sourceEls = getSourceElements(section) || [];

          if (elIndices && elIndices.length > 0 && sourceEls.length > 0) {
            // 選択要素のバウンディングボックスからクロップ範囲を計算
            let minY = Infinity, maxY = -Infinity;
            for (const el of sourceEls) {
              if (el.boundingBox) {
                minY = Math.min(minY, el.boundingBox.y);
                maxY = Math.max(maxY, el.boundingBox.y + el.boundingBox.height);
              }
            }
            if (minY === Infinity) { minY = rootBB.y; maxY = rootBB.y + rootBB.height; }
            const relY = minY - rootBB.y;
            const cropH = maxY - minY;
            const translateYPct = rootBB.height > 0 ? -(relY / rootBB.height) * 100 : 0;
            const paddingPct = rootBB.width > 0 ? (cropH / rootBB.width) * 100 : 10;

            sectionHtml = `<div style="width:100%;position:relative;overflow:hidden;padding-bottom:${paddingPct.toFixed(2)}%;">
              <img src="/api/images/${masterImg.filename}" alt="${section.label}"
                   style="position:absolute;top:0;left:0;width:100%;display:block;transform:translateY(${translateYPct.toFixed(2)}%);" />
            </div>`;
          } else {
            // 全要素 → フル画像表示
            sectionHtml = `<div style="width:100%;"><img src="/api/images/${masterImg.filename}" alt="${section.label}" style="width:100%;display:block;" /></div>`;
          }
          sectionCode = sectionHtml;
        } else {
          // マスター画像なし → サーバーAPI フォールバック
          const sourceElements = getSourceElements(section);
          if (!sourceElements) throw new Error("ソースデザインが見つかりません");
          const res = await fetch("/api/export/generate-section", {
            method: "POST",
            headers,
            body: JSON.stringify({
              dnaElements: sourceElements,
              pageTitle: pageName,
              sectionLabel: section.label,
              sectionIndex: idx,
              totalSections: sections.length,
              partConfig: { mode: "clone", role: section.role, sourceElements },
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          sectionHtml = data.sectionHtml;
          sectionCode = data.sectionCode;
        }
      } else if (
        (section.mode === "clone" && section.designRef?.dnaId && cloneContent === "replace") ||
        (section.mode === "reference" && section.designRef?.dnaId)
      ) {
        // デザイン参考 / 完全再現(入れ替え): AI API を使用
        const sourceElements = getSourceElements(section);
        if (!sourceElements) throw new Error("ソースデザインが見つかりません");

        // clone+replace の場合は全属性を強制継承
        const refConfig = cloneContent === "replace"
          ? { ...section.referenceConfig, inheritColors: true, inheritFonts: true, inheritLayout: true }
          : (section.referenceConfig || {});

        const res = await fetch("/api/compose/generate-section-composed", {
          method: "POST",
          headers,
          body: JSON.stringify({
            sourceElements,
            referenceConfig: refConfig,
            sectionLabel: section.label,
            sectionIndex: idx,
            totalSections: sections.length,
            previousSectionsHtml,
            pageName,
            imageMode,
            model: aiModel,
            apiKey,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        sectionHtml = data.sectionHtml;
        sectionCode = data.sectionCode;
      } else {
        // 参照なし: 既存 API をラベルのみで使用
        const res = await fetch("/api/export/generate-section", {
          method: "POST",
          headers,
          body: JSON.stringify({
            dnaElements: [{ tagName: "section", styles: {}, textContent: "", children: [] }],
            pageTitle: pageName,
            sectionLabel: section.label,
            sectionIndex: idx,
            totalSections: sections.length,
            previousSectionsHtml,
            contentMode: section.referenceConfig?.contentMode || "ai",
            manualContent: section.referenceConfig?.manualContent || "",
            customInstructions: section.referenceConfig?.customInstructions || "",
            fontMode: "google",
            model: aiModel,
            apiKey,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        sectionHtml = data.sectionHtml;
        sectionCode = data.sectionCode;
      }

      setSections((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: "done", html: sectionHtml, code: sectionCode } : s
        )
      );
    } catch (err) {
      setError(err.message);
      setSections((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, status: "pending" } : s))
      );
    } finally {
      setGeneratingSet((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  // 全ての非自動生成 pending セクションを並列生成
  function generateAllPending() {
    const pendingIndices = sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status === "pending" && !isAutoClone(s))
      .map(({ i }) => i);
    pendingIndices.forEach((idx) => generateSection(idx));
  }

  // 承認して次へ
  function approveAndNext() {
    // まず pending のセクションを探す
    const nextPending = sections.findIndex((s, i) => i > currentIndex && s.status === "pending");
    if (nextPending !== -1) {
      setCurrentIndex(nextPending);
      return;
    }
    // pending がなければ次のセクションへ（done/skipped 含む）
    if (currentIndex < sections.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  // 再生成（部分リテイク）
  function regenerate(idx) {
    const targetIdx = idx !== undefined ? idx : currentIndex;
    setSections((prev) =>
      prev.map((s, i) => (i === targetIdx ? { ...s, status: "pending", html: "", code: "" } : s))
    );
    setCurrentIndex(targetIdx);
    setError("");
  }

  // スキップ
  function skip() {
    setSections((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: "skipped" } : s))
    );
    const nextPending = sections.findIndex((s, i) => i > currentIndex && s.status === "pending");
    if (nextPending !== -1) setCurrentIndex(nextPending);
  }

  // 全体結合して次へ
  function handleAssemble() {
    const assembled = sections
      .filter((s) => s.status === "done")
      .map((s) => s.html)
      .join("\n");
    onComplete(sections, assembled);
  }

  return (
    <div className="flex gap-4" style={{ height: "70vh" }}>
      {/* ── プレビューエリア ── */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm overflow-hidden">
        {approvedCount > 0 || generating ? (
          <>
            {/* プレビューヘッダー */}
            <div className="px-4 py-2.5 border-b border-[#E8D5B0]/30 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#7c3aed]/5 to-[#a259ff]/5">
              <div className="flex items-center gap-3">
                <h3 className="text-[14px] font-bold text-[#5A4E3A]">ページプレビュー</h3>
                <div className="flex items-center gap-1">
                  {sections.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
                        i === currentIndex
                          ? "bg-[#7c3aed] text-white scale-110"
                          : s.status === "done"
                          ? "bg-green-500 text-white"
                          : s.status === "skipped"
                          ? "bg-gray-300 text-white"
                          : "bg-[#E8D5B0]/50 text-[#8A7E6B]"
                      }`}
                      title={s.label}
                    >
                      {s.status === "done" ? "✓" : i + 1}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[#8A7E6B]">
                  {approvedCount}/{sections.length} 完了
                </span>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-[#E8D5B0]/50">
                {["pc", "sp"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPreviewDevice(d)}
                    className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                      previewDevice === d
                        ? "bg-[#7c3aed] text-white"
                        : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                    }`}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* プレビュー iframe */}
            <div className="flex-1 min-h-0 flex justify-center overflow-auto bg-gray-100/50 p-3">
              <div
                className="h-full rounded-xl overflow-hidden border border-[#E8D5B0]/50 bg-white transition-all duration-300"
                style={{ width: previewDevice === "sp" ? 375 : "100%", flexShrink: 0 }}
              >
                <iframe
                  srcDoc={previewSrcDoc}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="Composition Preview"
                />
              </div>
            </div>
          </>
        ) : (
          /* プレースホルダー */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <svg
              className="w-16 h-16 text-[#E8D5B0] mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <h4 className="text-[14px] font-bold text-[#8A7E6B] mb-1">
              ページプレビュー
            </h4>
            <p className="text-[12px] text-[#C49A6C] leading-relaxed max-w-xs">
              セクションを生成すると、ここにライブプレビューが表示されます。
              右のパネルから生成を開始してください。
            </p>
          </div>
        )}
      </div>

      {/* ── 右パネル: セクション制御 ── */}
      <div className="w-[300px] flex-shrink-0 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* 現在のセクション情報 */}
          <div className="p-4 rounded-xl bg-[#7c3aed]/5 border border-[#7c3aed]/20">
            <p className="text-[14px] text-[#7c3aed] font-semibold mb-1.5">
              現在のセクション ({currentIndex + 1}/{sections.length})
            </p>
            <p className="text-[16px] font-bold text-[#5A4E3A] leading-snug">{current?.label || "—"}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-[12px] font-bold px-2 py-1 rounded"
                style={{
                  backgroundColor: `${getRoleColor(current?.role)}20`,
                  color: getRoleColor(current?.role),
                }}
              >
                {current?.role}
              </span>
              <span className="text-[12px] text-[#8A7E6B]">
                {current?.mode === "clone"
                  ? (current?.referenceConfig?.cloneContent || "keep") === "replace"
                    ? "完全再現（入替）"
                    : "完全再現"
                  : current?.mode === "reference"
                  ? "デザイン参考"
                  : "参照なし"}
              </span>
            </div>
            <p className="text-[14px] text-[#8A7E6B] mt-2">
              ステータス:{" "}
              <span className="font-semibold">
              {current?.status === "done"
                ? "完了"
                : current?.status === "generating"
                ? "生成中..."
                : current?.status === "skipped"
                ? "スキップ"
                : "未生成"}
              </span>
            </p>
          </div>

          {/* 全セクションリスト */}
          <div>
            <p className="text-[14px] font-semibold text-[#8A7E6B] mb-2">全セクション</p>
            <div className="space-y-1.5">
              {sections.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentIndex(i)}
                    className={`flex-1 text-left p-2.5 rounded-lg text-[14px] transition-all ${
                      i === currentIndex
                        ? "bg-[#7c3aed]/10 border border-[#7c3aed]/30"
                        : "hover:bg-[#f5f0e8] border border-transparent"
                    }`}
                  >
                    <span
                      className={`inline-block w-5 text-center mr-1.5 ${
                        s.status === "done"
                          ? "text-green-600"
                          : s.status === "skipped"
                          ? "text-gray-400"
                          : "text-[#C49A6C]"
                      }`}
                    >
                      {s.status === "done" ? "✓" : s.status === "skipped" ? "−" : "○"}
                    </span>
                    {s.label}
                  </button>
                  {/* 部分リテイクボタン */}
                  {s.status === "done" && !isAutoClone(s) && (
                    <button
                      onClick={() => regenerate(i)}
                      disabled={generatingSet.has(i)}
                      className="text-[10px] text-[#7c3aed] hover:text-[#5b21b6] font-semibold disabled:opacity-30"
                      title="再生成"
                    >
                      ↻
                    </button>
                  )}
                  {/* 生成中インジケーター */}
                  {s.status === "generating" && (
                    <span className="text-[10px] text-[#7c3aed] animate-pulse">...</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* エラー */}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200/60">
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* アクション */}
        <div className="p-4 border-t border-[#E8D5B0]/30 space-y-2">
          {isAutoClone(current) && current?.status !== "done" && (
            <div className="text-center text-[12px] text-[#8A7E6B] py-2">
              {generatingSet.has(currentIndex) ? "再現パーツを生成中..." : "自動生成されます"}
            </div>
          )}

          {current?.status === "pending" && !isAutoClone(current) && (
            <>
              <button
                onClick={() => generateSection(currentIndex)}
                disabled={generatingSet.has(currentIndex)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-95"
              >
                {generatingSet.has(currentIndex) ? "生成中..." : `「${current.label}」を生成`}
              </button>
              <p className="text-[10px] text-[#C49A6C] text-center leading-relaxed">
                生成時に AI API のクレジットが消費されます
              </p>
            </>
          )}

          {current?.status === "generating" && !isAutoClone(current) && (
            <div className="text-center text-[12px] text-[#7c3aed] py-2 animate-pulse">
              生成中...
            </div>
          )}

          {current?.status === "done" && !isAutoClone(current) && (
            <>
              <button
                onClick={approveAndNext}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                OK（次のセクションへ）
              </button>
              <button
                onClick={() => regenerate()}
                disabled={generatingSet.has(currentIndex)}
                className="w-full py-2 rounded-xl border border-[#7c3aed]/40 text-[#7c3aed] text-[13px] font-semibold hover:bg-[#7c3aed]/5 transition-all active:scale-95"
              >
                再生成
              </button>
            </>
          )}

          {/* 全セクション一括生成 */}
          {sections.some((s) => s.status === "pending" && !isAutoClone(s)) && (
            <>
              <button
                onClick={generateAllPending}
                disabled={generating}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-95"
              >
                {generating ? `${generatingSet.size} 件生成中...` : "全セクションを一括生成"}
              </button>
              <p className="text-[10px] text-[#C49A6C] text-center leading-relaxed">
                全セクション分の AI API クレジットが消費されます
              </p>
            </>
          )}

          {current?.status !== "done" &&
            current?.status !== "generating" &&
            !isAutoClone(current) && (
              <button
                onClick={skip}
                className="w-full py-2 rounded-xl border border-[#E8D5B0]/50 text-[#8A7E6B] text-[12px] hover:bg-[#f5f0e8] transition-all"
              >
                スキップ
              </button>
            )}

          {allDone && approvedCount > 0 && (
            <button
              onClick={handleAssemble}
              disabled={generating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[14px] font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 active:scale-95"
            >
              最終最適化へ →
            </button>
          )}

          <button
            onClick={onBack}
            className="w-full py-2 rounded-xl border border-[#D4A76A]/30 bg-white/50 text-[#8A7E6B] text-[12px] font-semibold hover:bg-white/80 transition-all"
          >
            ← 戻る
          </button>
        </div>
      </div>
    </div>
  );
}
