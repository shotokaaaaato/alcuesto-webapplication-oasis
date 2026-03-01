import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useApiKeys } from "../hooks/useApiKeys";

const FIGMA_URL_REGEX =
  /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/;

export default function FigmaImportPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { getKey } = useApiKeys();
  const figmaToken = getKey("figma");

  // Figma connection
  const [figmaUrl, setFigmaUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState([]);
  const [loadingStructure, setLoadingStructure] = useState(false);

  // Page & Frame selection
  const [selectedPage, setSelectedPage] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const [loadingThumb, setLoadingThumb] = useState(null);

  // Device mapping (new)
  const [importType, setImportType] = useState("web"); // "web" | "graphic"
  const [pcFrame, setPcFrame] = useState(null);
  const [spFrame, setSpFrame] = useState(null);
  const [deviceMode, setDeviceMode] = useState("pc"); // which slot is active

  // Design data
  const [extractedDna, setExtractedDna] = useState(null);
  const [loadingDna, setLoadingDna] = useState(false);
  const [savedDnaId, setSavedDnaId] = useState(null);
  const [masterImageSaved, setMasterImageSaved] = useState(false);
  const [extractResult, setExtractResult] = useState(null); // paired extract result

  // Save name
  const [saveName, setSaveName] = useState("");

  // UI state
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const fileKey = figmaUrl.match(FIGMA_URL_REGEX)?.[1] || "";

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-[#E8D5B0]/50 bg-white/80 text-sm text-[#5C4A28] placeholder:text-[#C4A97D]/50 focus:outline-none focus:ring-2 focus:ring-[#3aafc9]/30 focus:border-transparent font-['Noto_Sans_JP']";

  // ─── Fetch file structure ───
  const fetchStructure = useCallback(async () => {
    if (!figmaToken || !fileKey) {
      setError("Figma トークンと URL を入力してください");
      return;
    }
    setError("");
    setLoadingStructure(true);
    setPages([]);
    setSelectedPage(null);
    setSelectedFrame(null);
    setPcFrame(null);
    setSpFrame(null);
    setThumbnails({});
    setExtractedDna(null);
    setExtractResult(null);
    setMasterImageSaved(false);

    try {
      const res = await fetch("/api/dna/figma-structure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accessToken: figmaToken, fileKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "構造取得に失敗");

      setFileName(data.fileName || "");
      setPages(data.pages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingStructure(false);
    }
  }, [figmaToken, fileKey, token]);

  // ─── Fetch single frame thumbnail (lazy) ───
  const fetchThumbnail = useCallback(
    async (nodeId) => {
      if (thumbnails[nodeId] || loadingThumb === nodeId) return;
      setLoadingThumb(nodeId);
      try {
        const res = await fetch("/api/figma/images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            accessToken: figmaToken,
            fileKey,
            nodeIds: [nodeId],
          }),
        });
        const data = await res.json();
        if (data.success && data.images?.[nodeId]) {
          setThumbnails((prev) => ({ ...prev, [nodeId]: data.images[nodeId] }));
        }
      } catch (err) {
        console.error("Thumbnail fetch failed:", err);
      } finally {
        setLoadingThumb(null);
      }
    },
    [figmaToken, fileKey, token, thumbnails, loadingThumb]
  );

  // ─── Select frame (device-aware) ───
  const handleSelectFrame = useCallback(
    (frame) => {
      if (importType === "web") {
        // Assign to current device slot
        if (deviceMode === "pc") {
          setPcFrame(frame);
        } else {
          setSpFrame(frame);
        }
        fetchThumbnail(frame.id);
      } else {
        // Graphic mode: single frame
        setSelectedFrame(frame);
        setExtractedDna(null);
        setMasterImageSaved(false);
        setSavedDnaId(null);
        fetchThumbnail(frame.id);
      }
    },
    [fetchThumbnail, importType, deviceMode]
  );

  // ─── Select a page ───
  const handleSelectPage = useCallback((page) => {
    setSelectedPage(page);
    setSelectedFrame(null);
    setPcFrame(null);
    setSpFrame(null);
    setExtractedDna(null);
    setExtractResult(null);
    setMasterImageSaved(false);
    setSavedDnaId(null);
  }, []);

  // ─── Extract: graphic mode (existing single frame) ───
  const extractFrameDna = useCallback(async () => {
    if (!selectedFrame) return;
    setLoadingDna(true);
    setError("");
    setExtractedDna(null);
    setMasterImageSaved(false);

    try {
      const res = await fetch("/api/dna/extract-figma", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: figmaToken,
          fileKey,
          nodeIds: [selectedFrame.id],
          frameName: selectedFrame.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "デザイン抽出に失敗");

      setExtractedDna(data.data || []);
      setSavedDnaId(data.savedId);
      setMasterImageSaved(!!data.masterImage);
      // Set type to graphic
      if (data.savedId) {
        fetch(`/api/dna/${data.savedId}/type`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: "graphic" }),
        }).catch(() => {});
      }
      const defaultName = fileName && selectedFrame.name
        ? `${fileName} - ${selectedFrame.name}`
        : selectedFrame.name || fileName || "";
      setSaveName(defaultName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDna(false);
    }
  }, [selectedFrame, figmaToken, fileKey, token, fileName]);

  // ─── Extract: web mode (paired PC/SP) ───
  const extractPairedDna = useCallback(async () => {
    if (!pcFrame) return;
    setLoadingDna(true);
    setError("");
    setExtractedDna(null);
    setExtractResult(null);
    setMasterImageSaved(false);

    try {
      const res = await fetch("/api/dna/extract-figma-paired", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: figmaToken,
          fileKey,
          type: "web",
          pcNodeId: pcFrame.id,
          spNodeId: spFrame?.id || null,
          pcFrameName: pcFrame.name,
          spFrameName: spFrame?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "デザイン抽出に失敗");

      setExtractResult(data);
      setSavedDnaId(data.savedId);
      setMasterImageSaved(!!data.masterImage);
      // Build default name
      let defaultName = fileName || "";
      if (pcFrame.name) defaultName += ` - ${pcFrame.name}`;
      if (spFrame?.name) defaultName += ` / ${spFrame.name}`;
      setSaveName(defaultName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDna(false);
    }
  }, [pcFrame, spFrame, figmaToken, fileKey, token, fileName]);

  // ─── Derived ───
  const currentFrames = selectedPage?.children || [];

  // Which frame is "active" in the frame list for highlighting
  const getFrameHighlight = (frame) => {
    if (importType === "graphic") return selectedFrame?.id === frame.id ? "selected" : null;
    if (pcFrame?.id === frame.id && spFrame?.id === frame.id) return "both";
    if (pcFrame?.id === frame.id) return "pc";
    if (spFrame?.id === frame.id) return "sp";
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF3E6] to-[#F5E6C8]" style={{ fontSize: 15 }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF3E6]/90 backdrop-blur border-b border-[#E8D5B0]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-[#8B6914]/70 hover:text-[#8B6914] transition font-['Noto_Sans_JP']"
            >
              ← ダッシュボード
            </button>
            <span className="text-[#E8D5B0]">|</span>
            <h1 className="text-lg font-bold text-[#5C4A28] font-['Noto_Serif_JP']">
              Figma インポート
            </h1>
            {fileName && (
              <span className="text-sm text-[#3aafc9] font-['Noto_Sans_JP']">
                — {fileName}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-['Noto_Sans_JP']"
            >
              {error}
              <button
                onClick={() => setError("")}
                className="ml-3 text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ Figma File Connection ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h2 className="text-base font-bold text-[#5C4A28] mb-4 font-['Noto_Serif_JP']">
            Figma ファイルを接続
          </h2>

          <div className="space-y-4">
            {/* Figma Token status */}
            <div>
              <label className="block text-xs font-semibold text-[#3aafc9] mb-1.5">
                Figma Access Token
              </label>
              {figmaToken ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  <span className="text-sm text-[#5C4A28] font-['Noto_Sans_JP']">
                    設定済み ({figmaToken.slice(0, 10)}...)
                  </span>
                  <button
                    onClick={() => navigate("/settings")}
                    className="text-xs text-[#3aafc9] hover:underline font-['Noto_Sans_JP'] ml-auto"
                  >
                    変更
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                  <p className="text-[13px] text-amber-700 font-['Noto_Sans_JP']">
                    Figma アクセストークンが設定されていません。
                    <button
                      onClick={() => navigate("/settings")}
                      className="ml-1 text-[#3aafc9] font-bold hover:underline"
                    >
                      環境設定で入力してください →
                    </button>
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-[#8B6914]/70 mb-1 font-['Noto_Sans_JP']">
                Figma ファイル URL
              </label>
              <input
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/XXXX/..."
                className={inputClass}
              />
              {fileKey && (
                <p className="text-xs text-[#3aafc9] mt-1 font-mono">
                  File Key: {fileKey}
                </p>
              )}
            </div>

            <button
              onClick={fetchStructure}
              disabled={!figmaToken || !fileKey || loadingStructure}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9]
                         text-white text-sm font-['Noto_Sans_JP'] shadow-md
                         hover:shadow-lg transition-all active:scale-95
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingStructure ? "取得中..." : "ページ一覧を取得"}
            </button>
          </div>
        </motion.section>

        {/* ═══ Design Type Selection ═══ */}
        <AnimatePresence>
          {pages.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
            >
              <h2 className="text-base font-bold text-[#5C4A28] mb-4 font-['Noto_Serif_JP']">
                デザインの種類を選択
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Web デザイン */}
                <button
                  onClick={() => {
                    setImportType("web");
                    setSelectedFrame(null);
                    setExtractedDna(null);
                    setExtractResult(null);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    importType === "web"
                      ? "border-[#3aafc9] bg-[#3aafc9]/5 shadow-sm"
                      : "border-[#E8D5B0]/50 bg-white/60 hover:border-[#3aafc9]/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🖥</span>
                    <p className={`text-sm font-bold font-['Noto_Sans_JP'] ${importType === "web" ? "text-[#3aafc9]" : "text-[#5C4A28]"}`}>
                      Web デザイン
                    </p>
                  </div>
                  <p className="text-[12px] text-[#8B6914]/60 font-['Noto_Sans_JP']">
                    PC用とSP用のフレームをそれぞれ指定して保存
                  </p>
                </button>
                {/* グラフィック */}
                <button
                  onClick={() => {
                    setImportType("graphic");
                    setPcFrame(null);
                    setSpFrame(null);
                    setExtractedDna(null);
                    setExtractResult(null);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    importType === "graphic"
                      ? "border-[#f59e0b] bg-[#f59e0b]/5 shadow-sm"
                      : "border-[#E8D5B0]/50 bg-white/60 hover:border-[#f59e0b]/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🎨</span>
                    <p className={`text-sm font-bold font-['Noto_Sans_JP'] ${importType === "graphic" ? "text-[#f59e0b]" : "text-[#5C4A28]"}`}>
                      グラフィック
                    </p>
                  </div>
                  <p className="text-[12px] text-[#8B6914]/60 font-['Noto_Sans_JP']">
                    単一のマスター画像として保存
                  </p>
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ═══ Page Selection ═══ */}
        <AnimatePresence>
          {pages.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
            >
              <h2 className="text-base font-bold text-[#5C4A28] mb-4 font-['Noto_Serif_JP']">
                ページを選択
              </h2>
              <p className="text-xs text-[#8B6914]/50 mb-3 font-['Noto_Sans_JP']">
                {pages.length} ページ見つかりました — インポートするページを選んでください
              </p>

              <div className="flex flex-wrap gap-2">
                {pages.map((page) => {
                  const isActive = selectedPage?.id === page.id;
                  const frameCount = page.children?.length || 0;
                  return (
                    <button
                      key={page.id}
                      onClick={() => handleSelectPage(page)}
                      className={`px-4 py-2.5 rounded-xl border text-left transition-all ${
                        isActive
                          ? "border-[#3aafc9] bg-[#3aafc9]/10 shadow-sm"
                          : "border-[#E8D5B0]/50 bg-white/60 hover:border-[#3aafc9]/40 hover:bg-white/80"
                      }`}
                    >
                      <p
                        className={`text-sm font-medium font-['Noto_Sans_JP'] ${
                          isActive ? "text-[#3aafc9]" : "text-[#5C4A28]"
                        }`}
                      >
                        {page.name}
                      </p>
                      <p className="text-[12px] text-[#8B6914]/50 mt-0.5">
                        {frameCount} フレーム
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ═══ Frame List ═══ */}
        <AnimatePresence>
          {selectedPage && currentFrames.length > 0 && (
            <motion.section
              key={selectedPage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#8B6914]/70 font-['Noto_Sans_JP']">
                  「{selectedPage.name}」— {currentFrames.length} フレーム
                </p>
              </div>

              {/* Device mode toggle (Web mode only) */}
              {importType === "web" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8B6914]/60 font-['Noto_Sans_JP']">割り当て先:</span>
                  <div className="flex rounded-lg border border-[#E8D5B0]/50 overflow-hidden">
                    <button
                      onClick={() => setDeviceMode("pc")}
                      className={`px-4 py-1.5 text-[12px] font-semibold transition-all ${
                        deviceMode === "pc"
                          ? "bg-[#3aafc9] text-white"
                          : "text-[#8A7E6B] hover:bg-[#E8D5B0]/20"
                      }`}
                    >
                      PC用
                    </button>
                    <button
                      onClick={() => setDeviceMode("sp")}
                      className={`px-4 py-1.5 text-[12px] font-semibold transition-all ${
                        deviceMode === "sp"
                          ? "bg-[#f59e0b] text-white"
                          : "text-[#8A7E6B] hover:bg-[#E8D5B0]/20"
                      }`}
                    >
                      SP用
                    </button>
                  </div>
                  <span className="text-[11px] text-[#8B6914]/40 font-['Noto_Sans_JP'] ml-2">
                    フレームをクリックして {deviceMode === "pc" ? "PC" : "SP"} 用に割り当て
                  </span>
                </div>
              )}

              <div className="flex gap-6">
                {/* Left: Frame list */}
                <div className="w-[360px] flex-shrink-0 space-y-1.5 max-h-[600px] overflow-y-auto pr-2">
                  {currentFrames.map((frame) => {
                    const highlight = getFrameHighlight(frame);
                    const borderMap = {
                      selected: "border-[#3aafc9] bg-[#3aafc9]/5 shadow-sm",
                      pc: "border-[#3aafc9] bg-[#3aafc9]/5 shadow-sm",
                      sp: "border-[#f59e0b] bg-[#f59e0b]/5 shadow-sm",
                      both: "border-[#7c3aed] bg-[#7c3aed]/5 shadow-sm",
                    };

                    return (
                      <motion.button
                        key={frame.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectFrame(frame)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                          highlight
                            ? borderMap[highlight]
                            : "border-[#E8D5B0]/50 bg-white/50 hover:border-[#3aafc9]/40 hover:bg-white/80"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#5C4A28] truncate font-['Noto_Sans_JP']">
                            {frame.name}
                          </p>
                          <p className="text-[12px] text-[#8B6914]/50 font-mono">
                            {frame.type}
                          </p>
                        </div>
                        {/* Device badges (Web mode) */}
                        {importType === "web" && (
                          <div className="flex gap-1 flex-shrink-0">
                            {pcFrame?.id === frame.id && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3aafc9] text-white">PC</span>
                            )}
                            {spFrame?.id === frame.id && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b] text-white">SP</span>
                            )}
                          </div>
                        )}
                        {/* Graphic mode indicator */}
                        {importType === "graphic" && highlight === "selected" && (
                          <div className="w-5 h-5 rounded-full bg-[#3aafc9] text-white flex items-center justify-center text-[12px] flex-shrink-0">
                            ✓
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Right: Preview & Actions */}
                <div className="flex-1 sticky top-24 self-start">
                  <div className="rounded-2xl border border-[#E8D5B0]/50 bg-white/50 overflow-hidden">

                    {/* ── Web mode: dual slot preview ── */}
                    {importType === "web" && (
                      <>
                        <div className="p-4 space-y-3">
                          {/* PC slot */}
                          <div className={`rounded-xl border-2 p-3 transition-all ${pcFrame ? "border-[#3aafc9]/40 bg-[#3aafc9]/5" : "border-dashed border-[#E8D5B0] bg-[#F5E6C8]/20"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3aafc9] text-white">PC</span>
                              <span className="text-xs font-semibold text-[#5C4A28] font-['Noto_Sans_JP']">
                                {pcFrame ? pcFrame.name : "未選択"}
                              </span>
                            </div>
                            {pcFrame && thumbnails[pcFrame.id] ? (
                              <img src={thumbnails[pcFrame.id]} alt={pcFrame.name} className="w-full h-32 object-contain rounded-lg bg-white" />
                            ) : pcFrame ? (
                              <div className="w-full h-20 flex items-center justify-center text-xs text-[#8B6914]/40 font-['Noto_Sans_JP']">
                                サムネイル読込中...
                              </div>
                            ) : (
                              <div className="w-full h-20 flex items-center justify-center text-xs text-[#8B6914]/40 font-['Noto_Sans_JP']">
                                左のリストから PC 用フレームを選択
                              </div>
                            )}
                          </div>

                          {/* SP slot */}
                          <div className={`rounded-xl border-2 p-3 transition-all ${spFrame ? "border-[#f59e0b]/40 bg-[#f59e0b]/5" : "border-dashed border-[#E8D5B0] bg-[#F5E6C8]/20"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b] text-white">SP</span>
                              <span className="text-xs font-semibold text-[#5C4A28] font-['Noto_Sans_JP']">
                                {spFrame ? spFrame.name : "未選択（オプション）"}
                              </span>
                            </div>
                            {spFrame && thumbnails[spFrame.id] ? (
                              <img src={spFrame ? thumbnails[spFrame.id] : null} alt={spFrame?.name} className="w-full h-32 object-contain rounded-lg bg-white" />
                            ) : spFrame ? (
                              <div className="w-full h-20 flex items-center justify-center text-xs text-[#8B6914]/40 font-['Noto_Sans_JP']">
                                サムネイル読込中...
                              </div>
                            ) : (
                              <div className="w-full h-20 flex items-center justify-center text-xs text-[#8B6914]/40 font-['Noto_Sans_JP']">
                                左のリストから SP 用フレームを選択
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-4 pb-4">
                          {!extractResult ? (
                            <button
                              onClick={extractPairedDna}
                              disabled={!pcFrame || loadingDna}
                              className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9]
                                         text-white text-sm font-['Noto_Sans_JP'] shadow-md
                                         hover:shadow-lg transition-all active:scale-95
                                         disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingDna ? "デザイン抽出中..." : "デザインを抽出"}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3aafc9]/10 border border-[#3aafc9]/30">
                                <span className="text-[#3aafc9] text-sm">&#10003;</span>
                                <p className="text-xs text-[#3aafc9] font-['Noto_Sans_JP']">
                                  抽出完了 — PC: {extractResult.pcCount} 要素{extractResult.spCount > 0 ? ` / SP: ${extractResult.spCount} 要素` : ""}
                                </p>
                              </div>
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-['Noto_Sans_JP'] ${masterImageSaved ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                                <span>{masterImageSaved ? "&#10003;" : "!"}</span>
                                <p>{masterImageSaved ? "マスター画像: 保存済み" : "マスター画像: 取得失敗"}</p>
                              </div>
                              <div>
                                <label className="block text-xs text-[#8B6914]/70 mb-1 font-['Noto_Sans_JP']">保存名</label>
                                <input
                                  type="text"
                                  value={saveName}
                                  onChange={(e) => setSaveName(e.target.value)}
                                  placeholder="デザイン名を入力..."
                                  className="w-full px-3 py-2 rounded-xl border border-[#E8D5B0]/50 bg-white/80 text-sm text-[#5C4A28] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30 font-['Noto_Sans_JP']"
                                />
                              </div>
                              <button
                                onClick={async () => {
                                  if (savedDnaId && saveName) {
                                    try {
                                      await fetch(`/api/dna/${savedDnaId}/name`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ name: saveName }),
                                      });
                                    } catch {}
                                  }
                                  setToast("ライブラリに保存しました");
                                  setTimeout(() => setToast(""), 2000);
                                }}
                                className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706]
                                           text-white text-sm font-['Noto_Sans_JP'] shadow-md
                                           hover:shadow-lg transition-all active:scale-95"
                              >
                                このデザインを保存する
                              </button>
                              <button
                                onClick={() => navigate("/library")}
                                className="w-full px-6 py-2.5 rounded-xl border border-[#E8D5B0]/50 bg-white/60
                                           text-sm text-[#8B6914] font-['Noto_Sans_JP']
                                           hover:bg-[#f59e0b]/10 hover:border-[#f59e0b]/30 transition-all active:scale-95"
                              >
                                ライブラリ一覧を見る →
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ── Graphic mode: single frame preview ── */}
                    {importType === "graphic" && (
                      <>
                        {selectedFrame ? (
                          <>
                            <div className="aspect-[16/9] bg-[#F5E6C8]/30 flex items-center justify-center overflow-hidden">
                              {thumbnails[selectedFrame.id] ? (
                                <img
                                  src={thumbnails[selectedFrame.id]}
                                  alt={selectedFrame.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : loadingThumb === selectedFrame.id ? (
                                <p className="text-xs text-[#8B6914]/50 animate-pulse font-['Noto_Sans_JP']">
                                  プレビュー読込中...
                                </p>
                              ) : (
                                <span className="text-5xl opacity-20">🖼</span>
                              )}
                            </div>
                            <div className="p-4 border-t border-[#E8D5B0]/30">
                              <h3 className="text-sm font-bold text-[#5C4A28] font-['Noto_Serif_JP']">
                                {selectedFrame.name}
                              </h3>
                              <p className="text-[12px] text-[#8B6914]/50 font-mono mt-0.5">
                                {selectedFrame.type} — ID: {selectedFrame.id}
                              </p>
                              {!extractedDna ? (
                                <button
                                  onClick={extractFrameDna}
                                  disabled={loadingDna}
                                  className="mt-4 w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9]
                                             text-white text-sm font-['Noto_Sans_JP'] shadow-md
                                             hover:shadow-lg transition-all active:scale-95
                                             disabled:opacity-50"
                                >
                                  {loadingDna
                                    ? "デザイン抽出中..."
                                    : `「${selectedFrame.name}」をグラフィックとして抽出`}
                                </button>
                              ) : (
                                <div className="mt-4 space-y-2">
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3aafc9]/10 border border-[#3aafc9]/30">
                                    <span className="text-[#3aafc9] text-sm">&#10003;</span>
                                    <p className="text-xs text-[#3aafc9] font-['Noto_Sans_JP']">
                                      デザインを抽出しました（{extractedDna.length} 要素）
                                    </p>
                                  </div>
                                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-['Noto_Sans_JP'] ${masterImageSaved ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                                    <span>{masterImageSaved ? "&#10003;" : "!"}</span>
                                    <p>{masterImageSaved ? "マスター画像: 保存済み（高解像度）" : "マスター画像: 取得失敗（DOM プレビューで表示）"}</p>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[#8B6914]/70 mb-1 font-['Noto_Sans_JP']">保存名</label>
                                    <input
                                      type="text"
                                      value={saveName}
                                      onChange={(e) => setSaveName(e.target.value)}
                                      placeholder="デザイン名を入力..."
                                      className="w-full px-3 py-2 rounded-xl border border-[#E8D5B0]/50 bg-white/80 text-sm text-[#5C4A28] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30 font-['Noto_Sans_JP']"
                                    />
                                  </div>
                                  <button
                                    onClick={async () => {
                                      if (savedDnaId && saveName) {
                                        try {
                                          await fetch(`/api/dna/${savedDnaId}/name`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                            body: JSON.stringify({ name: saveName }),
                                          });
                                        } catch {}
                                      }
                                      setToast("ライブラリに保存しました");
                                      setTimeout(() => setToast(""), 2000);
                                    }}
                                    className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706]
                                               text-white text-sm font-['Noto_Sans_JP'] shadow-md
                                               hover:shadow-lg transition-all active:scale-95"
                                  >
                                    このデザインを保存する
                                  </button>
                                  <button
                                    onClick={() => navigate("/library")}
                                    className="w-full px-6 py-2.5 rounded-xl border border-[#E8D5B0]/50 bg-white/60
                                               text-sm text-[#8B6914] font-['Noto_Sans_JP']
                                               hover:bg-[#f59e0b]/10 hover:border-[#f59e0b]/30 transition-all active:scale-95"
                                  >
                                    ライブラリ一覧を見る →
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="aspect-[16/9] flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-3xl mb-2 opacity-30">👈</p>
                              <p className="text-xs text-[#8B6914]/50 font-['Noto_Sans_JP']">
                                フレームを選択してプレビュー
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl
                       bg-[#5C4A28] text-white text-sm font-['Noto_Sans_JP'] shadow-lg z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
