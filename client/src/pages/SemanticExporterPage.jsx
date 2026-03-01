import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useAuth } from "../context/AuthContext";
import { useApiKeys } from "../hooks/useApiKeys";
import ModelSelector from "../components/ModelSelector";

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

export default function SemanticExporterPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { getKey } = useApiKeys();
  const isAdmin = user?.role === "admin";

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

  // Figma guide
  const [showFigmaGuide, setShowFigmaGuide] = useState(false);

  // Template system
  const [lastCacheId, setLastCacheId] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  const iframeRef = useRef(null);

  // デザインライブラリ読み込み
  useEffect(() => {
    async function loadLibrary() {
      try {
        const res = await fetch("/api/dna/library", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = data.data || [];
        setDnaList(list);
        if (list.length > 0) {
          setSelectedDnaId(list[list.length - 1].id);
        }
      } catch (err) {
        setError(`デザインライブラリの読み込みに失敗: ${err.message}`);
      }
    }
    if (token) loadLibrary();
  }, [token]);

  // Raw Data 読み込み
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

  // AI リファクタ実行
  async function handleRefactor() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/export/refactor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  // Tailwind Config 生成
  async function handleGenerateConfig() {
    setConfigLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/export/tailwind-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dnaId: selectedDnaId || undefined,
        }),
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

  // コードをクリップボードにコピー
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setSuccess("コピーしました");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  }

  // ファイルダウンロード
  function handleDownload(filename) {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // テンプレート一覧読み込み
  async function handleShowTemplates() {
    setTemplateLoading(true);
    try {
      const res = await fetch("/api/export/templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTemplates(data.data || []);
      setShowTemplates(true);
    } catch (err) {
      setError(`テンプレート読み込みに失敗: ${err.message}`);
    } finally {
      setTemplateLoading(false);
    }
  }

  // テンプレート適用
  async function handleApplyTemplate(templateId) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/export/apply-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ templateId, dnaId: selectedDnaId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCode(data.componentCode);
      setPreviewHtml(data.previewHtml);
      setActiveTab("component");
      setShowTemplates(false);
      setCacheHit(false);
      setLastCacheId(null);
      setSuccess(`テンプレート「${data.templateSource.name}」を適用しました`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // テンプレート登録 (admin)
  async function handleRegisterTemplate() {
    if (!templateName.trim()) return;
    setRegisterLoading(true);
    try {
      const res = await fetch("/api/export/register-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    } catch (err) {
      setError(err.message);
    } finally {
      setRegisterLoading(false);
    }
  }

  // テンプレート解除 (admin)
  async function handleUnregisterTemplate(templateId) {
    try {
      const res = await fetch(`/api/export/templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setSuccess("テンプレート登録を解除しました");
    } catch (err) {
      setError(err.message);
    }
  }

  // iframe の srcDoc を生成
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
              &larr; Dashboard
            </button>
            <div className="h-4 w-px bg-[#D4A76A]/30" />
            <h1
              className="text-lg font-bold bg-gradient-to-r from-[#D4A76A] to-[#B8944C] bg-clip-text text-transparent"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Semantic Exporter
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Figma Sync 導線 */}
            <button
              onClick={() => setShowFigmaGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a259ff]/30 text-xs text-[#a259ff] hover:bg-[#a259ff]/10 transition-all"
            >
              <span className="text-sm">&#x1F517;</span>
              Figma Sync
            </button>

            {/* Dark/Light mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D4A76A]/30 text-xs text-[#8A7E6B] hover:bg-[#D4A76A]/10 transition-all"
            >
              {darkMode ? (
                <>
                  <span className="text-base">&#9788;</span>
                  <span>Light</span>
                </>
              ) : (
                <>
                  <span className="text-base">&#9790;</span>
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-end gap-4"
        >
          {/* Design Source */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-[#8B6914] mb-1.5">
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
                  {dna.url} ({dna.elementCount} elements) -{" "}
                  {new Date(dna.savedAt).toLocaleDateString("ja-JP")}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleShowRawData}
              disabled={rawDataLoading || !selectedDnaId}
              className="px-4 py-3 rounded-xl border-2 border-[#8A7E6B]/30 text-[#8A7E6B] text-sm font-bold hover:bg-[#8A7E6B]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {rawDataLoading ? "Loading..." : "Raw Data"}
            </button>
            <button
              onClick={handleShowTemplates}
              disabled={templateLoading}
              className="px-4 py-3 rounded-xl border-2 border-[#8B6914]/30 text-[#8B6914] text-sm font-bold hover:bg-[#8B6914]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {templateLoading ? "Loading..." : "Templates"}
            </button>
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
            />
            <button
              onClick={handleRefactor}
              disabled={loading || dnaList.length === 0}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#D4A76A] to-[#B8944C] text-white text-sm font-bold tracking-wide shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  AI generating...
                </span>
              ) : (
                "AI Refactor"
              )}
            </button>
            <button
              onClick={handleGenerateConfig}
              disabled={configLoading || dnaList.length === 0}
              className="px-5 py-3 rounded-xl border-2 border-[#D4A76A]/40 text-[#B8944C] text-sm font-bold hover:bg-[#D4A76A]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {configLoading ? "Generating..." : "Tailwind Config"}
            </button>
          </div>
        </motion.div>

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

        {/* Cache hit indicator */}
        {cacheHit && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium w-fit"
          >
            <span>&#x26A1;</span>
            キャッシュヒット — AI 呼び出しをスキップしました
          </motion.div>
        )}

        {/* Tab selector */}
        <div className="flex gap-1 bg-white/50 rounded-xl p-1 border border-[#E8D5B0]/50 w-fit">
          {[
            { key: "component", label: "Component" },
            { key: "config", label: "Tailwind Config" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-[#D4A76A] to-[#B8944C] text-white shadow-sm"
                  : "text-[#8A7E6B] hover:bg-[#D4A76A]/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Editor + Preview Split */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-4"
          style={{ height: "calc(100vh - 310px)" }}
        >
          {/* Left: Monaco Editor */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-[#E8D5B0]/50 shadow-sm bg-white">
            <div className="px-4 py-2 bg-white/80 border-b border-[#E8D5B0]/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8B6914]">
                {activeTab === "component"
                  ? "DnaComponent.jsx"
                  : "tailwind.config.js"}
              </span>
              <div className="flex gap-2">
                <button onClick={handleCopy} className={smallBtnClass}>
                  Copy
                </button>
                <button
                  onClick={() =>
                    handleDownload(
                      activeTab === "component"
                        ? "DnaComponent.jsx"
                        : "tailwind.config.js"
                    )
                  }
                  className={smallBtnClass}
                >
                  Download
                </button>
                {isAdmin && lastCacheId && code !== PLACEHOLDER_CODE && (
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="px-3 py-1 rounded-md text-[12px] font-bold text-[#8B6914] border border-[#FFD700]/40 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 transition-all flex items-center gap-1"
                  >
                    <span className="px-1 py-0.5 text-[12px] rounded bg-[#FFD700]/20 border border-[#FFD700]/40">
                      ADMIN
                    </span>
                    テンプレート登録
                  </button>
                )}
              </div>
            </div>
            <Editor
              height="100%"
              language="javascript"
              theme={darkMode ? "vs-dark" : "vs-light"}
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                lineNumbers: "on",
                renderLineHighlight: "gutter",
                folding: true,
                tabSize: 2,
              }}
            />
          </div>

          {/* Right: Live Preview */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-[#E8D5B0]/50 shadow-sm bg-white">
            <div className="px-4 py-2 bg-white/80 border-b border-[#E8D5B0]/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8B6914]">
                Preview
              </span>
              <span className="text-[12px] text-[#C49A6C]">
                {darkMode ? "Dark Mode" : "Light Mode"}
              </span>
            </div>
            {activeTab === "component" ? (
              <iframe
                ref={iframeRef}
                srcDoc={iframeSrcDoc}
                className="w-full border-0"
                style={{ height: "calc(100% - 37px)" }}
                sandbox="allow-scripts"
                title="Component Preview"
              />
            ) : (
              <div
                className="p-6 h-full overflow-auto"
                style={{
                  background: darkMode ? "#1e1e1e" : "#fafafa",
                  color: darkMode ? "#d4d4d4" : "#333",
                }}
              >
                <p className="text-xs text-[#8A7E6B] mb-4">
                  Generated tailwind.config.js — copy and paste into your
                  project's config file.
                </p>
                <pre
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: "'Fira Code', 'Consolas', monospace" }}
                >
                  {code}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* ── Raw Data Modal ───────────────────────────── */}
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
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-[#5A4E3A]">
                    Raw Data
                  </h2>
                  <p className="text-[12px] text-[#8A7E6B] mt-0.5">
                    {rawData.url} &mdash; {rawData.elementCount} elements &mdash;{" "}
                    {new Date(rawData.savedAt).toLocaleString("ja-JP")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(rawData, null, 2)
                      );
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
                    &times;
                  </button>
                </div>
              </div>
              {/* Modal body */}
              <div className="flex-1 overflow-auto p-6">
                <pre
                  className="text-xs leading-relaxed text-[#5A4E3A] whitespace-pre-wrap"
                  style={{ fontFamily: "'Fira Code', 'Consolas', monospace" }}
                >
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Figma Sync Guide Modal ───────────────────── */}
      <AnimatePresence>
        {showFigmaGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowFigmaGuide(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between bg-gradient-to-r from-[#a259ff]/5 to-[#7c3aed]/5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">&#x1F517;</span>
                  <h2 className="text-sm font-bold text-[#7c3aed]">
                    Figma Sync Workflow
                  </h2>
                </div>
                <button
                  onClick={() => setShowFigmaGuide(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                <p className="text-xs text-[#8A7E6B] leading-relaxed">
                  Semantic Exporter で確認したデザインデータを Figma の Local Styles として登録する手順です。
                </p>

                {/* Steps */}
                <div className="space-y-4">
                  {[
                    {
                      step: 1,
                      title: "Figma アクセストークンを設定",
                      desc: "環境設定ページで Figma Personal Access Token を入力してください。",
                      action: (
                        <button
                          onClick={() => {
                            setShowFigmaGuide(false);
                            navigate("/settings");
                          }}
                          className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all"
                        >
                          環境設定を開く &rarr;
                        </button>
                      ),
                    },
                    {
                      step: 2,
                      title: "Figma Plugin をインストール",
                      desc: "apps/figma-sync/plugin/ フォルダを Figma Desktop の プラグイン > 開発 > マニフェストからプラグインをインポート... から読み込みます。",
                      tip: 'manifest.json を選択して "OASIS Sync Tool" を登録します。',
                    },
                    {
                      step: 3,
                      title: "Plugin を起動して同期",
                      desc: "Figma 上で プラグイン > OASIS Sync Tool を実行。JWT トークンを入力して「Figma に同期」を押します。",
                      tip: "Paint Styles（色）と Text Styles（タイポグラフィ）が Local Styles として自動作成されます。既存スタイルは上書き更新されます。",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] flex items-center justify-center text-white text-xs font-bold">
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-[#5A4E3A]">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#8A7E6B] mt-0.5 leading-relaxed">
                          {item.desc}
                        </p>
                        {item.tip && (
                          <p className="text-[12px] text-[#a259ff]/70 mt-1 flex items-start gap-1">
                            <span>*</span>
                            {item.tip}
                          </p>
                        )}
                        {item.action}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flow diagram */}
                <div className="mt-4 p-4 rounded-xl bg-[#FAF3E6] border border-[#E8D5B0]/50">
                  <p className="text-[12px] font-bold text-[#8B6914] mb-2 uppercase tracking-wider">
                    Workflow
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-[#3aafc9]/15 text-[#2a8fa9] font-bold">
                      デザイン採取
                    </span>
                    <span className="text-[#C49A6C]">&rarr;</span>
                    <span className="px-2 py-1 rounded bg-[#D4A76A]/15 text-[#B8944C] font-bold border-2 border-[#D4A76A]/40">
                      Exporter
                    </span>
                    <span className="text-[#C49A6C]">&rarr;</span>
                    <span className="px-2 py-1 rounded bg-[#a259ff]/15 text-[#7c3aed] font-bold">
                      Figma Sync
                    </span>
                    <span className="text-[#C49A6C]">/</span>
                    <span className="px-2 py-1 rounded bg-[#D4A76A]/15 text-[#B8944C] font-bold">
                      Code DL
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Register Template Modal (admin) ──────────── */}
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
                  <h2 className="text-sm font-bold text-[#5A4E3A]">
                    マスターテンプレート登録
                  </h2>
                </div>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                >
                  &times;
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-[#8A7E6B] leading-relaxed">
                  現在のコードをマスターテンプレートとして登録すると、一般ユーザーがこのテンプレートを参照・適用できるようになります。
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#8B6914] mb-1.5">
                    テンプレート名
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="例: コーポレートランディングページ"
                    className="w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#8A7E6B]/50 focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8B6914] mb-1.5">
                    説明（任意）
                  </label>
                  <textarea
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="テンプレートの用途や特徴を記載..."
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
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#D4A76A] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registerLoading ? "登録中..." : "登録する"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Template Browser Modal ────────────────────── */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-bold text-[#5A4E3A]">
                  マスターテンプレート一覧
                </h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-6">
                {templates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-[#8A7E6B]">
                      登録されたテンプレートはまだありません
                    </p>
                    <p className="text-xs text-[#C49A6C] mt-1">
                      管理者が AI Refactor 後に「テンプレート登録」から追加できます
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        className="p-4 rounded-xl border border-[#E8D5B0]/50 bg-white/60 hover:border-[#D4A76A]/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-[#5A4E3A]">
                              {tmpl.templateMeta?.name || "Unnamed"}
                            </h3>
                            {tmpl.templateMeta?.description && (
                              <p className="text-xs text-[#8A7E6B] mt-0.5 line-clamp-2">
                                {tmpl.templateMeta.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[12px] text-[#C49A6C]">
                                {new Date(tmpl.templateMeta?.registeredAt || tmpl.createdAt).toLocaleDateString("ja-JP")}
                              </span>
                              {tmpl.colorMap && (
                                <div className="flex gap-0.5">
                                  {Object.values(tmpl.colorMap).slice(0, 6).map((hex, i) => (
                                    <div
                                      key={i}
                                      className="w-3 h-3 rounded-sm border border-black/10"
                                      style={{ backgroundColor: hex }}
                                      title={hex}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            {tmpl.codePreview && (
                              <pre className="mt-2 text-[12px] text-[#8A7E6B] font-mono bg-[#FAF3E6] rounded-lg p-2 line-clamp-3 overflow-hidden">
                                {tmpl.codePreview}
                              </pre>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleApplyTemplate(tmpl.id)}
                              disabled={loading || dnaList.length === 0}
                              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4A76A] to-[#B8944C] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                            >
                              適用
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleUnregisterTemplate(tmpl.id)}
                                className="px-4 py-1.5 rounded-lg border border-red-200 text-red-400 text-[12px] hover:bg-red-50 transition-all"
                              >
                                解除
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
