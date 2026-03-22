import { motion } from "framer-motion";

/**
 * 円形プログレスインジケーター
 * アプリ全体のローディング UI で再利用可能
 *
 * @param {number}  progress    - 0〜100
 * @param {number}  size        - SVG サイズ (px)
 * @param {number}  strokeWidth - 線幅
 * @param {string}  label       - メインラベル (例: "SP をスキャン中...")
 * @param {string}  sublabel    - サブラベル (例: "1 / 3 ビューポート")
 * @param {string}  accentFrom  - グラデーション開始色
 * @param {string}  accentTo    - グラデーション終了色
 */
export default function CircularProgress({
  progress = 0,
  size = 120,
  strokeWidth = 8,
  label = "",
  sublabel = "",
  accentFrom = "#3aafc9",
  accentTo = "#2a8fa9",
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, progress));
  const offset = circumference - (clamped / 100) * circumference;

  // gradient ID をユニークにする (同一画面に複数置ける)
  const gradId = `cp-grad-${size}-${accentFrom.replace("#", "")}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* 背景リング */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E8D5B0"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          {/* プログレスリング */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accentFrom} />
              <stop offset="100%" stopColor={accentTo} />
            </linearGradient>
          </defs>
        </svg>
        {/* 中央パーセント */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold text-[#5C4A28]"
            style={{ fontSize: size * 0.2 }}
          >
            {Math.round(clamped)}%
          </span>
        </div>
      </div>

      {label && (
        <p className="text-sm text-[#5C4A28] font-medium text-center">
          {label}
        </p>
      )}
      {sublabel && (
        <p className="text-xs text-[#8A7E6B] text-center">{sublabel}</p>
      )}
    </div>
  );
}
