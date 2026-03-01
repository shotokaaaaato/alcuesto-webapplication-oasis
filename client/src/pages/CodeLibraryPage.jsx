import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useAuth } from "../context/AuthContext";
import { useApiKeys } from "../hooks/useApiKeys";
import ModelSelector from "../components/ModelSelector";
import { downloadAsZip } from "../utils/zipDownloader";

const PLACEHOLDER_CODE = `// デザインソースを選択して「AI でリファクタ」を実行してください
// React + Tailwind コンポーネントがここに表示されます

import React from 'react';

export default function DesignComponent() {
  return (
    <div className="p-8 text-center text-gray-400">
      コード未生成
    </div>
  );
}`;

const PLACEHOLDER_PREVIEW = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-family:sans-serif;">プレビュー未生成</div>`;

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 50) || "Component";
}

export default function CodeLibraryPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { getKey } = useApiKeys();
  const isAdmin = user?.role === "admin";

  // AI generation state
  const [selectedModel, setSelectedModel] = useState("deepseek");
  const [dnaList, setDnaList] = useState([]);
  const [selectedDnaId, setSelectedDnaId] = useState("");
  const [code, setCode] = useState(PLACEHOLDER_CODE);
  const [previewHtml, setPreviewHtml] = useState(PLACEHOLDER_PREVIEW);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("component");

  // Raw Data modal
  const [showRawData, setShowRawData] = useState(false);
  const [rawData, setRawData] = useState(null);
  const [rawDataLoading, setRawDataLoading] = useState(false);

  // Template system
  const [lastCacheId, setLastCacheId] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  // Saved code library
  const [savedCodes, setSavedCodes] = useState([]);
  const [savedCodesLoading, setSavedCodesLoading] = useState(true);
  const [selectedSavedId, setSelectedSavedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const iframeRef = useRef(null);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // デザインライブラリ + 保存済みコード読み込み
  useEffect(() => {
    async function loadAll() {
      try {
        const [dnaRes, codesRes] = await Promise.all([
          fetch("/api/dna/library", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/export/templates?full=true", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (dnaRes.ok) {
          const dnaData = await dnaRes.json();
          const list = dnaData.data || [];
          setDnaList(list);
          if (list.length > 0) setSelectedDnaId(list[list.length - 1].id);
        }

        if (codesRes.ok) {
          const codesData = await codesRes.json();
          setSavedCodes(codesData.data || []);
        }
      } catch (err) {
        setError(`データの読み込みに失敗: ${err.message}`);
      } finally {
        setSavedCodesLoading(false);
      }
    }
    if (token) loadAll();
  }, [token]);

  // Raw Data
  async function handleShowRawData() {
    if (!selectedDnaId) return;
    setRawDataLoading(true);
    try {
      const res = await fetch(`/api/dna/${selectedDnaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRawData(data.data);
      setShowRawData(true);
    } catch (err) {
      setError(`Raw Data の読み込みに失敗: ${err.message}`);
    } finally {
      setRawDataLoading(false);
    }
  }

  // AI リファクタ
  async function handleRefactor() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/export/refactor", {
        method: "POST",
        headers,
        body: JSON.stringify({
          dnaId: selectedDnaId || undefined,
          model: selectedModel,
          apiKey: getKey(selectedModel) || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCode(data.componentCode);
      setPreviewHtml(data.previewHtml);
      setActiveTab("component");
      setCacheHit(data.cached || false);
      setLastCacheId(data.cacheId || null);
      setSelectedSavedId(null);
      setSuccess(
        data.cached
          ? "キャッシュからコンポーネントを読み込みました (AI スキップ)"
          : "React + Tailwind コンポーネントを生成しました"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Tailwind Config
  async function handleGenerateConfig() {
    setConfigLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/export/tailwind-config", {
        method: "POST",
        headers,
        body: JSON.stringify({ dnaId: selectedDnaId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCode(data.config);
      setActiveTab("config");
      setSuccess("tailwind.config.js を生成しました");
    } catch (err) {
      setError(err.message);
    } finally {
      setConfigLoading(false);
    }
  }

  // Copy
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setSuccess("コピーしました");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  }

  // Download single file
  function handleDownload(filename) {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Zip download
  async function handleZipDownload() {
    const files = [];
    if (activeTab === "component") {
      files.push({ name: "DnaComponent.jsx", content: code });
    } else {
      files.push({ name: "tailwind.config.js", content: code });
    }
    await downloadAsZip(files, "oasis-code-export.zip");
    setSuccess("Zip をダウンロードしました");
    setTimeout(() => setSuccess(""), 2000);
  }

  // Register template (admin)
  async function handleRegisterTemplate() {
    if (!templateName.trim()) return;
    setRegisterLoading(true);
    try {
      const res = await fetch("/api/export/register-template", {
        method: "POST",
        headers,
        body: JSON.stringify({
          cacheId: lastCacheId,
          name: templateName.trim(),
          description: templateDesc.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setShowRegisterModal(false);
      setTemplateName("");
      setTemplateDesc("");
      setSuccess("マスターテンプレートとして登録しました");
      // Reload saved codes
      const codesRes = await fetch("/api/export/templates?full=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (codesRes.ok) {
        const codesData = await codesRes.json();
        setSavedCodes(codesData.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRegisterLoading(false);
    }
  }

  // Load saved code into editor
  function handleLoadSavedCode(saved) {
    setSelectedSavedId(saved.id);
    setCode(saved.componentCode || PLACEHOLDER_CODE);
    setPreviewHtml(saved.previewHtml || PLACEHOLDER_PREVIEW);
    setActiveTab("component");
    setCacheHit(false);
    setLastCacheId(saved.id);
    setSuccess(`「${saved.templateMeta?.name || "Unnamed"}」を読み込みました`);
    setTimeout(() => setSuccess(""), 2000);
  }

  // Rename saved code
  async function handleRenameSaved(id, newName) {
    try {
      const res = await fetch(`/api/export/templates/${id}/name`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedCodes((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, templateMeta: { ...s.templateMeta, name: newName } }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setEditingId(null);
  }

  // Zip export for saved code
  async function handleSavedZipExport(saved) {
    const fileName = sanitizeFileName(saved.templateMeta?.name || "Component");
    await downloadAsZip(
      [{ name: `${fileName}.jsx`, content: saved.componentCode || "" }],
      `${fileName}.zip`
    );
  }

  const iframeSrcDoc = `<!DOCTYPE html>
<html class="${darkMode ? "dark" : ""}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>tailwindcss.config = { darkMode: 'class' };<\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: 'Noto Sans JP', sans-serif; }
    ${darkMode ? "body { background: #1a1a2e; color: #e0e0e0; }" : "body { background: #ffffff; color: #1a1a1a; }"}
  </style>
</head>
<body>
  ${previewHtml}
</body>
</html>`;

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/40 focus:border-[#D4A76A]/40 transition-all";

  const smallBtnClass =
    "px-3 py-1 rounded-md text-[12px] font-bold text-[#B8944C] border border-[#D4A76A]/30 hover:bg-[#D4A76A]/10 transition-all";

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-[#8A7E6B] hover:text-[#5A4E3A] transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <div className="h-4 w-px bg-[#D4A76A]/30" />
            <h1
              className="text-lg font-bold bg-gradient-to-r from-[#D4A76A] to-[#B8944C] bg-clip-text text-transparent"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              コードライブラリ
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D4A76A]/30 text-xs text-[#8A7E6B] hover:bg-[#D4A76A]/10 transition-all"
            >
              {darkMode ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4 flex gap-4" style={{ height: "calc(100vh - 56px)" }}>
        {/* ─── Left: Code generation zone ─── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-end gap-3"
          >
            {/* Design Source */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-[#8B6914] mb-1">
                デザインソース
              </label>
              <select
                value={selectedDnaId}
                onChange={(e) => setSelectedDnaId(e.target.value)}
                className={inputClass}
              >
                {dnaList.length === 0 && (
                  <option value="">デザインデータが見つかりません</option>
                )}
                {dnaList.map((dna) => (
                  <option key={dna.id} value={dna.id}>
                    {dna.url} ({dna.elementCount} elements)
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleShowRawData}
                disabled={rawDataLoading || !selectedDnaId}
                className="px-3 py-2.5 rounded-xl border border-[#8A7E6B]/30 text-[#8A7E6B] text-xs font-bold hover:bg-[#8A7E6B]/10 transition-all disabled:opacity-50"
              >
                Raw Data
              </button>
              <ModelSelector value={selectedModel} onChange={setSelectedModel} />
              <button
                onClick={handleRefactor}
                disabled={loading || dnaList.length === 0}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A76A] to-[#B8944C] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? "AI generating..." : "AI Refactor"}
              </button>
              <button
                onClick={handleGenerateConfig}
                disabled={configLoading || dnaList.length === 0}
                className="px-4 py-2.5 rounded-xl border border-[#D4A76A]/40 text-[#B8944C] text-xs font-bold hover:bg-[#D4A76A]/10 transition-all disabled:opacity-50"
              >
                {configLoading ? "Generating..." : "Tailwind Config"}
              </button>
            </div>
          </motion.div>

          {/* Status messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {cacheHit && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium w-fit">
              ⚡ キャッシュヒット
            </div>
          )}

          {/* Tab selector + editor toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-white/50 rounded-xl p-1 border border-[#E8D5B0]/50">
              {[
                { key: "component", label: "Component" },
                { key: "config", label: "Tailwind Config" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
                    activeTab === tab.key
                      ? "bg-gradient-to-r from-[#D4A76A] to-[#B8944C] text-white shadow-sm"
                      : "text-[#8A7E6B] hover:bg-[#D4A76A]/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={handleCopy} className={smallBtnClass}>Copy</button>
              <button
                onClick={() => handleDownload(activeTab === "component" ? "DnaComponent.jsx" : "tailwind.config.js")}
                className={smallBtnClass}
              >
                DL
              </button>
              <button onClick={handleZipDownload} className={smallBtnClass}>
                Zip DL
              </button>
              {isAdmin && lastCacheId && code !== PLACEHOLDER_CODE && (
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="px-3 py-1 rounded-md text-[12px] font-bold text-[#8B6914] border border-[#FFD700]/40 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 transition-all"
                >
                  テンプレート登録
                </button>
              )}
            </div>
          </div>

          {/* Editor + Preview Split */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* Monaco Editor */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-[#E8D5B0]/50 shadow-sm bg-white">
              <Editor
                height="100%"
                language="javascript"
                theme={darkMode ? "vs-dark" : "vs-light"}
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  padding: { top: 8 },
                  lineNumbers: "on",
                  renderLineHighlight: "gutter",
                  folding: true,
                  tabSize: 2,
                }}
              />
            </div>

            {/* Preview */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-[#E8D5B0]/50 shadow-sm bg-white">
              <div className="px-3 py-1.5 bg-white/80 border-b border-[#E8D5B0]/50 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#8B6914]">Preview</span>
                <span className="text-[12px] text-[#C49A6C]">{darkMode ? "Dark" : "Light"}</span>
              </div>
              {activeTab === "component" ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={iframeSrcDoc}
                  className="w-full border-0"
                  style={{ height: "calc(100% - 30px)" }}
                  sandbox="allow-scripts"
                  title="Component Preview"
                />
              ) : (
                <div className="p-4 h-full overflow-auto" style={{ background: darkMode ? "#1e1e1e" : "#fafafa" }}>
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: darkMode ? "#d4d4d4" : "#333" }}>
                    {code}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Right: Saved code library sidebar ─── */}
        <div className="w-[280px] flex-shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#8B6914]">保存済みコード</h3>
            <span className="text-[12px] text-[#C49A6C]">{savedCodes.length} 件</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {savedCodesLoading && (
              <div className="text-center py-8">
                <div className="inline-block w-5 h-5 border-2 border-[#D4A76A]/30 border-t-[#D4A76A] rounded-full animate-spin" />
              </div>
            )}

            {!savedCodesLoading && savedCodes.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[12px] text-[#8A7E6B]">保存済みコードはありません</p>
              </div>
            )}

            {savedCodes.map((saved) => {
              const isActive = selectedSavedId === saved.id;
              return (
                <motion.div
                  key={saved.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handleLoadSavedCode(saved)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? "border-[#D4A76A] bg-[#D4A76A]/5"
                      : "border-[#E8D5B0]/50 bg-white/50 hover:border-[#D4A76A]/30"
                  }`}
                >
                  {editingId === saved.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenameSaved(saved.id, editingName)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSaved(saved.id, editingName);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-xs font-semibold text-[#5A4E3A] bg-white/80 border border-[#D4A76A] rounded-lg px-2 py-0.5 outline-none"
                    />
                  ) : (
                    <p
                      className="text-xs font-semibold text-[#5A4E3A] truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(saved.id);
                        setEditingName(saved.templateMeta?.name || "");
                      }}
                      title="ダブルクリックで名前変更"
                    >
                      {saved.templateMeta?.name || "Unnamed"}
                    </p>
                  )}
                  {saved.templateMeta?.description && (
                    <p className="text-[12px] text-[#8A7E6B] mt-0.5 truncate">
                      {saved.templateMeta.description}
                    </p>
                  )}
                  {/* Color swatches */}
                  {saved.colorMap && (
                    <div className="flex gap-0.5 mt-1.5">
                      {Object.values(saved.colorMap).slice(0, 5).map((hex, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 rounded-sm border border-black/10"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  )}
                  <pre className="mt-1.5 text-[12px] text-[#8A7E6B] font-mono bg-[#FAF3E6] rounded p-1.5 overflow-hidden" style={{ maxHeight: 40 }}>
                    {(saved.componentCode || "").slice(0, 100)}
                  </pre>
                  {/* Actions */}
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(saved.componentCode || "");
                        setSuccess("コピーしました");
                        setTimeout(() => setSuccess(""), 2000);
                      }}
                      className="flex-1 py-1 rounded text-[12px] font-bold border border-[#D4A76A]/30 text-[#B8944C] hover:bg-[#D4A76A]/10 transition-all"
                    >
                      Copy
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSavedZipExport(saved);
                      }}
                      className="flex-1 py-1 rounded text-[12px] font-bold bg-[#D4A76A] text-white hover:bg-[#B8944C] transition-all"
                    >
                      Zip
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Raw Data Modal ── */}
      <AnimatePresence>
        {showRawData && rawData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowRawData(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-[#5A4E3A]">Raw Data</h2>
                  <p className="text-[12px] text-[#8A7E6B] mt-0.5">
                    {rawData.url} — {rawData.elementCount} elements
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
                      setSuccess("Raw Data をコピーしました");
                      setTimeout(() => setSuccess(""), 2000);
                    }}
                    className={smallBtnClass}
                  >
                    Copy JSON
                  </button>
                  <button
                    onClick={() => setShowRawData(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <pre className="text-xs leading-relaxed text-[#5A4E3A] whitespace-pre-wrap font-mono">
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Register Template Modal (admin) ── */}
      <AnimatePresence>
        {showRegisterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowRegisterModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between bg-gradient-to-r from-[#FFD700]/5 to-[#D4A76A]/5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[12px] font-bold rounded-full bg-[#FFD700]/20 text-[#8B6914] border border-[#FFD700]/40">
                    ADMIN
                  </span>
                  <h2 className="text-sm font-bold text-[#5A4E3A]">テンプレート登録</h2>
                </div>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                >
                  ×
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-[#8A7E6B] leading-relaxed">
                  現在のコードをマスターテンプレートとして登録します。
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#8B6914] mb-1.5">テンプレート名</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="例: コーポレートランディングページ"
                    className="w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#8A7E6B]/50 focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8B6914] mb-1.5">説明（任意）</label>
                  <textarea
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="テンプレートの用途や特徴..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#8A7E6B]/50 focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/40 transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowRegisterModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#E8D5B0]/50 text-sm text-[#8A7E6B] hover:bg-[#E8D5B0]/20 transition-all"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleRegisterTemplate}
                    disabled={registerLoading || !templateName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#D4A76A] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {registerLoading ? "登録中..." : "登録する"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
