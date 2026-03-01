import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * セクション別レビューモーダル
 * セクションを1つずつAI生成し、承認/再生成を繰り返すフロー
 */
export default function SectionReviewModal({
  open,
  sections: initialSections,
  lockedHeaderHtml,
  lockedFooterHtml,
  dnaElements,
  pageTitle,
  contentMode,
  manualContent,
  customInstructions,
  fontMode,
  accentColor,
  model,
  apiKey,
  oasisColorConfig,
  fontFamilyConfig,
  googleFontsUrl,
  token,
  onComplete,
  onClose,
}) {
  const [sections, setSections] = useState(
    initialSections.map((s) => ({ ...s, status: "pending", html: "", code: "" }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewDevice, setPreviewDevice] = useState("pc");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const current = sections[currentIndex];
  const approvedCount = sections.filter((s) => s.status === "done").length;
  const allDone = sections.every((s) => s.status === "done" || s.status === "skipped");
  const autoGenRef = useRef(false);

  // Clone/shell セクションは自動生成 + 自動承認
  useEffect(() => {
    if (!current || generating || autoGenRef.current) return;
    if (current.partConfig?.mode === "clone" && current.status === "pending") {
      autoGenRef.current = true;
      (async () => {
        await generateCurrentSectionInner();
        // 自動承認: 次のセクションへ
        setTimeout(() => {
          autoGenRef.current = false;
          setSections((prev) => {
            const nextPending = prev.findIndex((s, i) => i > currentIndex && s.status === "pending");
            if (nextPending !== -1) setCurrentIndex(nextPending);
            return prev;
          });
        }, 200);
      })();
    }
  }, [currentIndex, current?.status]);

  // 承認済みセクションのHTML（前セクションコンテキスト用）
  const previousSectionsHtml = useMemo(() => {
    return sections
      .filter((s, i) => i < currentIndex && s.status === "done")
      .map((s) => s.html)
      .join("\n");
  }, [sections, currentIndex]);

  // プレビュー用 srcDoc
  const previewSrcDoc = useMemo(() => {
    const colorJson = JSON.stringify(oasisColorConfig || {}).replace(/<\//g, "<\\/");
    const fontJson = JSON.stringify(fontFamilyConfig || {}).replace(/<\//g, "<\\/");
    const fontsUrl = googleFontsUrl || "";

    const approvedHtml = sections
      .filter((s) => s.status === "done")
      .map((s) => s.html)
      .join("\n");

    const currentHtml = current?.status === "done" || current?.html
      ? `<div style="outline:2px dashed #7c3aed;outline-offset:-2px;position:relative;">
          <div style="position:absolute;top:0;right:0;background:#7c3aed;color:#fff;font-size:11px;padding:2px 8px;border-radius:0 0 0 6px;z-index:10;">
            ${current?.label || ""}
          </div>
          ${current?.html || ""}
        </div>`
      : `<div style="min-height:200px;display:flex;align-items:center;justify-content:center;background:#f5f0e8;border:2px dashed #C49A6C;border-radius:12px;margin:16px;">
          <p style="color:#8A7E6B;font-size:14px;">${current?.label || "セクション"} — 生成待ち</p>
        </div>`;

    // 未生成セクションのプレースホルダー
    const remainingHtml = sections
      .filter((s, i) => i > currentIndex && s.status === "pending")
      .map((s) => `<div style="min-height:100px;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px dashed #ddd;border-radius:8px;margin:16px;">
        <p style="color:#bbb;font-size:13px;">${s.label}</p>
      </div>`)
      .join("\n");

    return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="${fontsUrl}" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwindcss.config = {
      theme: { extend: {
        fontFamily: ${fontJson},
        colors: ${colorJson},
      }},
    };
  <\/script>
  <style>* { box-sizing: border-box; } body { margin: 0; }</style>
</head><body>
${approvedHtml}
${currentHtml}
${remainingHtml}
</body></html>`;
  }, [sections, currentIndex, oasisColorConfig, fontFamilyConfig, googleFontsUrl]);

  // セクション生成（内部実装）
  async function generateCurrentSectionInner() {
    if (!current) return;
    setGenerating(true);
    setError("");

    // ステータスを generating に更新
    setSections((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: "generating" } : s))
    );

    try {
      const body = {
        dnaElements,
        pageTitle,
        sectionLabel: current.label,
        sectionIndex: currentIndex,
        totalSections: sections.length,
        previousSectionsHtml,
        contentMode,
        manualContent,
        customInstructions,
        fontMode,
        accentColor,
        model,
        apiKey,
      };
      // 完全再現モード: partConfig を渡す
      if (current.partConfig) {
        body.partConfig = current.partConfig;
      }

      const res = await fetch("/api/export/generate-section", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSections((prev) =>
        prev.map((s, i) =>
          i === currentIndex
            ? { ...s, status: "done", html: data.sectionHtml, code: data.sectionCode }
            : s
        )
      );
    } catch (err) {
      setError(err.message);
      setSections((prev) =>
        prev.map((s, i) => (i === currentIndex ? { ...s, status: "pending" } : s))
      );
    } finally {
      setGenerating(false);
    }
  }

  // セクション生成（UI ボタン用）
  function generateCurrentSection() {
    generateCurrentSectionInner();
  }

  // 承認して次へ
  function approveAndNext() {
    const nextPending = sections.findIndex((s, i) => i > currentIndex && s.status === "pending");
    if (nextPending !== -1) {
      setCurrentIndex(nextPending);
    }
  }

  // 再生成
  function regenerate() {
    setSections((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: "pending", html: "", code: "" } : s))
    );
    setError("");
  }

  // スキップ
  function skip() {
    setSections((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: "skipped" } : s))
    );
    const nextPending = sections.findIndex((s, i) => i > currentIndex && s.status === "pending");
    if (nextPending !== -1) {
      setCurrentIndex(nextPending);
    }
  }

  // ページ組み立て
  async function assemblePage() {
    setGenerating(true);
    setError("");
    try {
      const approved = sections
        .filter((s) => s.status === "done")
        .map((s) => ({ html: s.html, code: s.code }));

      const res = await fetch("/api/export/assemble-page", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lockedHeaderHtml,
          lockedFooterHtml,
          approvedSections: approved,
          pageTitle,
          dnaElements,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      onComplete({
        previewHtml: data.previewHtml,
        componentCode: data.componentCode,
        cacheId: data.cacheId,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={() => !generating && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-5xl flex flex-col overflow-hidden"
          style={{ height: "90vh" }}
        >
          {/* Header */}
          <div className="px-6 py-3 border-b border-[#E8D5B0]/50 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#7c3aed]/5 to-[#a259ff]/5">
            <div className="flex items-center gap-4">
              <h2 className="text-[15px] font-bold text-[#5A4E3A]">
                セクション別生成
              </h2>
              <div className="flex items-center gap-1">
                {sections.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-7 h-7 rounded-full text-[11px] font-bold transition-all ${
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
              <span className="text-[12px] text-[#8A7E6B]">
                {approvedCount}/{sections.length} 承認済み
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* SP/PC toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[#E8D5B0]/50">
                <button
                  onClick={() => setPreviewDevice("pc")}
                  className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                    previewDevice === "pc" ? "bg-[#7c3aed] text-white" : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                  }`}
                >
                  PC
                </button>
                <button
                  onClick={() => setPreviewDevice("sp")}
                  className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                    previewDevice === "sp" ? "bg-[#7c3aed] text-white" : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                  }`}
                >
                  SP
                </button>
              </div>
              <button
                onClick={() => !generating && onClose()}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] text-lg"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex">
            {/* Preview */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0 m-3 flex justify-center overflow-auto bg-gray-100/50 rounded-xl">
                <div
                  className="h-full rounded-xl overflow-hidden border border-[#E8D5B0]/50 bg-white transition-all duration-300"
                  style={{ width: previewDevice === "sp" ? 375 : "100%", flexShrink: 0 }}
                >
                  <iframe
                    srcDoc={previewSrcDoc}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                    title="Section Preview"
                  />
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="w-[260px] flex-shrink-0 border-l border-[#E8D5B0]/30 p-4 flex flex-col gap-3 overflow-y-auto">
              {/* Current section info */}
              <div className="p-3 rounded-xl bg-[#7c3aed]/5 border border-[#7c3aed]/20">
                <p className="text-[11px] text-[#7c3aed] font-semibold mb-1">
                  現在のセクション ({currentIndex + 1}/{sections.length})
                </p>
                <p className="text-[15px] font-bold text-[#5A4E3A]">
                  {current?.label || "—"}
                </p>
                {current?.partConfig?.mode === "clone" && (
                  <p className={`text-[11px] mt-1 ${current.isShell ? "text-[#3b82f6]" : "text-[#f59e0b]"}`}>
                    {current.isShell ? "固定パーツ（自動生成）" : "完全再現（自動生成）"}
                  </p>
                )}
                <p className="text-[12px] text-[#8A7E6B] mt-1">
                  ステータス: {
                    current?.status === "done" ? "承認済み"
                    : current?.status === "generating" ? "生成中..."
                    : current?.status === "skipped" ? "スキップ"
                    : "未生成"
                  }
                </p>
              </div>

              {/* Section list */}
              <div>
                <p className="text-[12px] font-semibold text-[#8A7E6B] mb-1.5">全セクション</p>
                <div className="space-y-1">
                  {sections.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-full text-left p-2 rounded-lg text-[12px] transition-all ${
                        i === currentIndex
                          ? "bg-[#7c3aed]/10 border border-[#7c3aed]/30"
                          : "hover:bg-[#f5f0e8] border border-transparent"
                      }`}
                    >
                      <span className={`inline-block w-4 text-center mr-1 ${
                        s.status === "done" ? "text-green-600" : s.status === "skipped" ? "text-gray-400" : "text-[#C49A6C]"
                      }`}>
                        {s.status === "done" ? "✓" : s.status === "skipped" ? "−" : "○"}
                      </span>
                      {s.partConfig?.mode === "clone" && (
                        <span className={`text-[9px] px-1 py-0.5 rounded mr-1 ${
                          s.isShell ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "bg-[#f59e0b]/10 text-[#f59e0b]"
                        }`}>
                          {s.isShell ? "固定" : "再現"}
                        </span>
                      )}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200/60">
                  <p className="text-[12px] text-red-600">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto space-y-2">
                {current?.partConfig?.mode === "clone" && current?.status !== "done" && (
                  <div className="text-center text-[12px] text-[#8A7E6B] py-2">
                    {generating ? "再現パーツを生成中..." : "自動生成されます"}
                  </div>
                )}

                {current?.status === "pending" && !current?.partConfig?.mode?.startsWith("clone") && (
                  <button
                    onClick={generateCurrentSection}
                    disabled={generating}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-95"
                  >
                    {generating ? "生成中..." : `「${current.label}」を生成`}
                  </button>
                )}

                {current?.status === "done" && !current?.partConfig?.mode?.startsWith("clone") && (
                  <>
                    <button
                      onClick={approveAndNext}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                      OK（次のセクションへ）
                    </button>
                    <button
                      onClick={regenerate}
                      disabled={generating}
                      className="w-full py-2 rounded-xl border border-[#7c3aed]/40 text-[#7c3aed] text-[13px] font-semibold hover:bg-[#7c3aed]/5 transition-all active:scale-95"
                    >
                      再生成
                    </button>
                  </>
                )}

                {current?.status !== "done" && current?.status !== "generating" && !current?.partConfig?.mode?.startsWith("clone") && (
                  <button
                    onClick={skip}
                    className="w-full py-2 rounded-xl border border-[#E8D5B0]/50 text-[#8A7E6B] text-[12px] hover:bg-[#f5f0e8] transition-all"
                  >
                    スキップ
                  </button>
                )}

                {allDone && approvedCount > 0 && (
                  <button
                    onClick={assemblePage}
                    disabled={generating}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[14px] font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 active:scale-95"
                  >
                    {generating ? "組み立て中..." : "ページを組み立て"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
