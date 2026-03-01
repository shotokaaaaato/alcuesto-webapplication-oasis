const FIGMA_API_BASE = "https://api.figma.com/v1";

// ── ヘルパー ──────────────────────────────────────

/**
 * CSS "rgb(r, g, b)" / "rgba(r, g, b, a)" を Figma {r,g,b} (0-1) + opacity に変換
 */
function rgbToFigmaColor(rgbString) {
  const match = rgbString.match(
    /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/
  );
  if (!match) return { color: { r: 0, g: 0, b: 0 }, opacity: 1 };
  return {
    color: {
      r: parseInt(match[1]) / 255,
      g: parseInt(match[2]) / 255,
      b: parseInt(match[3]) / 255,
    },
    opacity: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

/**
 * CSSフォントスタックからプライマリフォント名を抽出
 */
function parseFontFamily(fontStack) {
  if (!fontStack) return "sans-serif";
  const first = fontStack.split(",")[0].trim();
  return first.replace(/['"]/g, "");
}

/**
 * CSSサイズ文字列から数値を抽出 ("16px" → 16)
 */
function parseFontSize(value) {
  if (!value) return null;
  const match = value.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * CSS font-weight 数値 → Figma font style 名
 */
function fontWeightToStyle(weight) {
  const w = parseInt(weight) || 400;
  if (w <= 100) return "Thin";
  if (w <= 200) return "ExtraLight";
  if (w <= 300) return "Light";
  if (w <= 400) return "Regular";
  if (w <= 500) return "Medium";
  if (w <= 600) return "SemiBold";
  if (w <= 700) return "Bold";
  if (w <= 800) return "ExtraBold";
  return "Black";
}

// ── Figma REST API (読み取り専用) ─────────────────

/**
 * Figma API 接続を検証（ファイル情報を読み取り）
 */
async function validateConnection(accessToken, fileKey) {
  try {
    const res = await fetch(`${FIGMA_API_BASE}/files/${fileKey}?depth=1`, {
      headers: { "X-Figma-Token": accessToken },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { valid: false, error: err.message || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { valid: true, fileName: data.name };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// ── デザイン → スタイル抽出 ───────────────────────────

/**
 * デザイン要素配列からユニークな色を抽出
 */
function extractColorsFromDna(elements) {
  const colorMap = new Map();

  function processElement(el) {
    const textColor = el.styles?.typography?.color;
    if (textColor && textColor.startsWith("rgb")) {
      const key = textColor.replace(/\s/g, "");
      if (!colorMap.has(key)) {
        const { color, opacity } = rgbToFigmaColor(textColor);
        colorMap.set(key, {
          name: `OASIS/text/${el.tagName || "element"}-${colorMap.size}`,
          cssValue: textColor,
          color,
          opacity,
        });
      }
    }

    const bgColor = el.styles?.visual?.backgroundColor;
    if (
      bgColor &&
      bgColor.startsWith("rgb") &&
      bgColor !== "rgba(0, 0, 0, 0)"
    ) {
      const key = bgColor.replace(/\s/g, "");
      if (!colorMap.has(key)) {
        const { color, opacity } = rgbToFigmaColor(bgColor);
        colorMap.set(key, {
          name: `OASIS/bg/${el.tagName || "element"}-${colorMap.size}`,
          cssValue: bgColor,
          color,
          opacity,
        });
      }
    }

    if (el.children) el.children.forEach(processElement);
  }

  elements.forEach(processElement);
  return Array.from(colorMap.values());
}

/**
 * デザイン要素配列からユニークなタイポグラフィ情報を抽出
 */
function extractTypographyFromDna(elements) {
  const fontMap = new Map();

  function processElement(el) {
    const typo = el.styles?.typography;
    if (!typo) return;

    const family = parseFontFamily(typo.fontFamily);
    const size = parseFontSize(typo.fontSize);
    const weight = typo.fontWeight || "400";
    const key = `${family}-${size}-${weight}`;

    if (!fontMap.has(key)) {
      fontMap.set(key, {
        name: `OASIS/${el.tagName || "text"}-${family}-${size || "auto"}`,
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        fontStyle: fontWeightToStyle(weight),
        lineHeight: typo.lineHeight,
        letterSpacing: typo.letterSpacing,
      });
    }

    if (el.children) el.children.forEach(processElement);
  }

  elements.forEach(processElement);
  return Array.from(fontMap.values());
}

// ── Plugin 用データ整形 ──────────────────────────

/**
 * 抽出した色情報を Figma Plugin API createPaintStyle 形式に変換
 * Plugin 側で直接使えるフォーマット
 */
function formatPaintStyles(colors) {
  return colors.map((c) => ({
    name: c.name,
    cssValue: c.cssValue,
    paint: {
      type: "SOLID",
      color: c.color,
      opacity: c.opacity,
    },
  }));
}

/**
 * 抽出したタイポグラフィを Figma Plugin API createTextStyle 形式に変換
 */
function formatTextStyles(typography) {
  return typography.map((t) => {
    const style = {
      name: t.name,
      fontName: { family: t.fontFamily, style: t.fontStyle },
      fontSize: t.fontSize || 16,
    };

    // lineHeight: "24px" → { value: 24, unit: "PIXELS" }, "normal" → { unit: "AUTO" }
    const lh = parseFontSize(t.lineHeight);
    if (lh) {
      style.lineHeight = { value: lh, unit: "PIXELS" };
    } else {
      style.lineHeight = { unit: "AUTO" };
    }

    // letterSpacing: "0.5px" → { value: 0.5, unit: "PIXELS" }
    const ls = parseFontSize(t.letterSpacing);
    if (ls) {
      style.letterSpacing = { value: ls, unit: "PIXELS" };
    } else {
      style.letterSpacing = { value: 0, unit: "PIXELS" };
    }

    return style;
  });
}

module.exports = {
  validateConnection,
  extractColorsFromDna,
  extractTypographyFromDna,
  formatPaintStyles,
  formatTextStyles,
  rgbToFigmaColor,
  parseFontFamily,
  parseFontSize,
  fontWeightToStyle,
};
