import { useState } from "react";

/**
 * DNA 抽出パネル — URLとセレクタを入力してDNAを抽出するUI
 */
export default function DnaPicker({ biome, onExtracted }) {
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("element");

  const isForest = biome === "forest";

  async function handleExtract(e) {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");

    try {
      const endpoint =
        mode === "page" ? "/api/dna/extract-page" : "/api/dna/extract";
      const body =
        mode === "page"
          ? { url }
          : { url, selector: selector || "body", depth: 1 };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const data = Array.isArray(json.data) ? json.data : [json.data];
      onExtracted(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h2 className={`text-sm font-semibold mb-3 transition-colors duration-500 ${
        isForest ? "text-[#8ece5a]" : "text-[#6B5E4F]"
      }`}>DNA 抽出</h2>

      {/* モード切替 */}
      <div className="flex gap-1 mb-3">
        {[
          { key: "element", label: "要素指定" },
          { key: "page", label: "ページ全体" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex-1 text-xs py-1.5 rounded transition-colors ${
              mode === m.key
                ? isForest
                  ? "bg-[#7ab83e]/20 text-[#b8e07c] border border-[#7ab83e]/40"
                  : "bg-[#C49A6C]/15 text-[#C49A6C] border border-[#C49A6C]/40"
                : isForest
                  ? "bg-[#0a1a04] text-[#4a7a30] border border-[#1a3a10]"
                  : "bg-[#FFF5E1] text-[#8A7E6B] border border-[#DDD0B8]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleExtract} className="space-y-3">
        <div>
          <label className={`block text-xs mb-1 transition-colors duration-500 ${
            isForest ? "text-[#4a7a30]" : "text-[#8A7E6B]"
          }`}>対象URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className={`w-full px-3 py-2 text-sm rounded focus:outline-none transition-colors ${
              isForest
                ? "bg-[#0a1a04] border border-[#1a3a10] focus:border-[#7ab83e] text-[#c4e87c] placeholder-[#2a4a1a]"
                : "bg-white border border-[#DDD0B8] focus:border-[#C49A6C] text-[#4A3F35] placeholder-[#C4B89A]"
            }`}
          />
        </div>

        {mode === "element" && (
          <div>
            <label className={`block text-xs mb-1 transition-colors duration-500 ${
              isForest ? "text-[#4a7a30]" : "text-[#8A7E6B]"
            }`}>
              CSSセレクタ
            </label>
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="header, .hero, #main"
              className={`w-full px-3 py-2 text-sm rounded focus:outline-none transition-colors ${
                isForest
                  ? "bg-[#0a1a04] border border-[#1a3a10] focus:border-[#7ab83e] text-[#c4e87c] placeholder-[#2a4a1a]"
                  : "bg-white border border-[#DDD0B8] focus:border-[#C49A6C] text-[#4A3F35] placeholder-[#C4B89A]"
              }`}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 text-sm font-medium rounded border disabled:opacity-40 transition-colors ${
            isForest
              ? "bg-[#7ab83e]/15 text-[#b8e07c] border-[#7ab83e]/40 hover:bg-[#7ab83e]/25"
              : "bg-[#C49A6C]/15 text-[#C49A6C] border-[#C49A6C]/40 hover:bg-[#C49A6C]/25"
          }`}
        >
          {loading ? "抽出中..." : "DNAを抽出"}
        </button>
      </form>

      {error && (
        <p className={`mt-3 text-xs p-2 rounded ${
          isForest
            ? "text-red-400 bg-red-400/10"
            : "text-red-600 bg-red-50"
        }`}>
          {error}
        </p>
      )}
    </div>
  );
}
