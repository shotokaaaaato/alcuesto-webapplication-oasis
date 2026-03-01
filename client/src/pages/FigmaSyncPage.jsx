import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import FigmaTokenInput from "../components/FigmaTokenInput";

/**
 * Figma URL から FILE_KEY を抽出
 */
function extractFileKey(input) {
  if (!input) return "";
  const match = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : input.trim();
}

export default function FigmaSyncPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  // Figma接続
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [fileName, setFileName] = useState("");
  const [validating, setValidating] = useState(false);

  // デザインソース
  const [dnaLibrary, setDnaLibrary] = useState([]);
  const [selectedDnaId, setSelectedDnaId] = useState("");

  // プレビュー
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Plugin トークンコピー
  const [tokenCopied, setTokenCopied] = useState(false);

  const [error, setError] = useState("");

  // デザインライブラリを取得
  useEffect(() => {
    fetch("/api/dna/library", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const list = data.data || [];
        setDnaLibrary(list);
        if (list.length > 0) {
          setSelectedDnaId(list[list.length - 1].id);
        }
      })
      .catch(() => {});
  }, [token]);

  // Figma接続確認
  async function handleValidate() {
    setError("");
    const fileKey = extractFileKey(figmaUrl);
    if (!figmaToken || !fileKey) {
      setError("アクセストークンとファイルURLを入力してください");
      return;
    }
    setValidating(true);
    try {
      const res = await fetch("/api/figma/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accessToken: figmaToken, fileKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnected(true);
      setFileName(data.fileName);
    } catch (err) {
      setError(err.message);
      setConnected(false);
      setFileName("");
    } finally {
      setValidating(false);
    }
  }

  // プレビュー読み込み
  async function handlePreview() {
    setError("");
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/figma/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dnaId: selectedDnaId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  // JWTトークンをコピー（Plugin用）
  function handleCopyToken() {
    navigator.clipboard.writeText(token).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#C49A6C]/60 focus:outline-none focus:ring-2 focus:ring-[#a259ff]/40 focus:border-[#a259ff]/40 transition-all";

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
    >
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="text-xl font-bold text-[#8B6914] tracking-widest"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              OASIS
            </h1>
            <span className="text-[12px] text-[#C49A6C] tracking-wide border-l border-[#D4A76A]/30 pl-3">
              Figma 連携
            </span>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-[#8B6914]/60 hover:text-[#8B6914] transition-colors"
          >
            &larr; ダッシュボード
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* タイトル */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-bold text-[#5A4E3A]">Figma 連携</h2>
          <p className="text-sm text-[#8A7E6B] mt-1">
            抽出したデザイントークンをFigma Local Styles（塗り・テキスト）として登録します
          </p>
        </motion.div>

        {/* エラー */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Step 1: Figma接続確認 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h3 className="text-sm font-semibold text-[#a259ff] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-xs flex items-center justify-center font-bold">
              1
            </span>
            Figma 接続確認
          </h3>

          <div className="space-y-3">
            <FigmaTokenInput
              value={figmaToken}
              onChange={setFigmaToken}
              inputClass={inputClass}
              accentColor="#a259ff"
            />

            <div>
              <label className="block text-xs text-[#8A7E6B] mb-1">
                ファイルURL / FILE_KEY
              </label>
              <input
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/VJFFAY..."
                className={inputClass}
              />
              {!figmaUrl && (
                <div className="mt-2 space-y-1">
                  <p className="text-[12px] text-[#8A7E6B] flex items-start gap-1.5">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#a259ff]/10 text-[#a259ff] text-[12px] font-bold flex-shrink-0 mt-0.5">1</span>
                    Figma 右上の「共有」ボタンをクリック
                  </p>
                  <p className="text-[12px] text-[#8A7E6B] flex items-start gap-1.5">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#a259ff]/10 text-[#a259ff] text-[12px] font-bold flex-shrink-0 mt-0.5">2</span>
                    「リンクをコピー」をクリック
                  </p>
                  <p className="text-[12px] text-[#8A7E6B] flex items-start gap-1.5">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#a259ff]/10 text-[#a259ff] text-[12px] font-bold flex-shrink-0 mt-0.5">3</span>
                    この入力欄にそのまま貼り付け
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleValidate}
                disabled={validating || !figmaToken || !figmaUrl}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white text-sm font-semibold tracking-wider shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {validating ? "確認中..." : "接続を確認"}
              </button>

              {connected && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sm text-emerald-600"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {fileName}
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {/* Step 2: デザインソース選択 + プレビュー */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h3 className="text-sm font-semibold text-[#a259ff] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-xs flex items-center justify-center font-bold">
              2
            </span>
            デザインソース選択
          </h3>

          {dnaLibrary.length === 0 ? (
            <p className="text-sm text-[#C49A6C]">
              保存されたデザインデータがありません。先にデザイン採取を実行してください。
            </p>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedDnaId}
                onChange={(e) => setSelectedDnaId(e.target.value)}
                className={inputClass}
              >
                {dnaLibrary.map((dna) => (
                  <option key={dna.id} value={dna.id}>
                    {dna.url} ({dna.elementCount}要素) —{" "}
                    {new Date(dna.savedAt).toLocaleDateString("ja-JP")}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreview}
                disabled={loadingPreview || !selectedDnaId}
                className="px-5 py-2.5 rounded-xl border-2 border-[#a259ff]/30 text-[#a259ff] text-sm font-semibold tracking-wider hover:bg-[#a259ff]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingPreview ? "読み込み中..." : "プレビュー"}
              </button>
            </div>
          )}
        </motion.section>

        {/* Step 3: プレビュー */}
        {preview && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
          >
            <h3 className="text-sm font-semibold text-[#a259ff] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              同期プレビュー
            </h3>

            {/* カラー (Paint Styles) */}
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-[#5A4E3A] mb-2">
                Paint Styles ({preview.colors.length})
              </h4>
              {preview.colors.length === 0 ? (
                <p className="text-xs text-[#C49A6C]">カラーなし</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {preview.colors.map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className="w-10 h-10 rounded-lg border border-[#E8D5B0]/50 shadow-sm"
                        style={{ backgroundColor: c.cssValue }}
                      />
                      <span className="text-[12px] text-[#8A7E6B] max-w-[60px] truncate text-center">
                        {c.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* タイポグラフィ (Text Styles) */}
            <div>
              <h4 className="text-xs font-semibold text-[#5A4E3A] mb-2">
                Text Styles ({preview.typography.length})
              </h4>
              {preview.typography.length === 0 ? (
                <p className="text-xs text-[#C49A6C]">タイポグラフィなし</p>
              ) : (
                <div className="space-y-2">
                  {preview.typography.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-3 py-2 rounded-lg bg-white/40 border border-[#E8D5B0]/30"
                    >
                      <span
                        className="text-lg text-[#5A4E3A]"
                        style={{
                          fontFamily: t.fontFamily,
                          fontWeight: t.fontWeight,
                          fontSize: t.fontSize
                            ? `${Math.min(t.fontSize, 24)}px`
                            : "16px",
                        }}
                      >
                        Aa
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#5A4E3A] truncate">
                          {t.fontFamily} {t.fontStyle}
                        </p>
                        <p className="text-[12px] text-[#8A7E6B]">
                          {t.fontSize}px / weight {t.fontWeight}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Step 4: Figma Plugin で同期 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h3 className="text-sm font-semibold text-[#a259ff] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-xs flex items-center justify-center font-bold">
              4
            </span>
            Figma Plugin で同期
          </h3>

          <div className="space-y-4">
            {/* 説明 */}
            <div className="p-4 rounded-xl bg-[#f3e8ff]/50 border border-[#a259ff]/20">
              <p className="text-xs text-[#5A4E3A] leading-relaxed">
                Local Styles（塗りスタイル・テキストスタイル）の作成には
                Figma Plugin API が必要です。以下の手順で同期してください:
              </p>
              <ol className="mt-3 space-y-2 text-xs text-[#5A4E3A]">
                <li className="flex gap-2">
                  <span className="font-bold text-[#a259ff] flex-shrink-0">1.</span>
                  <span>
                    Figma デスクトップアプリで対象ファイルを開く
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#a259ff] flex-shrink-0">2.</span>
                  <span>
                    プラグイン &gt; 開発 &gt; マニフェストからプラグインをインポート
                    &gt; <code className="bg-white/60 px-1 rounded text-[12px]">apps/figma-sync/plugin/manifest.json</code> を選択
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#a259ff] flex-shrink-0">3.</span>
                  <span>
                    Plugin UI に下記トークンを貼り付けて「Figma に同期」を実行
                  </span>
                </li>
              </ol>
            </div>

            {/* Plugin 用認証トークン */}
            <div>
              <label className="block text-xs text-[#8A7E6B] mb-1">
                Plugin用 認証トークン (JWT)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={token ? `${token.slice(0, 20)}...` : ""}
                  className={`${inputClass} flex-1 font-mono text-[12px]`}
                />
                <button
                  onClick={handleCopyToken}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white text-xs font-semibold tracking-wider shadow-lg hover:shadow-xl transition-all flex-shrink-0"
                >
                  {tokenCopied ? "コピー済み" : "コピー"}
                </button>
              </div>
              <p className="text-[12px] text-[#C49A6C] mt-1">
                Figma Plugin の「認証トークン」フィールドにペーストしてください
              </p>
            </div>

            {/* 補足情報 */}
            <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/50">
              <p className="text-[12px] text-amber-700 leading-relaxed">
                <strong>スタイル名が重複する場合：</strong>
                既存のスタイルを自動で上書き更新します（新規作成されません）。
                <br />
                <strong>対応プラン：</strong>
                Figma Starter / Professional / Organization / Enterprise（全プラン対応）
              </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
