import { useState } from "react";
import { motion } from "framer-motion";
import ModelSelector from "../ModelSelector";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] focus:outline-none focus:ring-2 focus:ring-[#D4A76A]/20 placeholder:text-[#C49A6C]/60";

export default function PageInitModal({ pageName: initName, aiModel: initModel, imageMode: initMode, onComplete }) {
  const [name, setName] = useState(initName || "");
  const [model, setModel] = useState(initModel || "deepseek");
  const [mode, setMode] = useState(initMode || "unsplash");

  const canProceed = name.trim().length > 0;

  return (
    <div className="max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm"
      >
        <div className="mb-6">
          <h2 className="text-[17px] font-bold text-[#5A4E3A]">新規ページを作成</h2>
          <p className="text-[13px] text-[#8A7E6B] mt-1">
            ページの基本情報を入力して、構成プランニングへ進みます
          </p>
        </div>

        {/* ── ページ名 ── */}
        <div className="mb-5">
          <label className="block text-[13px] font-semibold text-[#8B6914] mb-1.5">
            ページ名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 会社概要、サービス紹介、採用情報..."
            className={inputClass}
            autoFocus
          />
        </div>

        {/* ── AI モデル ── */}
        <div className="mb-5">
          <label className="block text-[13px] font-semibold text-[#8B6914] mb-1.5">
            利用 AI モデル
          </label>
          <ModelSelector value={model} onChange={setModel} />
        </div>

        {/* ── 画像モード ── */}
        <div className="mb-8">
          <label className="block text-[13px] font-semibold text-[#8B6914] mb-2">
            画像モード
          </label>
          <div className="flex gap-3">
            {[
              { value: "unsplash", label: "Unsplash 写真", desc: "高品質な写真素材を使用" },
              { value: "shapes", label: "図形・装飾", desc: "CSS 図形で構築（画像なし）" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${
                  mode === opt.value
                    ? "border-[#D4A76A] bg-[#D4A76A]/10"
                    : "border-[#E8D5B0]/50 bg-white/30 hover:bg-white/50"
                }`}
              >
                <span className={`text-[13px] font-bold ${mode === opt.value ? "text-[#8B6914]" : "text-[#5A4E3A]"}`}>
                  {opt.label}
                </span>
                <p className="text-[11px] text-[#8A7E6B] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── 次へ ── */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!canProceed}
          onClick={() => onComplete(name.trim(), model, mode)}
          className={`w-full py-3 rounded-xl text-[14px] font-bold transition-all ${
            canProceed
              ? "bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white shadow-md hover:shadow-lg"
              : "bg-[#E8D5B0]/50 text-[#8A7E6B] cursor-not-allowed"
          }`}
        >
          構成プランニングへ →
        </motion.button>
      </motion.div>
    </div>
  );
}
