import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import CircularProgress from "../components/CircularProgress";

const VIEWPORT_META = {
  sp: { label: "SP", width: "375px", color: "bg-[#ef4444]", borderColor: "border-[#ef4444]" },
  tablet: { label: "Tablet", width: "768px", color: "bg-[#a259ff]", borderColor: "border-[#a259ff]" },
  pc: { label: "PC", width: "1440px", color: "bg-[#3aafc9]", borderColor: "border-[#3aafc9]" },
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-[#E8D5B0]/50 bg-white/80 text-sm text-[#5C4A28] placeholder:text-[#C4A97D]/50 focus:outline-none focus:ring-2 focus:ring-[#3aafc9]/30 focus:border-transparent font-['Noto_Sans_JP']";

export default function UrlImportPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // 管理者チェック
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  // ── State ──
  const [consent, setConsent] = useState(false);
  const [url, setUrl] = useState("");
  const [viewports, setViewports] = useState({ sp: true, tablet: true, pc: true });
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [selectedViewports, setSelectedViewports] = useState([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // 円形プログレス用 (scan / save 共用)
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressSub, setProgressSub] = useState("");

  // トースト自動消去
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Content-Type 検証付き fetch ──
  async function safeFetchJson(fetchUrl, options) {
    const response = await fetch(fetchUrl, options);
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = (await response.text()).slice(0, 200);
      return {
        ok: false,
        status: response.status,
        data: {
          error: `サーバーエラー (${response.status}): JSON 以外のレスポンスが返されました — ${text}`,
        },
      };
    }

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  }

  // ── スキャン実行（1 ビューポートずつ逐次スキャン） ──
  async function handleScan() {
    if (!url.trim()) return;
    setError("");
    setScanResults(null);
    setSelectedViewports([]);
    setSavedId(null);
    setScanning(true);
    setProgress(0);
    setProgressLabel("");
    setProgressSub("");

    const activeViewports = Object.entries(viewports)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (activeViewports.length === 0) {
      setError("ビューポートを 1 つ以上選択してください");
      setScanning(false);
      return;
    }

    const merged = {};

    try {
      for (let i = 0; i < activeViewports.length; i++) {
        const key = activeViewports[i];
        const meta = VIEWPORT_META[key];

        setProgress(Math.round((i / activeViewports.length) * 100));
        setProgressLabel(`${meta.label} (${meta.width}) をスキャン中...`);
        setProgressSub(`${i + 1} / ${activeViewports.length} ビューポート`);

        const result = await safeFetchJson("/api/url-import/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: url.trim(), viewports: [key] }),
        });

        if (!result.ok) throw new Error(result.data?.error || "スキャンに失敗しました");

        Object.assign(merged, result.data.scanResults);
      }

      setProgress(100);
      setProgressLabel("完了");
      setProgressSub("");

      setScanResults(merged);
      setSelectedViewports(Object.keys(merged));
      setSaveName(url.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      // 少し待ってから 100% 表示を見せる
      await new Promise((r) => setTimeout(r, 400));
      setScanning(false);
      setProgress(0);
      setProgressLabel("");
      setProgressSub("");
    }
  }

  // ── 保存実行（1 デバイスずつ逐次保存） ──
  async function handleSave() {
    if (!scanResults || selectedViewports.length === 0) return;
    setSaving(true);
    setError("");
    setProgress(0);
    setProgressLabel("");
    setProgressSub("");

    const priorityOrder = ["pc", "tablet", "sp"];
    const sorted = [...selectedViewports].sort(
      (a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b)
    );

    let recordId = null;

    try {
      for (let i = 0; i < sorted.length; i++) {
        const key = sorted[i];
        const data = scanResults[key];
        if (!data) continue;

        const meta = VIEWPORT_META[key];
        setProgress(Math.round((i / sorted.length) * 100));
        setProgressLabel(`${meta.label} を保存中...`);
        setProgressSub(`${i + 1} / ${sorted.length} デバイス`);

        const body = {
          viewportKey: key,
          elements: data.elements,
          masterImage: data.masterImage || null,
        };

        if (recordId) {
          body.recordId = recordId;
        } else {
          body.url = url.trim();
          body.name = saveName.trim() || url.trim();
        }

        const result = await safeFetchJson("/api/url-import/save-device", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!result.ok) {
          throw new Error(
            result.data?.error || `${meta.label} の保存に失敗しました`
          );
        }

        if (!recordId) {
          recordId = result.data.savedId;
        }
      }

      setProgress(100);
      setProgressLabel("保存完了");
      setProgressSub("");

      await new Promise((r) => setTimeout(r, 400));
      setSavedId(recordId);
      setToast("デザインライブラリに保存しました");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setProgress(0);
      setProgressLabel("");
      setProgressSub("");
    }
  }

  // ── ビューポート選択トグル ──
  function toggleSelectedViewport(key) {
    setSelectedViewports((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // ── 処理中判定 ──
  const isBusy = scanning || saving;

  // ── レンダリング ──
  if (!user || user.role !== "admin") return null;

  return (
    <div
      className="min-h-screen w-screen bg-gradient-to-b from-[#FAF3E6] to-[#F5E6C8]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}
    >
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-[#8B6914]/60 hover:text-[#8B6914] text-sm transition-colors"
            >
              &larr; ダッシュボード
            </button>
            <span className="text-[#D4A76A]/30">|</span>
            <h1
              className="text-lg font-bold text-[#8B6914] tracking-wider"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              URL インポート
            </h1>
          </div>
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#FFD700]/20 text-[#8B6914] border border-[#FFD700]/40 tracking-wider">
            ADMIN
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ── 著作権注意 ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-5"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">&#9888;&#65039;</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[#92400e] mb-2">
                著作権に関する注意
              </h3>
              <p className="text-xs text-[#92400e]/80 leading-relaxed mb-3">
                この機能は、著作権を保持しているサイト、または正当な許諾を得たサイトのみに使用してください。
                第三者のデザインを無断で抽出・再利用することは著作権侵害に該当する場合があります。
                すべての責任はユーザーに帰属します。
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E8D5B0] text-[#f59e0b] focus:ring-[#f59e0b]/30"
                />
                <span className="text-xs text-[#92400e] font-medium">
                  上記に同意し、自己責任で使用します
                </span>
              </label>
            </div>
          </div>
        </motion.div>

        {/* ── URL 入力 ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl bg-white/50 border border-[#E8D5B0]/50 p-6 space-y-4 ${
            !consent ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <div>
            <label className="block text-xs text-[#8A7E6B] mb-1.5 font-medium">
              対象 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputClass}
              disabled={!consent}
            />
          </div>

          {/* ビューポート選択 */}
          <div>
            <label className="block text-xs text-[#8A7E6B] mb-2 font-medium">
              スキャン対象ビューポート
            </label>
            <div className="flex gap-3">
              {Object.entries(VIEWPORT_META).map(([key, meta]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={viewports[key]}
                    onChange={(e) =>
                      setViewports((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-[#E8D5B0] text-[#3aafc9] focus:ring-[#3aafc9]/30"
                    disabled={!consent}
                  />
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-[#8A7E6B]">{meta.width}</span>
                </label>
              ))}
            </div>
          </div>

          {/* スキャンボタン */}
          <button
            onClick={handleScan}
            disabled={!consent || !url.trim() || isBusy}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3aafc9] to-[#2a8fa9] text-white text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? "スキャン中..." : "スキャン開始"}
          </button>
        </motion.div>

        {/* ── エラー表示 ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 処理中オーバーレイ (スキャン / 保存 共通) ── */}
        <AnimatePresence>
          {isBusy && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl bg-white/70 backdrop-blur border border-[#E8D5B0]/50 py-12 px-6 flex flex-col items-center"
            >
              <CircularProgress
                progress={progress}
                size={140}
                strokeWidth={10}
                label={progressLabel}
                sublabel={progressSub}
                accentFrom={saving ? "#f59e0b" : "#3aafc9"}
                accentTo={saving ? "#d97706" : "#2a8fa9"}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── スキャン結果カード ── */}
        <AnimatePresence>
          {scanResults && !scanning && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h2 className="text-sm font-bold text-[#5C4A28]">
                スキャン結果
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(scanResults).map(([key, data], idx) => {
                  const meta = VIEWPORT_META[key];
                  const isSelected = selectedViewports.includes(key);
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => toggleSelectedViewport(key)}
                      className={`rounded-2xl border-2 bg-white/60 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                        isSelected
                          ? `${meta.borderColor} shadow-md`
                          : "border-[#E8D5B0]/50"
                      }`}
                    >
                      {/* ヘッダーバッジ */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8D5B0]/30">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs text-[#8A7E6B]">
                            {meta.width}
                          </span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? `${meta.color} border-transparent`
                              : "border-[#D4A76A]/40 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* スクリーンショット */}
                      {data.masterImage?.url ? (
                        <div className="bg-[#f8f4ed] p-2">
                          <img
                            src={data.masterImage.url}
                            alt={`${meta.label} preview`}
                            className="w-full max-h-[300px] object-contain object-top rounded-lg border border-[#E8D5B0]/30"
                          />
                        </div>
                      ) : (
                        <div className="h-[200px] bg-[#f8f4ed] flex items-center justify-center text-[#C4A97D] text-xs">
                          スクリーンショットなし
                        </div>
                      )}

                      {/* 情報 */}
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="text-xs text-[#5C4A28]">
                          <span className="font-bold">{data.elementCount}</span>{" "}
                          要素 (階層構造)
                        </div>
                        {data.masterImage && (
                          <div className="text-[10px] text-[#8A7E6B]">
                            {data.masterImage.width} &times;{" "}
                            {data.masterImage.height}px
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── 保存セクション ── */}
              {selectedViewports.length > 0 && !saving && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-white/50 border border-[#E8D5B0]/50 p-6 space-y-4"
                >
                  <h3 className="text-sm font-bold text-[#5C4A28]">
                    ライブラリに保存
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-[#8A7E6B]">
                    <span>保存対象:</span>
                    {selectedViewports.map((key) => (
                      <span
                        key={key}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${VIEWPORT_META[key].color}`}
                      >
                        {VIEWPORT_META[key].label}
                      </span>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-[#8A7E6B] mb-1.5 font-medium">
                      デザイン名
                    </label>
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="デザイン名を入力"
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving || !!savedId}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savedId ? "保存済み" : "ライブラリに保存"}
                    </button>

                    {savedId && (
                      <button
                        onClick={() => navigate("/library")}
                        className="px-4 py-2.5 rounded-xl border border-[#E8D5B0]/50 bg-white/60 text-sm text-[#8B6914] hover:bg-[#f59e0b]/10 hover:border-[#f59e0b]/30 transition-all active:scale-95"
                      >
                        ライブラリ一覧を見る &rarr;
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── トースト ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-xl bg-[#1a1a2e]/90 text-white text-sm shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
