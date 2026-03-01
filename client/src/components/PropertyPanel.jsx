/**
 * 右側プロパティパネル — 選択されたデザインノードの詳細を日本語で表示
 */
export default function PropertyPanel({ dna, biome, onClose }) {
  if (!dna) return null;

  const isForest = biome === "forest";
  const accent = isForest ? "#7ab83e" : "#C49A6C";
  const borderColor = isForest ? "border-[#1a3a10]" : "border-[#DDD0B8]";
  const bgColor = isForest ? "bg-[#0a1a04]" : "bg-[#FFF8E7]";
  const accentText = isForest ? "text-[#b8e07c]" : "text-[#C49A6C]";

  const { typography, layout, visual } = dna.styles || {};

  return (
    <aside
      className={`w-80 flex-shrink-0 border-l ${borderColor} ${bgColor} flex flex-col overflow-hidden transition-all duration-300`}
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      {/* ヘッダー */}
      <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
        <div>
          <span className={`text-sm font-mono font-bold ${accentText}`}>
            &lt;{dna.tagName}&gt;
          </span>
          <p className={`text-[12px] mt-0.5 truncate max-w-[200px] ${
            isForest ? "text-[#4a7a30]" : "text-[#8A7E6B]"
          }`}>
            {dna.selector}
          </p>
        </div>
        <button
          onClick={onClose}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
            isForest
              ? "text-[#4a7a30] hover:text-[#b8e07c] hover:bg-white/5"
              : "text-[#8A7E6B] hover:text-[#4A3F35] hover:bg-black/5"
          }`}
        >
          x
        </button>
      </div>

      {/* プロパティ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <SectionTitle label="識別子" accent={accent} />
          <p className={`text-[12px] font-mono break-all ${
            isForest ? "text-[#8ece5a]" : "text-[#6B5E4F]"
          }`}>{dna.id}</p>
        </div>

        {dna.boundingBox && (
          <div>
            <SectionTitle label="バウンディングボックス" accent={accent} />
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(dna.boundingBox).map(([k, v]) => (
                <PropRow key={k} label={k} value={`${v}px`} isForest={isForest} />
              ))}
            </div>
          </div>
        )}

        {typography && (
          <div>
            <SectionTitle label="タイポグラフィ" accent={accent} />
            <div className="space-y-0.5">
              {Object.entries(typography).map(([k, v]) => (
                v && <PropRow key={k} label={k} value={v} isColor={k === "color"} isForest={isForest} />
              ))}
            </div>
          </div>
        )}

        {layout && (
          <div>
            <SectionTitle label="レイアウト" accent={accent} />
            <div className="space-y-0.5">
              {Object.entries(layout).map(([k, v]) => (
                v && <PropRow key={k} label={k} value={v} isForest={isForest} />
              ))}
            </div>
          </div>
        )}

        {visual && (
          <div>
            <SectionTitle label="ビジュアル" accent={accent} />
            <div className="space-y-0.5">
              {Object.entries(visual).map(([k, v]) => (
                v && <PropRow key={k} label={k} value={v} isColor={k === "backgroundColor"} isForest={isForest} />
              ))}
            </div>
          </div>
        )}

        {dna.textContent && (
          <div>
            <SectionTitle label="テキスト内容" accent={accent} />
            <p className={`text-[12px] p-2 rounded break-words ${
              isForest
                ? "text-[#8ece5a] bg-[#001a08]/60"
                : "text-[#6B5E4F] bg-[#F0E8D8]"
            }`}>
              {dna.textContent}
            </p>
          </div>
        )}
      </div>

      {/* CSS コピー */}
      <div className={`p-3 border-t ${borderColor}`}>
        <button
          onClick={() => copyCSS(dna)}
          className={`w-full py-2 text-xs font-medium rounded border transition-colors ${
            isForest
              ? "border-[#3a7a1e]/40 bg-[#7ab83e]/10 text-[#b8e07c] hover:bg-[#7ab83e]/20"
              : "border-[#C49A6C]/40 bg-[#C49A6C]/10 text-[#C49A6C] hover:bg-[#C49A6C]/20"
          }`}
        >
          CSSとしてコピー
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </aside>
  );
}

function SectionTitle({ label, accent }) {
  return (
    <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-1" style={{ color: accent }}>
      {label}
    </h3>
  );
}

function PropRow({ label, value, isColor, isForest }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className={isForest ? "text-[#4a7a30]" : "text-[#8A7E6B]"}>{camelToKebab(label)}</span>
      <span className={`font-mono flex items-center gap-1.5 ${
        isForest ? "text-[#c4e87c]" : "text-[#4A3F35]"
      }`}>
        {isColor && value && (
          <span className="w-3 h-3 rounded-sm inline-block border border-black/10" style={{ backgroundColor: value }} />
        )}
        <span className="max-w-[140px] truncate">{value}</span>
      </span>
    </div>
  );
}

function camelToKebab(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function copyCSS(dna) {
  const all = { ...dna.styles?.typography, ...dna.styles?.layout, ...dna.styles?.visual };
  const lines = Object.entries(all)
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${camelToKebab(k)}: ${v};`);
  const css = `.${dna.tagName} {\n${lines.join("\n")}\n}`;
  navigator.clipboard.writeText(css).catch(() => {});
}
