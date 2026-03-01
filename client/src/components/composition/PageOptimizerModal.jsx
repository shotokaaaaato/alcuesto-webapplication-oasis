import { useState, useMemo } from "react";
import { motion } from "framer-motion";

export default function PageOptimizerModal({
  assembledHtml,
  pageName,
  aiModel,
  apiKey,
  headers,
  onComplete,
  onBack,
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedHtml, setOptimizedHtml] = useState("");
  const [changes, setChanges] = useState([]);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("before"); // "before" | "after"
  const [previewDevice, setPreviewDevice] = useState("pc");
  const [copying, setCopying] = useState(false);

  const isOptimized = optimizedHtml.length > 0;
  const displayHtml = viewMode === "after" && isOptimized ? optimizedHtml : assembledHtml;

  // srcDoc 生成
  const previewSrcDoc = useMemo(() => {
    return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>* { box-sizing: border-box; } body { margin: 0; }</style>
</head><body>
${displayHtml}
</body></html>`;
  }, [displayHtml]);

  // AI 最適化実行
  const handleOptimize = async () => {
    setOptimizing(true);
    setError("");
    try {
      const res = await fetch("/api/compose/optimize-page", {
        method: "POST",
        headers,
        body: JSON.stringify({
          assembledHtml,
          pageName,
          model: aiModel,
          apiKey,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setOptimizedHtml(data.optimizedHtml || assembledHtml);
        setChanges(data.changes || []);
        setViewMode("after");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  // コードコピー
  const handleCopyCode = async () => {
    const html = isOptimized ? optimizedHtml : assembledHtml;
    try {
      await navigator.clipboard.writeText(html);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  // 完了して保存
  const handleFinish = () => {
    const finalHtml = isOptimized ? optimizedHtml : assembledHtml;
    onComplete(finalHtml, finalHtml);
  };

  return (
    <div className="flex gap-4" style={{ height: "70vh" }}>
      {/* ── プレビューエリア ── */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-2.5 border-b border-[#E8D5B0]/30 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#f59e0b]/5 to-[#d97706]/5">
          <div className="flex items-center gap-3">
            <h3 className="text-[14px] font-bold text-[#5A4E3A]">最終最適化</h3>
            {isOptimized && (
              <div className="flex rounded-lg overflow-hidden border border-[#E8D5B0]/50">
                <button
                  onClick={() => setViewMode("before")}
                  className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === "before"
                      ? "bg-[#f59e0b] text-white"
                      : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                  }`}
                >
                  Before
                </button>
                <button
                  onClick={() => setViewMode("after")}
                  className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === "after"
                      ? "bg-[#f59e0b] text-white"
                      : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                  }`}
                >
                  After
                </button>
              </div>
            )}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-[#E8D5B0]/50">
            {["pc", "sp"].map((d) => (
              <button
                key={d}
                onClick={() => setPreviewDevice(d)}
                className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                  previewDevice === d
                    ? "bg-[#f59e0b] text-white"
                    : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                }`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* プレビュー */}
        <div className="flex-1 min-h-0 flex justify-center overflow-auto bg-gray-100/50 p-3">
          <div
            className="h-full rounded-xl overflow-hidden border border-[#E8D5B0]/50 bg-white transition-all duration-300"
            style={{ width: previewDevice === "sp" ? 375 : "100%", flexShrink: 0 }}
          >
            <iframe
              srcDoc={previewSrcDoc}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Final Preview"
            />
          </div>
        </div>
      </div>

      {/* ── 右パネル ── */}
      <div className="w-[280px] flex-shrink-0 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* 概要 */}
          <div className="p-3 rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/20">
            <h4 className="text-[13px] font-bold text-[#5A4E3A] mb-1">「{pageName}」</h4>
            <p className="text-[12px] text-[#8A7E6B]">
              全セクションの生成が完了しました。
              AI による余白・境界の微調整を実行できます。
            </p>
          </div>

          {/* 最適化ボタン */}
          {!isOptimized && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOptimize}
              disabled={optimizing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {optimizing ? "最適化中..." : "AI で全体を最適化"}
            </motion.button>
          )}

          {/* 変更点 */}
          {isOptimized && changes.length > 0 && (
            <div className="p-3 rounded-xl bg-green-50/80 border border-green-200/50">
              <p className="text-[12px] font-semibold text-green-700 mb-1.5">最適化の変更点:</p>
              <ul className="space-y-1">
                {changes.map((c, i) => (
                  <li key={i} className="text-[11px] text-green-600 flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 最適化済みの場合のアクション */}
          {isOptimized && (
            <button
              onClick={() => {
                setOptimizedHtml("");
                setChanges([]);
                setViewMode("before");
              }}
              className="w-full py-2 rounded-xl border border-[#E8D5B0]/50 text-[#8A7E6B] text-[12px] hover:bg-[#f5f0e8] transition-all"
            >
              最適化を取り消し
            </button>
          )}

          {/* エラー */}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200/60">
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          {/* 注意書き */}
          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/40">
            <p className="text-[11px] text-amber-700 leading-relaxed">
              最適化はセクション間の余白バランスと境界のみを微調整します。
              コンテンツや構造は変更されません。
              最適化はスキップしてそのまま保存することも可能です。
            </p>
          </div>
        </div>

        {/* フッターアクション */}
        <div className="p-4 border-t border-[#E8D5B0]/30 space-y-2">
          <button
            onClick={handleCopyCode}
            className="w-full py-2 rounded-xl border border-[#D4A76A]/40 text-[#8B6914] text-[12px] font-semibold hover:bg-[#D4A76A]/10 transition-all"
          >
            {copying ? "コピーしました!" : "HTML をコピー"}
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleFinish}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white text-[14px] font-bold shadow-lg hover:shadow-xl transition-all"
          >
            保存して完了
          </motion.button>

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
