import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { downloadAsZip } from "../utils/zipDownloader";

const CATEGORIES = [
  { value: "all", label: "すべて" },
  { value: "header", label: "ヘッダー" },
  { value: "fv", label: "FV" },
  { value: "section", label: "セクション" },
  { value: "footer", label: "フッター" },
  { value: "nav", label: "ナビ" },
  { value: "card", label: "カード" },
  { value: "cta", label: "CTA" },
  { value: "ai-generated", label: "AI 生成" },
  { value: "other", label: "その他" },
];

function detectCategory(tpl) {
  if (tpl.templateMeta?.category && tpl.templateMeta.category !== "other") {
    return tpl.templateMeta.category;
  }
  const name = (tpl.templateMeta?.name || "").toLowerCase();
  const code = (tpl.componentCode || "").toLowerCase();
  if (name.includes("header") || code.includes("<header")) return "header";
  if (name.includes("fv") || name.includes("hero") || name.includes("first")) return "fv";
  if (name.includes("footer") || code.includes("<footer")) return "footer";
  if (name.includes("nav") || code.includes("<nav")) return "nav";
  if (name.includes("card") || code.includes("card")) return "card";
  if (name.includes("cta") || name.includes("action")) return "cta";
  if (name.includes("section") || code.includes("<section")) return "section";
  return "other";
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 50) || "Component";
}

export default function PartsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const [figmaSending, setFigmaSending] = useState("");
  const [zipDownloading, setZipDownloading] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/export/templates?full=true", { headers });
        const data = await res.json();
        if (data.success) setTemplates(data.data || []);
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const filteredTemplates = templates.filter((tpl) => {
    const name = tpl.templateMeta?.name || "";
    const desc = tpl.templateMeta?.description || "";
    const matchSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      desc.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || detectCategory(tpl) === category;
    return matchSearch && matchCategory;
  });

  function handleSelectTemplate(tpl) {
    setSelectedTemplate(tpl);
    setPreviewHtml(tpl.previewHtml || "");
  }

  async function handleCopyCode(tpl) {
    try {
      await navigator.clipboard.writeText(tpl.componentCode || "");
      setCopySuccess(tpl.id);
      setTimeout(() => setCopySuccess(""), 2000);
    } catch {
      console.error("Copy failed");
    }
  }

  async function handleFigmaExport(tpl) {
    if (!tpl.dnaId) return;
    setFigmaSending(tpl.id);
    try {
      const res = await fetch("/api/figma/plugin-styles", {
        method: "POST",
        headers,
        body: JSON.stringify({ dnaId: tpl.dnaId }),
      });
      const data = await res.json();
      if (data.success) {
        setCopySuccess(`figma-${tpl.id}`);
        setTimeout(() => setCopySuccess(""), 3000);
      }
    } catch (err) {
      console.error("Figma export failed:", err);
    } finally {
      setFigmaSending("");
    }
  }

  async function handleZipExport(tpl) {
    setZipDownloading(tpl.id);
    try {
      const fileName = sanitizeFileName(tpl.templateMeta?.name || "Component");
      await downloadAsZip(
        [{ name: `${fileName}.jsx`, content: tpl.componentCode || "" }],
        `${fileName}.zip`
      );
    } catch (err) {
      console.error("Zip export failed:", err);
    } finally {
      setZipDownloading("");
    }
  }

  async function handleRename(id, newName) {
    try {
      const res = await fetch(`/api/export/templates/${id}/name`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, templateMeta: { ...t.templateMeta, name: newName } }
              : t
          )
        );
        if (selectedTemplate?.id === id) {
          setSelectedTemplate((prev) => ({
            ...prev,
            templateMeta: { ...prev.templateMeta, name: newName },
          }));
        }
      }
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setEditingId(null);
  }

  function renderColorSwatches(colorMap) {
    if (!colorMap) return null;
    const entries = Object.entries(colorMap).slice(0, 6);
    return (
      <div className="flex gap-1 mt-2">
        {entries.map(([name, hex]) => (
          <div
            key={name}
            className="w-4 h-4 rounded-full border border-white/50 shadow-sm"
            style={{ backgroundColor: hex }}
            title={`${name}: ${hex}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-xs text-[#C49A6C] hover:text-[#8B6914] transition-colors"
            >
              ← Dashboard
            </button>
            <h1
              className="text-lg font-bold text-[#8B6914] tracking-wider"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              パーツ一覧
            </h1>
          </div>
          <span className="text-xs text-[#C49A6C]">
            {filteredTemplates.length} 件
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="パーツ名で検索..."
            className="max-w-xs w-full px-3 py-2 rounded-xl border border-[#E8D5B0]/50 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#C49A6C]/60 focus:outline-none focus:ring-2 focus:ring-[#ef4444]/40 transition-all"
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  category === c.value
                    ? "bg-[#ef4444] text-white shadow-sm"
                    : "bg-white/50 text-[#8A7E6B] border border-[#E8D5B0]/50 hover:bg-[#ef4444]/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-3 border-[#ef4444]/30 border-t-[#ef4444] rounded-full animate-spin" />
            <p className="text-xs text-[#C49A6C] mt-3">パーツを読み込み中...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredTemplates.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-4xl mb-3">🧩</p>
            <p className="text-sm text-[#8A7E6B]">
              {templates.length === 0
                ? "パーツがまだ登録されていません"
                : "条件に一致するパーツが見つかりません"}
            </p>
            <p className="text-[12px] text-[#C49A6C] mt-1">
              「コードライブラリ」ページで AI リファクタ後にテンプレート登録できます
            </p>
          </motion.div>
        )}

        {/* Parts grid + Preview */}
        {!loading && filteredTemplates.length > 0 && (
          <div className="flex gap-6">
            {/* Left: Parts cards */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((tpl, i) => {
                  const catLabel =
                    CATEGORIES.find((c) => c.value === detectCategory(tpl))?.label || "";
                  const isSelected = selectedTemplate?.id === tpl.id;

                  return (
                    <motion.div
                      key={tpl.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                        isSelected
                          ? "border-[#ef4444] bg-[#ef4444]/5 shadow-md"
                          : "border-[#E8D5B0]/50 bg-white/50 hover:border-[#ef4444]/30"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          {editingId === tpl.id ? (
                            <input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleRename(tpl.id, editingName)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(tpl.id, editingName);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-sm font-bold text-[#5A4E3A] bg-white/80 border border-[#ef4444] rounded-lg px-2 py-0.5 outline-none"
                            />
                          ) : (
                            <h3
                              className="text-sm font-bold text-[#5A4E3A] truncate"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingId(tpl.id);
                                setEditingName(tpl.templateMeta?.name || "");
                              }}
                              title="ダブルクリックで名前変更"
                            >
                              {tpl.templateMeta?.name || "Unnamed"}
                            </h3>
                          )}
                          {tpl.templateMeta?.description && (
                            <p className="text-[12px] text-[#8A7E6B] mt-0.5 truncate">
                              {tpl.templateMeta.description}
                            </p>
                          )}
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[12px] font-bold bg-[#ef4444]/10 text-[#dc2626] flex-shrink-0 ml-2">
                          {catLabel}
                        </span>
                      </div>

                      {/* Color swatches */}
                      {renderColorSwatches(tpl.colorMap)}

                      {/* Code preview */}
                      <div className="mt-2 p-2 rounded-lg bg-[#1e1e1e] overflow-hidden">
                        <pre
                          className="text-[12px] text-[#9CDCFE] leading-relaxed whitespace-pre-wrap break-all"
                          style={{ maxHeight: 60 }}
                        >
                          {(tpl.componentCode || "").slice(0, 200)}
                        </pre>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(tpl);
                          }}
                          className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold border border-[#D4A76A]/30 text-[#B8944C] hover:bg-[#D4A76A]/10 transition-all"
                        >
                          {copySuccess === tpl.id ? "コピー済み ✓" : "コードをコピー"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleZipExport(tpl);
                          }}
                          disabled={zipDownloading === tpl.id}
                          className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:shadow-md disabled:opacity-50 transition-all"
                        >
                          {zipDownloading === tpl.id ? "生成中..." : "Zip エクスポート"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFigmaExport(tpl);
                          }}
                          disabled={figmaSending === tpl.id || !tpl.dnaId}
                          className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white hover:shadow-md disabled:opacity-50 transition-all"
                        >
                          {figmaSending === tpl.id
                            ? "送信中..."
                            : copySuccess === `figma-${tpl.id}`
                            ? "送信済み ✓"
                            : "Figma データ"}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right: Preview */}
            <div className="w-[400px] flex-shrink-0 sticky top-24 self-start">
              <div className="rounded-2xl border border-[#E8D5B0]/50 bg-white/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E8D5B0]/30 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#8B6914]">
                    プレビュー
                  </h3>
                  {selectedTemplate && (
                    <span className="text-[12px] text-[#C49A6C]">
                      {selectedTemplate.templateMeta?.name}
                    </span>
                  )}
                </div>

                {!selectedTemplate ? (
                  <div className="p-8 text-center">
                    <p className="text-3xl mb-2">👈</p>
                    <p className="text-[12px] text-[#8A7E6B]">
                      パーツを選択してプレビュー
                    </p>
                  </div>
                ) : (
                  <iframe
                    srcDoc={`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{margin:0;padding:16px;font-family:'Noto Sans JP',sans-serif;}</style>
</head>
<body>${previewHtml}</body>
</html>`}
                    className="w-full border-0"
                    style={{ height: 500 }}
                    title="Parts Preview"
                    sandbox="allow-scripts"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
