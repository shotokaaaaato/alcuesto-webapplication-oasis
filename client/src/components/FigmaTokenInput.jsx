import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "oasis_figma_token";

function encodeToken(token) {
  return btoa(unescape(encodeURIComponent(token)));
}

function decodeToken(encoded) {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return "";
  }
}

/**
 * Figma Access Token 入力コンポーネント
 * - localStorage 永続化（base64 エンコード）
 * - figd_ プレフィックスバリデーション
 * - 取得方法ヘルプモーダル
 */
export default function FigmaTokenInput({
  value,
  onChange,
  inputClass,
  accentColor = "#3aafc9",
}) {
  const [showHelp, setShowHelp] = useState(false);
  const initialized = useRef(false);

  // mount 時に localStorage から復元
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const decoded = decodeToken(stored);
      if (decoded) onChange(decoded);
    }
  }, [onChange]);

  // 値変更時に localStorage へ保存
  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    if (v) {
      localStorage.setItem(STORAGE_KEY, encodeToken(v));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const isValid = !value || value.startsWith("figd_");

  const steps = [
    {
      num: 1,
      title: "Figma にログイン",
      desc: "https://www.figma.com にアクセスし、アカウントにログインします。",
    },
    {
      num: 2,
      title: "Settings を開く",
      desc: "左上のプロフィールアイコン → Settings を選択します。",
    },
    {
      num: 3,
      title: "Security タブを選択",
      desc: '設定画面の「Security」タブをクリックします。',
    },
    {
      num: 4,
      title: "Personal access tokens セクション",
      desc: '下部の「Personal access tokens」セクションで「Generate new token」をクリックします。',
    },
    {
      num: 5,
      title: "トークンを設定",
      desc: 'Token名（例: "OASIS"）を入力し、スコープで「File content」→ Read only を選択して Generate token をクリック。',
    },
    {
      num: 6,
      title: "トークンをコピー",
      desc: "表示された figd_ で始まるトークンを即座にコピーしてください。一度閉じると再表示できません。",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label
          className="block text-xs font-semibold"
          style={{ color: accentColor }}
        >
          Figma Access Token
        </label>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="text-[12px] font-semibold flex items-center gap-1 hover:underline transition-all"
          style={{ color: accentColor }}
        >
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[12px] font-bold" style={{ borderColor: accentColor }}>
            ?
          </span>
          取得方法
        </button>
      </div>

      <input
        type="password"
        value={value}
        onChange={handleChange}
        placeholder="figd_..."
        className={inputClass}
      />

      {!isValid && (
        <p className="text-[12px] text-amber-600 mt-1">
          Figma Access Token は通常 &quot;figd_&quot; で始まります
        </p>
      )}

      {isValid && value && (
        <p className="text-[12px] mt-1" style={{ color: accentColor }}>
          Token 保存済み（次回自動入力されます）
        </p>
      )}

      {/* ヘルプモーダル */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-lg overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-6 py-4 border-b flex items-center justify-between"
                style={{
                  borderColor: `${accentColor}20`,
                  background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}04)`,
                }}
              >
                <h3
                  className="text-sm font-bold"
                  style={{ color: accentColor }}
                >
                  Figma Personal Access Token の取得方法
                </h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[#8A7E6B] hover:bg-black/5 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Steps */}
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {steps.map((step) => (
                  <div key={step.num} className="flex gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[12px] font-bold mt-0.5"
                      style={{ backgroundColor: accentColor }}
                    >
                      {step.num}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[#5A4E3A]">
                        {step.title}
                      </p>
                      <p className="text-[12px] text-[#8A7E6B] mt-0.5 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}

                {/* 注意事項 */}
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                  <p className="text-[12px] text-amber-700 leading-relaxed">
                    <span className="font-bold">注意：</span>
                    トークンは生成時に一度だけ表示されます。安全な場所に保存してください。OASIS
                    はトークンをブラウザの localStorage に保存し、次回訪問時に自動入力します。
                  </p>
                </div>

                {/* 公式ドキュメントリンク */}
                <a
                  href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:shadow-md"
                  style={{
                    borderColor: `${accentColor}30`,
                    color: accentColor,
                  }}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  公式ドキュメントで確認
                </a>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-[#E8D5B0]/30 flex justify-end">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:shadow-md"
                  style={{ backgroundColor: accentColor }}
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
