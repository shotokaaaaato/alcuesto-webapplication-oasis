import { useState } from "react";

/**
 * DNA Picker - URLとセレクタを入力してDNAを抽出するUI
 */
export default function DnaPicker({ onExtracted }) {
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("element"); // "element" | "page"

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
      <h2 className="text-sm font-semibold text-gray-300 mb-3">DNA Picker</h2>

      {/* モード切替 */}
      <div className="flex gap-1 mb-3">
        {["element", "page"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-xs py-1.5 rounded transition-colors ${
              mode === m
                ? "bg-oasis-accent/20 text-oasis-accent border border-oasis-accent/40"
                : "bg-oasis-dark text-gray-500 border border-oasis-border"
            }`}
          >
            {m === "element" ? "Element" : "Full Page"}
          </button>
        ))}
      </div>

      <form onSubmit={handleExtract} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="w-full px-3 py-2 text-sm bg-oasis-dark border border-oasis-border rounded focus:border-oasis-accent focus:outline-none text-gray-200 placeholder-gray-600"
          />
        </div>

        {mode === "element" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              CSS Selector
            </label>
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="header, .hero, #main"
              className="w-full px-3 py-2 text-sm bg-oasis-dark border border-oasis-border rounded focus:border-oasis-accent focus:outline-none text-gray-200 placeholder-gray-600"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 text-sm font-medium rounded bg-oasis-accent/20 text-oasis-accent border border-oasis-accent/40 hover:bg-oasis-accent/30 disabled:opacity-40 transition-colors"
        >
          {loading ? "Extracting..." : "Extract DNA"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-xs text-red-400 bg-red-400/10 p-2 rounded">
          {error}
        </p>
      )}
    </div>
  );
}
