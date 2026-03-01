import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useApiKeys } from "../hooks/useApiKeys";

const PROVIDER_CONFIG = [
  {
    id: "deepseek",
    label: "DeepSeek",
    icon: "🔮",
    color: "#3aafc9",
    placeholder: "sk-...",
    hint: "DeepSeek Platform で発行（deepseek-chat モデル使用）",
  },
  {
    id: "openai",
    label: "OpenAI",
    icon: "🤖",
    color: "#10a37f",
    placeholder: "sk-...",
    hint: "OpenAI Dashboard → API Keys で発行",
  },
  {
    id: "claude",
    label: "Claude (Anthropic)",
    icon: "🧠",
    color: "#a259ff",
    placeholder: "sk-ant-...",
    hint: "Anthropic Console → API Keys で発行",
  },
  {
    id: "gemini",
    label: "Gemini (Google)",
    icon: "💎",
    color: "#4285f4",
    placeholder: "AI...",
    hint: "Google AI Studio → Get API Key で発行",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    icon: "🔍",
    color: "#D4A76A",
    placeholder: "pplx-...",
    hint: "Perplexity API Settings で発行",
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { getKey, setKey, clearAll, storageMode, setStorageMode } = useApiKeys();
  const [visibility, setVisibility] = useState({});
  const [saved, setSaved] = useState(false);

  const toggleVisibility = (id) => {
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF3E6] to-[#F5E6C8]" style={{ fontSize: 15 }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF3E6]/90 backdrop-blur border-b border-[#E8D5B0]/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-[#8B6914]/70 hover:text-[#8B6914] transition font-['Noto_Sans_JP']"
            >
              ← ダッシュボード
            </button>
            <span className="text-[#E8D5B0]">|</span>
            <h1 className="text-lg font-bold text-[#5C4A28] font-['Noto_Serif_JP']">
              環境設定
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Storage Mode */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h2 className="text-base font-bold text-[#5C4A28] mb-3 font-['Noto_Serif_JP']">
            ストレージモード
          </h2>
          <p className="text-sm text-[#8B6914]/70 mb-4 font-['Noto_Sans_JP']">
            API キーの保存方法を選択してください。
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setStorageMode("persistent")}
              className={`px-4 py-2 rounded-xl text-sm font-['Noto_Sans_JP'] transition-all ${
                storageMode === "persistent"
                  ? "bg-[#5C4A28] text-white shadow-md"
                  : "bg-white/60 text-[#5C4A28] border border-[#E8D5B0]/50 hover:bg-white/80"
              }`}
            >
              永続保存 (localStorage)
            </button>
            <button
              onClick={() => setStorageMode("session")}
              className={`px-4 py-2 rounded-xl text-sm font-['Noto_Sans_JP'] transition-all ${
                storageMode === "session"
                  ? "bg-[#5C4A28] text-white shadow-md"
                  : "bg-white/60 text-[#5C4A28] border border-[#E8D5B0]/50 hover:bg-white/80"
              }`}
            >
              セッションのみ
            </button>
          </div>
          <p className="text-xs text-[#8B6914]/50 mt-3 font-['Noto_Sans_JP']">
            {storageMode === "persistent"
              ? "キーは base64 エンコードされ localStorage に保存されます。ブラウザを閉じても保持されます。"
              : "キーはメモリ内のみに保持されます。ページをリロードすると消去されます。"}
          </p>
        </motion.section>

        {/* API Key Forms */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h2 className="text-base font-bold text-[#5C4A28] mb-1 font-['Noto_Serif_JP']">
            AI プロバイダー API キー
          </h2>
          <p className="text-sm text-[#8B6914]/70 mb-6 font-['Noto_Sans_JP']">
            使用する AI モデルの API キーを入力してください。キーはサーバーには保存されません。
          </p>

          <div className="space-y-5">
            {PROVIDER_CONFIG.map((provider, idx) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * idx }}
                className="flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{provider.icon}</span>
                  <label className="text-sm font-medium text-[#5C4A28] font-['Noto_Sans_JP']">
                    {provider.label}
                  </label>
                  {getKey(provider.id) && (
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={visibility[provider.id] ? "text" : "password"}
                      value={getKey(provider.id)}
                      onChange={(e) => setKey(provider.id, e.target.value)}
                      placeholder={provider.placeholder}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-[#E8D5B0]/50
                                 bg-white/80 text-sm text-[#5C4A28] placeholder:text-[#C4A97D]/50
                                 focus:outline-none focus:ring-2 focus:border-transparent
                                 font-mono"
                      style={{ focusRingColor: provider.color }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility(provider.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B6914]/40
                                 hover:text-[#8B6914]/70 transition text-sm"
                    >
                      {visibility[provider.id] ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#8B6914]/50 font-['Noto_Sans_JP'] pl-7">
                  {provider.hint}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Figma Access Token */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎨</span>
            <h2 className="text-base font-bold text-[#5C4A28] font-['Noto_Serif_JP']">
              Figma アクセストークン
            </h2>
            {getKey("figma") && (
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            )}
          </div>
          <p className="text-sm text-[#8B6914]/70 mb-4 font-['Noto_Sans_JP']">
            Figma インポートや同期機能に使用します。Figma &gt; Settings &gt; Personal Access Tokens で発行してください。
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={visibility.figma ? "text" : "password"}
                value={getKey("figma")}
                onChange={(e) => setKey("figma", e.target.value)}
                placeholder="figd_..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-[#E8D5B0]/50
                           bg-white/80 text-sm text-[#5C4A28] placeholder:text-[#C4A97D]/50
                           focus:outline-none focus:ring-2 focus:ring-[#a259ff]/30 focus:border-transparent
                           font-mono"
              />
              <button
                type="button"
                onClick={() => toggleVisibility("figma")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B6914]/40
                           hover:text-[#8B6914]/70 transition text-sm"
              >
                {visibility.figma ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <p className="text-xs text-[#8B6914]/50 font-['Noto_Sans_JP'] mt-2 pl-1">
            Figma Settings → Personal Access Tokens → Generate new token
          </p>
        </motion.section>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5C4A28] to-[#8B6914]
                       text-white text-sm font-['Noto_Sans_JP'] shadow-md
                       hover:shadow-lg transition-all active:scale-95"
          >
            {saved ? "✓ 保存しました" : "設定を保存"}
          </button>
          <button
            onClick={() => {
              if (window.confirm("すべての API キーを削除しますか？")) {
                clearAll();
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-red-300/50 text-red-600 text-sm
                       font-['Noto_Sans_JP'] hover:bg-red-50/50 transition-all"
          >
            全キーを消去
          </button>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/50"
        >
          <p className="text-xs text-amber-700/70 font-['Noto_Sans_JP'] leading-relaxed">
            <strong>セキュリティについて:</strong> API キーはブラウザのローカルストレージまたはメモリに保存され、
            サーバーには永続的に保存されません。各 AI リクエスト時にのみ送信されます。
            支出制限のある API キーの使用を推奨します。
          </p>
        </motion.div>
      </main>
    </div>
  );
}
