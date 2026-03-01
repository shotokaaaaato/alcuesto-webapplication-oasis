const {
  extractColorsFromDna,
  extractTypographyFromDna,
  parseFontFamily,
  parseFontSize,
} = require("./figmaService");

/**
 * RGB 文字列 "rgb(r, g, b)" / "rgba(r, g, b, a)" → "#RRGGBB" HEX に変換
 */
function rgbToHex(rgbString) {
  const match = rgbString.match(
    /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/
  );
  if (!match) return "#000000";
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * border-radius 値を正規化してサイズ順にソートし命名
 */
function extractBorderRadii(elements) {
  const radiiSet = new Set();

  function processElement(el) {
    const br = el.styles?.visual?.borderRadius;
    if (br && br !== "0px") {
      const val = parseFontSize(br);
      if (val && val > 0) {
        radiiSet.add(`${val}px`);
      }
    }
    if (el.children) el.children.forEach(processElement);
  }

  elements.forEach(processElement);

  const sorted = Array.from(radiiSet).sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );

  const names = ["sm", "md", "lg", "xl", "2xl", "3xl"];
  const result = {};
  sorted.forEach((val, i) => {
    const name = i < names.length ? names[i] : `${i + 1}`;
    result[`dna-${name}`] = val;
  });

  return result;
}

/**
 * box-shadow 値を抽出して命名
 */
function extractBoxShadows(elements) {
  const shadowSet = new Set();

  function processElement(el) {
    const bs = el.styles?.visual?.boxShadow;
    if (bs && bs !== "none" && bs !== "") {
      shadowSet.add(bs);
    }
    if (el.children) el.children.forEach(processElement);
  }

  elements.forEach(processElement);

  const shadows = Array.from(shadowSet);
  const names = ["sm", "DEFAULT", "md", "lg", "xl"];
  const result = {};
  shadows.forEach((val, i) => {
    const name = i < names.length ? names[i] : `${i + 1}`;
    result[`dna-${name}`] = val;
  });

  return result;
}

/**
 * デザイン要素配列から tailwind.config.js の theme.extend を生成
 * @param {Array} dnaElements - デザイン要素の配列
 * @returns {string} tailwind.config.js の内容
 */
function generateTailwindConfig(dnaElements) {
  // 1. カラー抽出
  const colors = extractColorsFromDna(dnaElements);
  const colorConfig = {};

  // テキスト色とBG色を分けてセマンティック命名
  let textIdx = 0;
  let bgIdx = 0;
  const textNames = ["primary", "secondary", "tertiary", "muted", "accent"];
  const bgNames = ["main", "surface", "card", "overlay", "accent"];

  colors.forEach((c) => {
    const hex = rgbToHex(c.cssValue);
    if (c.name.includes("/text/")) {
      const name =
        textIdx < textNames.length ? textNames[textIdx] : `text-${textIdx}`;
      colorConfig[`dna-${name}`] = hex;
      textIdx++;
    } else if (c.name.includes("/bg/")) {
      const name =
        bgIdx < bgNames.length ? `bg-${bgNames[bgIdx]}` : `bg-${bgIdx}`;
      colorConfig[`dna-${name}`] = hex;
      bgIdx++;
    }
  });

  // 2. フォントファミリー抽出
  const typography = extractTypographyFromDna(dnaElements);
  const fontFamilyConfig = {};
  const seenFamilies = new Set();
  const fontNames = ["heading", "body", "mono", "accent"];
  let fontIdx = 0;

  typography.forEach((t) => {
    const family = t.fontFamily;
    if (!seenFamilies.has(family)) {
      seenFamilies.add(family);
      const name =
        fontIdx < fontNames.length ? fontNames[fontIdx] : `font-${fontIdx}`;
      // セリフ系 / サンセリフ系 / 等幅系のフォールバック判定
      const isSerif =
        family.toLowerCase().includes("serif") &&
        !family.toLowerCase().includes("sans");
      const isMono =
        family.toLowerCase().includes("mono") ||
        family.toLowerCase().includes("code");
      const fallback = isMono ? "monospace" : isSerif ? "serif" : "sans-serif";
      fontFamilyConfig[`dna-${name}`] = [`"${family}"`, fallback];
      fontIdx++;
    }
  });

  // 3. border-radius 抽出
  const borderRadiusConfig = extractBorderRadii(dnaElements);

  // 4. box-shadow 抽出
  const boxShadowConfig = extractBoxShadows(dnaElements);

  // 5. Config 組み立て
  const extend = {};
  if (Object.keys(colorConfig).length > 0) extend.colors = colorConfig;
  if (Object.keys(fontFamilyConfig).length > 0)
    extend.fontFamily = fontFamilyConfig;
  if (Object.keys(borderRadiusConfig).length > 0)
    extend.borderRadius = borderRadiusConfig;
  if (Object.keys(boxShadowConfig).length > 0)
    extend.boxShadow = boxShadowConfig;

  const config = {
    theme: {
      extend,
    },
  };

  // JavaScript 形式で出力（JSON ではなく module.exports）
  let output = "/** @type {import('tailwindcss').Config} */\n";
  output += "module.exports = ";
  output += formatJsObject(config, 0);
  output += ";\n";

  return output;
}

/**
 * JavaScript オブジェクトを読みやすい形式で文字列化
 * （JSON.stringify ではなく、配列内の文字列をクォートで統一）
 */
function formatJsObject(obj, indent) {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);

  if (Array.isArray(obj)) {
    const items = obj.map((item) =>
      typeof item === "string" ? `"${item}"` : formatJsObject(item, indent + 1)
    );
    return `[${items.join(", ")}]`;
  }

  if (typeof obj === "object" && obj !== null) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";

    let result = "{\n";
    entries.forEach(([key, val], i) => {
      // キーにハイフンが含まれる場合はクォート
      const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? key
        : `"${key}"`;
      result += `${padInner}${formattedKey}: ${formatJsObject(val, indent + 1)}`;
      if (i < entries.length - 1) result += ",";
      result += "\n";
    });
    result += `${pad}}`;
    return result;
  }

  if (typeof obj === "string") return `"${obj}"`;
  return String(obj);
}

module.exports = {
  generateTailwindConfig,
  rgbToHex,
};
