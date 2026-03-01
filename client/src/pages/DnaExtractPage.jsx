import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import FigmaTokenInput from "../components/FigmaTokenInput";

const TEMPLATE_CATEGORIES = [
  { value: "header", label: "Header" },
  { value: "fv", label: "FV" },
  { value: "section", label: "Section" },
  { value: "footer", label: "Footer" },
  { value: "nav", label: "Nav" },
  { value: "card", label: "Card" },
  { value: "cta", label: "CTA" },
  { value: "other", label: "Other" },
];

export default function DnaExtractPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Tab: "figma" (default for all) | "url" (admin only)
  const [activeTab, setActiveTab] = useState("figma");

  // Figma extraction state
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [figmaStructure, setFigmaStructure] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);

  // URL extraction state (admin only)
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [mode, setMode] = useState("page");
  const [consent, setConsent] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);

  // Shared state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [library, setLibrary] = useState([]);

  // Preview state (outerHTML direct display, no AI needed)
  const [previewWidth, setPreviewWidth] = useState("pc");
  const [lastSavedDnaId, setLastSavedDnaId] = useState(null);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTargetIdx, setSaveTargetIdx] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateCategory, setTemplateCategory] = useState("other");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");

  // Toast state
  const [toast, setToast] = useState(null);

  // Delete history
  const [deletingId, setDeletingId] = useState(null);

  // Figma URL → fileKey 自動抽出
  useEffect(() => {
    const match = figmaUrl.match(
      /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/
    );
    if (match) {
      setFileKey(match[1]);
    }
  }, [figmaUrl]);

  // デザインライブラリ読み込み
  useEffect(() => {
    async function loadLibrary() {
      try {
        const res = await fetch("/api/dna/library", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setLibrary((data.data || []).slice(-5).reverse());
      } catch {
        // silent
      }
    }
    if (token) loadLibrary();
  }, [token]);

  // Figma ファイル構造取得
  async function handleFetchStructure(e) {
    e.preventDefault();
    if (!figmaToken || !fileKey) return;

    setStructureLoading(true);
    setError("");
    setFigmaStructure(null);
    setSelectedNodeIds([]);

    try {
      const res = await fetch("/api/dna/figma-structure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accessToken: figmaToken, fileKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFigmaStructure(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setStructureLoading(false);
    }
  }

  // Figma デザイン抽出実行
  async function handleFigmaExtract() {
    if (!figmaToken || !fileKey) return;

    setFigmaLoading(true);
    setError("");
    setSuccess("");
    setResults([]);
    setSelectedIdx(null);
    // preview cache cleared on new extraction

    try {
      const body = { accessToken: figmaToken, fileKey };
      if (selectedNodeIds.length > 0) {
        body.nodeIds = selectedNodeIds;
      }

      const res = await fetch("/api/dna/extract-figma", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const data = Array.isArray(json.data) ? json.data : [json.data];
      setResults(data);
      setLastSavedDnaId(json.savedId || null);
      setSuccess(
        `${data.length} 要素を抽出しました — ${json.fileName || fileKey} (ID: ${json.savedId?.slice(0, 8)}...)`
      );
      reloadLibrary();
    } catch (err) {
      setError(err.message);
    } finally {
      setFigmaLoading(false);
    }
  }

  // URL デザイン抽出実行 (admin only)
  async function handleUrlExtract(e) {
    e.preventDefault();
    if (!url || !consent) return;

    setUrlLoading(true);
    setError("");
    setSuccess("");
    setResults([]);
    setSelectedIdx(null);
    // preview cache cleared on new extraction

    try {
      const endpoint =
        mode === "page" ? "/api/dna/extract-page" : "/api/dna/extract";
      const body =
        mode === "page"
          ? { url }
          : { url, selector: selector || "body", depth: 2 };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const data = Array.isArray(json.data) ? json.data : [json.data];
      setResults(data);
      setLastSavedDnaId(json.savedId || null);
      setSuccess(
        `${data.length} 要素を抽出しました (ID: ${json.savedId?.slice(0, 8)}...)`
      );
      reloadLibrary();
    } catch (err) {
      setError(err.message);
    } finally {
      setUrlLoading(false);
    }
  }

  async function reloadLibrary() {
    if (!token) return;
    try {
      const libRes = await fetch("/api/dna/library", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (libRes.ok) {
        const libData = await libRes.json();
        setLibrary((libData.data || []).slice(-5).reverse());
      }
    } catch {
      // silent
    }
  }

  async function handleDeleteDna(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/dna/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setLibrary((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(`削除に失敗: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleNodeId(nodeId) {
    setSelectedNodeIds((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  }

  // Preview toggle (outerHTML direct display — no API call)
  function handleTogglePreview(idx) {
    setSelectedIdx(selectedIdx === idx ? null : idx);
  }

  // Save as template: 1) AI refactor via DeepSeek → 2) register as template
  async function handleSaveTemplate() {
    if (!templateName.trim() || saveTargetIdx === null) return;

    const element = results[saveTargetIdx];
    if (!element) return;

    setSaveLoading(true);
    setSaveProgress("AI でコードを生成中...");
    setError("");

    try {
      // Step 1: AI refactor (DeepSeek)
      const refactorRes = await fetch("/api/export/refactor-elements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          elements: [element],
          dnaId: lastSavedDnaId || undefined,
        }),
      });

      if (!refactorRes.ok) {
        const err = await refactorRes.json().catch(() => ({}));
        throw new Error(err.error || `AI 変換に失敗: HTTP ${refactorRes.status}`);
      }

      const refactorData = await refactorRes.json();

      // Step 2: Register as template
      setSaveProgress("テンプレートを登録中...");

      const registerRes = await fetch("/api/export/register-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cacheId: refactorData.cacheId,
          name: templateName.trim(),
          description: templateDesc.trim(),
          category: templateCategory,
        }),
      });

      if (!registerRes.ok) {
        const err = await registerRes.json().catch(() => ({}));
        throw new Error(err.error || `登録に失敗: HTTP ${registerRes.status}`);
      }

      setShowSaveModal(false);
      setTemplateName("");
      setTemplateDesc("");
      setTemplateCategory("other");
      setSaveProgress("");

      setToast({
        message: "マスターテンプレートとして保存しました",
        link: "/library",
      });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaveLoading(false);
      setSaveProgress("");
    }
  }

  function openSaveModal(idx) {
    setSaveTargetIdx(idx);
    setShowSaveModal(true);
  }

  function ColorSwatch({ color, label }) {
    if (!color || !color.startsWith("rgb")) return null;
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded border border-[#D4A76A]/30 flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-[#5A4E3A] truncate">
          {label}: {color}
        </span>
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-[#3aafc9]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#8A7E6B]/50 focus:outline-none focus:ring-2 focus:ring-[#3aafc9]/40 focus:border-[#3aafc9]/40 transition-all";

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[#8A7E6B] hover:text-[#5A4E3A] transition-colors text-sm"
          >
            &larr; Dashboard
          </button>
          <div className="h-4 w-px bg-[#D4A76A]/30" />
          <h1
            className="text-lg font-bold bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] bg-clip-text text-transparent"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            デザイン採取
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("figma")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "figma"
                ? "bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white shadow-sm"
                : "bg-white/60 text-[#8A7E6B] border border-[#E8D5B0]/50 hover:bg-[#3aafc9]/10"
            }`}
          >
            Figma ファイル抽出
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("url")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "url"
                  ? "bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white shadow-sm"
                  : "bg-white/60 text-[#8A7E6B] border border-[#E8D5B0]/50 hover:bg-[#3aafc9]/10"
              }`}
            >
              URL 直接抽出
              <span className="px-1.5 py-0.5 text-[12px] font-bold rounded-full bg-[#FFD700]/30 text-[#8B6914] border border-[#FFD700]/50">
                ADMIN
              </span>
            </button>
          )}
        </div>

        {/* Figma extraction tab */}
        {activeTab === "figma" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-bold text-[#2a8fa9]">
                Figma ファイルからデザイン構造を抽出
              </h2>
            </div>

            {/* Figma Token */}
            <FigmaTokenInput
              value={figmaToken}
              onChange={setFigmaToken}
              inputClass={inputClass}
              accentColor="#3aafc9"
            />

            {/* Figma URL or File Key */}
            <div>
              <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                Figma ファイル URL または File Key
              </label>
              <input
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/VJFFAY..."
                className={inputClass}
              />
              {fileKey ? (
                <p className="text-[12px] text-[#3aafc9] mt-1">
                  File Key: {fileKey}
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="text-[12px] text-[#8A7E6B] flex items-start gap-1.5">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#3aafc9]/10 text-[#3aafc9] text-[12px] font-bold flex-shrink-0 mt-0.5">1</span>
                    Figma 右上の「共有」ボタンをクリック
                  </p>
                  <p className="text-[12px] text-[#8A7E6B] flex items-start gap-1.5">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#3aafc9]/10 text-[#3aafc9] text-[12px] font-bold flex-shrink-0 mt-0.5">2</span>
                    「リンクをコピー」をクリック
                  </p>
                  <p className="text-[12px] text-[#8A7E6B] flex items-start gap-1.5">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#3aafc9]/10 text-[#3aafc9] text-[12px] font-bold flex-shrink-0 mt-0.5">3</span>
                    この入力欄にそのまま貼り付け
                  </p>
                </div>
              )}
            </div>

            {/* Structure fetch button */}
            <button
              onClick={handleFetchStructure}
              disabled={structureLoading || !figmaToken || !fileKey}
              className="w-full py-3 rounded-xl bg-white/80 border border-[#3aafc9]/30 text-[#2a8fa9] text-sm font-semibold hover:bg-[#3aafc9]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {structureLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-[#3aafc9]/30 border-t-[#3aafc9] rounded-full animate-spin" />
                  構造を取得中...
                </span>
              ) : (
                "ファイル構造を取得"
              )}
            </button>

            {/* File structure display */}
            <AnimatePresence>
              {figmaStructure && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl bg-[#3aafc9]/5 border border-[#3aafc9]/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#2a8fa9]">
                        {figmaStructure.fileName}
                      </h3>
                      <span className="text-[12px] text-[#8A7E6B]">
                        {selectedNodeIds.length > 0
                          ? `${selectedNodeIds.length} ノード選択中`
                          : "全ノード抽出"}
                      </span>
                    </div>

                    {figmaStructure.pages?.map((page) => (
                      <div key={page.id} className="space-y-1">
                        <p className="text-xs font-semibold text-[#5A4E3A]">
                          {page.name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {page.children?.map((child) => {
                            const isSelected = selectedNodeIds.includes(child.id);
                            return (
                              <button
                                key={child.id}
                                onClick={() => toggleNodeId(child.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                  isSelected
                                    ? "bg-[#3aafc9] text-white"
                                    : "bg-white/60 text-[#5A4E3A] border border-[#E8D5B0]/50 hover:border-[#3aafc9]/40"
                                }`}
                              >
                                {child.name}
                                <span className="ml-1 opacity-50">
                                  ({child.type})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Extract button */}
            <button
              onClick={handleFigmaExtract}
              disabled={figmaLoading || !figmaToken || !fileKey}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white text-sm font-bold tracking-wide shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {figmaLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  抽出中...
                </span>
              ) : (
                "デザインを抽出"
              )}
            </button>
          </motion.div>
        )}

        {/* URL extraction tab (admin only) */}
        {activeTab === "url" && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
          >
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-bold text-[#2a8fa9]">
                URL 直接抽出
              </h2>
              <span className="px-2 py-0.5 text-[12px] font-bold rounded-full bg-[#FFD700]/20 text-[#8B6914] border border-[#FFD700]/40">
                ADMIN
              </span>
            </div>

            {/* Legal consent checkbox */}
            <div className="mb-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200/60">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-amber-300 text-[#3aafc9] focus:ring-[#3aafc9]/40"
                />
                <span className="text-xs text-amber-800 leading-relaxed">
                  本機能で取得するデータの著作権を遵守し、自己責任で使用することに同意します。
                  対象Webサイトの利用規約・robots.txt を確認の上、適切な範囲で使用してください。
                </span>
              </label>
            </div>

            <form onSubmit={handleUrlExtract} className="space-y-4">
              {/* URL input */}
              <div>
                <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className={inputClass}
                />
              </div>

              {/* Mode toggle */}
              <div>
                <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                  Mode
                </label>
                <div className="flex gap-2">
                  {[
                    { key: "page", label: "Page (auto-detect)" },
                    { key: "element", label: "Element (selector)" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode(m.key)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        mode === m.key
                          ? "bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white shadow-sm"
                          : "bg-white/60 text-[#8A7E6B] border border-[#E8D5B0]/50 hover:bg-[#3aafc9]/10"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector input */}
              <AnimatePresence>
                {mode === "element" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                      CSS Selector
                    </label>
                    <input
                      type="text"
                      value={selector}
                      onChange={(e) => setSelector(e.target.value)}
                      placeholder="header, .hero, #main"
                      className={inputClass}
                    />
                    <p className="text-[12px] text-[#8A7E6B] mt-1">
                      CSS Selector to target. Defaults to body if empty.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Extract button */}
              <button
                type="submit"
                disabled={urlLoading || !url || !consent}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white text-sm font-bold tracking-wide shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {urlLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    抽出中...
                  </span>
                ) : !consent ? (
                  "同意チェックが必要です"
                ) : (
                  "デザインを抽出"
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Status messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm"
          >
            {success}
          </motion.div>
        )}

        {/* Extraction results */}
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-sm font-semibold text-[#2a8fa9]">
              抽出結果 ({results.length} 要素)
            </h2>

            {/* Element cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {results.map((el, idx) => {
                const bgColor = el.styles?.visual?.backgroundColor;
                const textColor = el.styles?.typography?.color;
                const isSelected = selectedIdx === idx;

                return (
                  <motion.div
                    key={el.id || idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleTogglePreview(idx)}
                    className={`relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? "border-[#3aafc9] bg-[#3aafc9]/5 shadow-md"
                        : "border-[#E8D5B0]/50 bg-white/60 hover:border-[#3aafc9]/40"
                    }`}
                  >
                    {/* outerHTML available indicator */}
                    {results[idx]?.outerHTML && (
                      <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-emerald-400" title="プレビュー可能" />
                    )}

                    {/* Admin save icon */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openSaveModal(idx);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-[#C49A6C] hover:text-[#3aafc9] hover:bg-[#3aafc9]/10 transition-all"
                        title="テンプレートとして保存"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}

                    {/* Color preview */}
                    <div className="flex gap-1 mb-2">
                      {textColor &&
                        textColor.startsWith("rgb") && (
                          <div
                            className="w-4 h-4 rounded-sm border border-black/10"
                            style={{ backgroundColor: textColor }}
                            title={`text: ${textColor}`}
                          />
                        )}
                      {bgColor &&
                        bgColor.startsWith("rgb") &&
                        bgColor !== "rgba(0, 0, 0, 0)" && (
                          <div
                            className="w-4 h-4 rounded-sm border border-black/10"
                            style={{ backgroundColor: bgColor }}
                            title={`bg: ${bgColor}`}
                          />
                        )}
                    </div>
                    {/* Tag / node name */}
                    <p className="text-xs font-mono font-bold text-[#3aafc9]">
                      {el.figmaNodeName
                        ? el.figmaNodeName
                        : `<${el.tagName}>`}
                    </p>
                    {/* Text excerpt */}
                    {el.textContent && (
                      <p className="text-[12px] text-[#8A7E6B] mt-1 line-clamp-2 leading-relaxed">
                        {el.textContent.slice(0, 60)}
                        {el.textContent.length > 60 ? "..." : ""}
                      </p>
                    )}
                    {/* Size */}
                    {el.boundingBox && (
                      <p className="text-[12px] text-[#C49A6C] mt-1">
                        {el.boundingBox.width} x {el.boundingBox.height}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Detail + Preview panel */}
            <AnimatePresence>
              {selectedIdx !== null && results[selectedIdx] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Left: Detail panel */}
                    <div className="flex-1 min-w-0">
                      <DetailPanel
                        element={results[selectedIdx]}
                        ColorSwatch={ColorSwatch}
                      />
                    </div>

                    {/* Right: Live Preview */}
                    <div className="w-full md:w-[420px] flex-shrink-0">
                      <div className="rounded-2xl border border-[#3aafc9]/20 bg-white/70 overflow-hidden">
                        {/* Preview header */}
                        <div className="px-4 py-2.5 border-b border-[#E8D5B0]/30 flex items-center justify-between">
                          <span className="text-xs font-bold text-[#2a8fa9]">
                            Live Preview
                          </span>
                          <div className="flex items-center gap-2">
                            {/* SP/PC toggle */}
                            <div className="flex bg-white/50 rounded-lg p-0.5 border border-[#E8D5B0]/50">
                              <button
                                onClick={() => setPreviewWidth("sp")}
                                className={`px-2 py-1 rounded-md text-[12px] font-semibold transition-all ${
                                  previewWidth === "sp"
                                    ? "bg-[#3aafc9] text-white shadow-sm"
                                    : "text-[#8A7E6B] hover:bg-[#3aafc9]/10"
                                }`}
                              >
                                SP 370px
                              </button>
                              <button
                                onClick={() => setPreviewWidth("pc")}
                                className={`px-2 py-1 rounded-md text-[12px] font-semibold transition-all ${
                                  previewWidth === "pc"
                                    ? "bg-[#3aafc9] text-white shadow-sm"
                                    : "text-[#8A7E6B] hover:bg-[#3aafc9]/10"
                                }`}
                              >
                                PC 1200px
                              </button>
                            </div>

                            {/* Admin save button */}
                            {isAdmin && (
                              <button
                                onClick={() => openSaveModal(selectedIdx)}
                                className="px-3 py-1 rounded-md text-[12px] font-bold text-[#2a8fa9] border border-[#3aafc9]/30 bg-[#3aafc9]/5 hover:bg-[#3aafc9]/15 transition-all flex items-center gap-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                                  <path fillRule="evenodd" d="M8 1.75a.75.75 0 01.692.462l1.41 3.393 3.664.293a.75.75 0 01.428 1.317l-2.791 2.39.853 3.59a.75.75 0 01-1.12.813L8 12.202l-3.136 1.806a.75.75 0 01-1.12-.813l.853-3.59-2.79-2.39a.75.75 0 01.427-1.317l3.664-.293 1.41-3.393A.75.75 0 018 1.75z" clipRule="evenodd" />
                                </svg>
                                保存
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Preview content — outerHTML direct display */}
                        {results[selectedIdx]?.outerHTML ? (
                          <div className="flex justify-center bg-[#f5f5f5] p-4" style={{ minHeight: 300 }}>
                            <iframe
                              srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif; background: #fff; overflow: auto; }
    img { max-width: 100%; height: auto; }
    a { pointer-events: none; }
  </style>
</head>
<body>
  ${results[selectedIdx].outerHTML}
</body>
</html>`}
                              className="border border-[#E8D5B0]/30 rounded-lg bg-white shadow-inner"
                              style={{
                                width: previewWidth === "sp" ? 370 : "100%",
                                maxWidth: previewWidth === "pc" ? 1200 : 370,
                                height: 400,
                                transition: "width 0.3s ease, max-width 0.3s ease",
                              }}
                              sandbox="allow-scripts"
                              title="Element Preview"
                            />
                          </div>
                        ) : (
                          <div className="p-12 text-center">
                            <p className="text-[12px] text-[#8A7E6B]">
                              この要素にはプレビュー用 HTML がありません（Figma 抽出要素の場合）
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Design Library */}
        {library.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
          >
            <h3 className="text-sm font-semibold text-[#2a8fa9] mb-3">
              最近の採取履歴
            </h3>
            <div className="space-y-2">
              {library.map((dna) => (
                <div
                  key={dna.id}
                  className="flex items-center justify-between py-2 border-b border-[#E8D5B0]/30 last:border-b-0 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-[#3aafc9] bg-[#3aafc9]/10 px-2 py-0.5 rounded flex-shrink-0">
                      {dna.elementCount} elements
                    </span>
                    <span className="text-sm text-[#5A4E3A] truncate max-w-[300px]">
                      {dna.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[#C49A6C]">
                      {new Date(dna.savedAt).toLocaleDateString("ja-JP")}
                    </span>
                    <button
                      onClick={() => handleDeleteDna(dna.id)}
                      disabled={deletingId === dna.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#C49A6C] hover:text-red-500 p-1 rounded hover:bg-red-50 disabled:opacity-50"
                      title="削除"
                    >
                      {deletingId === dna.id ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* Save Template Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between bg-gradient-to-r from-[#3aafc9]/5 to-[#2a8fa9]/5">
                <h2 className="text-sm font-bold text-[#2a8fa9]">
                  マスターテンプレートとして保存
                </h2>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Element info */}
                {saveTargetIdx !== null && results[saveTargetIdx] && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#3aafc9]/5 border border-[#3aafc9]/20">
                    <span className="text-xs font-mono font-bold text-[#3aafc9]">
                      {results[saveTargetIdx].figmaNodeName || `<${results[saveTargetIdx].tagName}>`}
                    </span>
                    {results[saveTargetIdx].textContent && (
                      <span className="text-[12px] text-[#8A7E6B] truncate">
                        {results[saveTargetIdx].textContent.slice(0, 40)}
                      </span>
                    )}
                  </div>
                )}

                {/* Template name */}
                <div>
                  <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                    テンプレート名 *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="例: メインヘッダーパターン"
                    className={inputClass}
                  />
                </div>

                {/* Category dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                    カテゴリ
                  </label>
                  <select
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className={inputClass}
                  >
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-[#2a8fa9] mb-1.5">
                    説明（任意）
                  </label>
                  <textarea
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="テンプレートの用途や特徴を記載..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#E8D5B0]/50 text-sm text-[#8A7E6B] hover:bg-[#E8D5B0]/20 transition-all"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saveLoading || !templateName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveLoading ? (saveProgress || "処理中...") : "AI リファクタ → 保存"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl bg-emerald-600 text-white shadow-xl flex items-center gap-3"
          >
            <span className="text-sm">{toast.message}</span>
            {toast.link && (
              <button
                onClick={() => navigate(toast.link)}
                className="px-3 py-1 rounded-lg bg-white/20 text-xs font-bold hover:bg-white/30 transition-all whitespace-nowrap"
              >
                ライブラリを見る &rarr;
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white transition-colors ml-1"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Element detail panel */
function DetailPanel({ element, ColorSwatch }) {
  const typo = element.styles?.typography;
  const layout = element.styles?.layout;
  const visual = element.styles?.visual;

  const sections = [
    {
      title: "Typography",
      items: typo
        ? [
            { label: "Font", value: typo.fontFamily },
            { label: "Size", value: typo.fontSize },
            { label: "Weight", value: typo.fontWeight },
            { label: "Line Height", value: typo.lineHeight },
            { label: "Letter Spacing", value: typo.letterSpacing },
            { label: "Align", value: typo.textAlign },
          ].filter((i) => i.value && i.value !== "normal" && i.value !== "0px")
        : [],
    },
    {
      title: "Colors",
      colors: [
        typo?.color && { color: typo.color, label: "Text" },
        visual?.backgroundColor && {
          color: visual.backgroundColor,
          label: "Background",
        },
      ].filter(Boolean),
    },
    {
      title: "Layout",
      items: layout
        ? [
            { label: "Display", value: layout.display },
            { label: "Position", value: layout.position },
            { label: "Size", value: `${layout.width} x ${layout.height}` },
            { label: "Padding", value: layout.padding },
            { label: "Margin", value: layout.margin },
            { label: "Flex Dir", value: layout.flexDirection },
            { label: "Justify", value: layout.justifyContent },
            { label: "Align", value: layout.alignItems },
            { label: "Gap", value: layout.gap },
          ].filter(
            (i) =>
              i.value &&
              i.value !== "static" &&
              i.value !== "0px" &&
              i.value !== "normal" &&
              i.value !== "auto x auto"
          )
        : [],
    },
    {
      title: "Visual",
      items: visual
        ? [
            { label: "Border Radius", value: visual.borderRadius },
            { label: "Border", value: visual.border },
            { label: "Box Shadow", value: visual.boxShadow },
            { label: "Opacity", value: visual.opacity },
          ].filter(
            (i) =>
              i.value &&
              i.value !== "none" &&
              i.value !== "0px" &&
              i.value !== "1"
          )
        : [],
    },
  ];

  return (
    <div className="p-6 rounded-2xl bg-white/70 border border-[#3aafc9]/20 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-bold text-[#3aafc9]">
          {element.figmaNodeName || `<${element.tagName}>`}
        </span>
        {element.selector && (
          <span className="text-[12px] text-[#8A7E6B] font-mono truncate">
            {element.selector}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => {
          const hasContent =
            (section.items && section.items.length > 0) ||
            (section.colors && section.colors.length > 0);
          if (!hasContent) return null;

          return (
            <div key={section.title} className="space-y-2">
              <h4 className="text-xs font-bold text-[#2a8fa9] uppercase tracking-wider">
                {section.title}
              </h4>
              {section.colors &&
                section.colors.map((c, i) => (
                  <ColorSwatch key={i} color={c.color} label={c.label} />
                ))}
              {section.items &&
                section.items.map((item, i) => (
                  <div key={i} className="flex items-baseline gap-2">
                    <span className="text-[12px] text-[#8A7E6B] w-20 flex-shrink-0">
                      {item.label}
                    </span>
                    <span className="text-xs text-[#5A4E3A] font-mono truncate">
                      {item.value}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
