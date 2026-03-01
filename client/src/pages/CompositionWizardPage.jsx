import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useApiKeys } from "../hooks/useApiKeys";
import PageInitModal from "../components/composition/PageInitModal";
import StructurePlannerPanel from "../components/composition/StructurePlannerPanel";
import SectionDesignMapper from "../components/composition/SectionDesignMapper";
import ReferenceConfigPanel from "../components/composition/ReferenceConfigPanel";
import CompositionPreviewPanel from "../components/composition/CompositionPreviewPanel";
import PageOptimizerModal from "../components/composition/PageOptimizerModal";

const STEPS = [
  { id: 1, label: "初期設定" },
  { id: 2, label: "構成プランニング" },
  { id: 3, label: "デザインマッピング" },
  { id: 4, label: "詳細設定" },
  { id: 5, label: "セクション生成" },
  { id: 6, label: "最終最適化" },
];

export default function CompositionWizardPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { getKey } = useApiKeys();

  // ── Wizard state ──
  const [wizardStep, setWizardStep] = useState(1);

  // ── Step 1: 初期設定 ──
  const [pageName, setPageName] = useState("");
  const [aiModel, setAiModel] = useState("deepseek");
  const [imageMode, setImageMode] = useState("unsplash");

  // ── Step 2: セクション構成 ──
  const [sections, setSections] = useState([]);

  // ── Step 3+4: デザインライブラリ ──
  const [dnaLibrary, setDnaLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // ── Step 5: 生成結果 ──
  const [generatedSections, setGeneratedSections] = useState([]);

  // ── Step 6: 最適化結果 ──
  const [assembledHtml, setAssembledHtml] = useState("");
  const [optimizedHtml, setOptimizedHtml] = useState("");
  const [optimizeChanges, setOptimizeChanges] = useState([]);

  // ── Final ──
  const [finalCode, setFinalCode] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // デザインライブラリを一括ロード
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/dna/library?full=true", { headers });
      const data = await res.json();
      if (data.success) setDnaLibrary(data.data || []);
    } catch (err) {
      console.error("Failed to load design library:", err);
    } finally {
      setLibraryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Step 1 完了
  const handleInitComplete = (name, model, mode) => {
    setPageName(name);
    setAiModel(model);
    setImageMode(mode);
    setWizardStep(2);
  };

  // Step 2 完了
  const handleStructureComplete = (sectionList) => {
    setSections(sectionList);
    setWizardStep(3);
  };

  // Step 3 完了
  const handleMappingComplete = (mappedSections) => {
    setSections(mappedSections);
    // デザイン参考 or デザイン付き完全再現があれば Step 4（詳細設定）へ、なければ Step 5 へ
    const needsConfig = mappedSections.some(
      (s) => s.mode === "reference" || (s.mode === "clone" && s.designRef?.dnaId)
    );
    setWizardStep(needsConfig ? 4 : 5);
  };

  // Step 4 完了
  const handleConfigComplete = (configuredSections) => {
    setSections(configuredSections);
    setWizardStep(5);
  };

  // Step 5 完了
  const handleGenerationComplete = (results, assembled) => {
    setGeneratedSections(results);
    setAssembledHtml(assembled);
    setWizardStep(6);
  };

  // Step 6 完了（保存）
  const handleOptimizeComplete = async (html, code) => {
    setOptimizedHtml(html);
    setFinalCode(code);
    try {
      await fetch("/api/compose/save-project", {
        method: "POST",
        headers,
        body: JSON.stringify({
          pageName,
          aiModel,
          imageMode,
          sections,
          finalHtml: html,
          finalCode: code,
          optimizedHtml: html,
        }),
      });
    } catch (err) {
      console.error("Save failed:", err);
    }
    navigate("/library");
  };

  // API key 取得ヘルパー
  const currentApiKey = getKey(aiModel) || "";

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#FAF3E6] to-[#F5E6C8]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/library")}
            className="text-[13px] text-[#C49A6C] hover:text-[#8B6914] transition-colors"
          >
            ← ライブラリ
          </button>
          <h1
            className="text-lg font-bold text-[#8B6914] tracking-wider"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            ページ構成ウィザード
          </h1>
          {pageName && (
            <span className="text-[13px] text-[#C49A6C] ml-2">— {pageName}</span>
          )}
        </div>
      </header>

      {/* ── Step indicator ── */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const isActive = wizardStep === step.id;
            const isDone = wizardStep > step.id;
            return (
              <div key={step.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className={`w-8 h-0.5 ${isDone ? "bg-[#D4A76A]" : "bg-[#E8D5B0]/50"}`}
                  />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white shadow-md"
                        : isDone
                        ? "bg-[#D4A76A] text-white"
                        : "bg-white/50 text-[#8A7E6B] border border-[#E8D5B0]/50"
                    }`}
                  >
                    {isDone ? "✓" : step.id}
                  </div>
                  <span
                    className={`text-[10px] mt-1 whitespace-nowrap ${
                      isActive ? "text-[#8B6914] font-bold" : "text-[#8A7E6B]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {wizardStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <PageInitModal
                pageName={pageName}
                aiModel={aiModel}
                imageMode={imageMode}
                onComplete={handleInitComplete}
                apiKey={currentApiKey}
                headers={headers}
              />
            </motion.div>
          )}
          {wizardStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <StructurePlannerPanel
                pageName={pageName}
                aiModel={aiModel}
                apiKey={currentApiKey}
                headers={headers}
                initialSections={sections}
                onComplete={handleStructureComplete}
                onBack={() => setWizardStep(1)}
              />
            </motion.div>
          )}
          {wizardStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <SectionDesignMapper
                sections={sections}
                dnaLibrary={dnaLibrary}
                libraryLoading={libraryLoading}
                onComplete={handleMappingComplete}
                onBack={() => setWizardStep(2)}
              />
            </motion.div>
          )}
          {wizardStep === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <ReferenceConfigPanel
                sections={sections}
                onComplete={handleConfigComplete}
                onBack={() => setWizardStep(3)}
              />
            </motion.div>
          )}
          {wizardStep === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <CompositionPreviewPanel
                sections={sections}
                dnaLibrary={dnaLibrary}
                pageName={pageName}
                aiModel={aiModel}
                apiKey={currentApiKey}
                imageMode={imageMode}
                headers={headers}
                onComplete={handleGenerationComplete}
                onBack={() => {
                  const hasRef = sections.some((s) => s.mode === "reference");
                  setWizardStep(hasRef ? 4 : 3);
                }}
              />
            </motion.div>
          )}
          {wizardStep === 6 && (
            <motion.div key="step6" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <PageOptimizerModal
                assembledHtml={assembledHtml}
                pageName={pageName}
                aiModel={aiModel}
                apiKey={currentApiKey}
                headers={headers}
                onComplete={handleOptimizeComplete}
                onBack={() => setWizardStep(5)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
