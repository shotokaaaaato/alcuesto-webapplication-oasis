import { useEffect } from "react";
import { useApiKeys } from "../hooks/useApiKeys";

const MODEL_OPTIONS = [
  { id: "deepseek", label: "DeepSeek", icon: "🔮", alwaysAvailable: true },
  { id: "openai", label: "OpenAI (GPT-4o)", icon: "🤖" },
  { id: "claude", label: "Claude", icon: "🧠" },
  { id: "gemini", label: "Gemini", icon: "💎" },
  { id: "perplexity", label: "Perplexity", icon: "🔍" },
];

/**
 * AI モデル選択ドロップダウン
 * APIキー未設定のモデルは選択不可（disabled）
 * @param {{ value: string, onChange: (model: string) => void, className?: string }} props
 */
export default function ModelSelector({ value, onChange, className = "" }) {
  const { hasKey } = useApiKeys();

  // 選択中のモデルのキーが無い場合、利用可能なモデルに自動切替
  useEffect(() => {
    const current = MODEL_OPTIONS.find((o) => o.id === value);
    if (current && !current.alwaysAvailable && !hasKey(value)) {
      const fallback = MODEL_OPTIONS.find(
        (o) => o.alwaysAvailable || hasKey(o.id)
      );
      if (fallback) onChange(fallback.id);
    }
  }, [value, hasKey, onChange]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-xs text-[#8B6914]/70 whitespace-nowrap font-['Noto_Sans_JP']">
        AI モデル
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg border border-[#E8D5B0]/50 bg-white/80
                   text-[#5C4A28] focus:outline-none focus:ring-2 focus:ring-[#3aafc9]/30
                   font-['Noto_Sans_JP'] cursor-pointer"
      >
        {MODEL_OPTIONS.map((opt) => {
          const available = opt.alwaysAvailable || hasKey(opt.id);
          return (
            <option key={opt.id} value={opt.id} disabled={!available}>
              {opt.icon} {opt.label}
              {available ? "" : " (キー未設定)"}
            </option>
          );
        })}
      </select>
    </div>
  );
}
