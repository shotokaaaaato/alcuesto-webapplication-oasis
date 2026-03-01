const crypto = require("crypto");
const { extractDnaSummary } = require("./aiRefactorService");
const { extractColorsFromDna } = require("./figmaService");
const { rgbToHex } = require("./tailwindConfigGenerator");

/**
 * オブジェクトのキーをソートして JSON 化（決定論的）
 */
function sortedStringify(obj) {
  return JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
}

/**
 * デザイン サマリーを正規化（ソート + 数値丸め）
 */
function normalizeSummary(summary) {
  const colors = [...summary.colors].sort((a, b) =>
    (a.css || "").localeCompare(b.css || "")
  );

  const typography = [...summary.typography].sort((a, b) =>
    `${a.fontFamily || ""}${a.fontSize || ""}`.localeCompare(
      `${b.fontFamily || ""}${b.fontSize || ""}`
    )
  );

  const layout = [...summary.layout].sort((a, b) =>
    (a.tag || "").localeCompare(b.tag || "")
  );

  const visual = [...summary.visual].sort((a, b) =>
    (a.tag || "").localeCompare(b.tag || "")
  );

  return { colors, typography, layout, visual };
}

/**
 * design 要素配列から一意なハッシュを生成
 * 同一のデザイン構成（色・フォント・レイアウト・ビジュアル）であれば同一ハッシュ
 * @param {object[]} dnaElements
 * @returns {string} SHA-256 hex digest
 */
function generateDnaHash(dnaElements) {
  const summary = extractDnaSummary(dnaElements);
  const normalized = normalizeSummary(summary);
  const json = sortedStringify(normalized);
  return crypto.createHash("sha256").update(json, "utf-8").digest("hex");
}

/**
 * design 要素からセマンティック名 → HEX のカラーマップを生成
 * tailwindConfigGenerator.js の命名規則に準拠
 * @param {object[]} dnaElements
 * @returns {Object.<string, string>} e.g. { "dna-primary": "#60451B", "dna-bg-main": "#FFF8F0" }
 */
function extractColorMap(dnaElements) {
  const colors = extractColorsFromDna(dnaElements);
  const map = {};

  let textIdx = 0;
  let bgIdx = 0;
  const textNames = ["primary", "secondary", "tertiary", "muted", "accent"];
  const bgNames = ["main", "surface", "card", "overlay", "accent"];

  colors.forEach((c) => {
    const hex = rgbToHex(c.cssValue);
    if (c.name.includes("/text/")) {
      const name =
        textIdx < textNames.length ? textNames[textIdx] : `text-${textIdx}`;
      map[`dna-${name}`] = hex;
      textIdx++;
    } else if (c.name.includes("/bg/")) {
      const name =
        bgIdx < bgNames.length ? `bg-${bgNames[bgIdx]}` : `bg-${bgIdx}`;
      map[`dna-${name}`] = hex;
      bgIdx++;
    }
  });

  return map;
}

/**
 * デザイン要素からアクセントカラー（最頻出の有彩色）を抽出
 * @param {object[]} dnaElements
 * @returns {{ hex: string, cssValue: string, count: number, alternatives: Array<{hex: string, cssValue: string, count: number}> } | null}
 */
function extractPrimaryAccentColor(dnaElements) {
  const colorCounts = new Map();

  function parseRgb(str) {
    const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (!m) return null;
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]) };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h, s, l };
  }

  function isChromatic(rgb) {
    const { s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    // 彩度が低い（灰色系）、または明度が極端（白/黒）を除外
    if (s < 0.12) return false;
    if (l < 0.08 || l > 0.92) return false;
    return true;
  }

  function normalizeKey(rgb) {
    // 近い色をまとめるために 8 刻みで量子化
    const qr = Math.round(rgb.r / 8) * 8;
    const qg = Math.round(rgb.g / 8) * 8;
    const qb = Math.round(rgb.b / 8) * 8;
    return `${qr},${qg},${qb}`;
  }

  function toHex(rgb) {
    const r = Math.min(255, Math.max(0, Math.round(rgb.r)));
    const g = Math.min(255, Math.max(0, Math.round(rgb.g)));
    const b = Math.min(255, Math.max(0, Math.round(rgb.b)));
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function processEl(el) {
    const bg = el.styles?.visual?.backgroundColor;
    const fg = el.styles?.typography?.color;
    for (const val of [bg, fg]) {
      if (!val || val === "rgba(0, 0, 0, 0)") continue;
      const rgb = parseRgb(val);
      if (!rgb || !isChromatic(rgb)) continue;
      const key = normalizeKey(rgb);
      const entry = colorCounts.get(key) || { count: 0, cssValue: val, rgb };
      entry.count++;
      colorCounts.set(key, entry);
    }
    if (el.children) el.children.forEach(processEl);
  }

  dnaElements.forEach(processEl);

  const sorted = [...colorCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count);
  if (sorted.length === 0) return null;

  const top = sorted[0][1];
  return {
    hex: toHex(top.rgb),
    cssValue: top.cssValue,
    count: top.count,
    alternatives: sorted.slice(1, 4).map(([, v]) => ({
      hex: toHex(v.rgb),
      cssValue: v.cssValue,
      count: v.count,
    })),
  };
}

/**
 * 正規表現用エスケープ
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * テンプレートのコード内 HEX 値を新しい design のカラーに置換
 * @param {string} code - 元コード
 * @param {Object.<string, string>} sourceMap - テンプレート作成時のカラーマップ
 * @param {Object.<string, string>} targetMap - 適用先 design のカラーマップ
 * @returns {string} 置換後のコード
 */
function applyColorMap(code, sourceMap, targetMap) {
  let result = code;
  for (const [semanticName, sourceHex] of Object.entries(sourceMap)) {
    const targetHex = targetMap[semanticName];
    if (targetHex && sourceHex.toLowerCase() !== targetHex.toLowerCase()) {
      const regex = new RegExp(escapeRegex(sourceHex), "gi");
      result = result.replace(regex, targetHex);
    }
  }
  return result;
}

module.exports = {
  generateDnaHash,
  extractColorMap,
  applyColorMap,
  extractPrimaryAccentColor,
};
