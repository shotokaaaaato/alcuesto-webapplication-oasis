const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  parseFontFamily,
  parseFontSize,
  fontWeightToStyle,
} = require("./figmaService");

const FIGMA_API_BASE = "https://api.figma.com/v1";

/**
 * Figma {r,g,b} (0-1) → CSS rgb() 文字列
 */
function figmaColorToRgb(color, opacity = 1) {
  const r = Math.round((color.r || 0) * 255);
  const g = Math.round((color.g || 0) * 255);
  const b = Math.round((color.b || 0) * 255);
  if (opacity < 1) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(opacity.toFixed(2))})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Figma effect (DROP_SHADOW) → CSS box-shadow 文字列
 */
function effectToBoxShadow(effect) {
  if (effect.type !== "DROP_SHADOW" || !effect.visible) return null;
  const { offset, radius, spread, color } = effect;
  const x = offset?.x || 0;
  const y = offset?.y || 0;
  const r = radius || 0;
  const s = spread || 0;
  const c = color ? figmaColorToRgb(color, color.a ?? 1) : "rgba(0,0,0,0.25)";
  return `${x}px ${y}px ${r}px ${s}px ${c}`;
}

/**
 * Figma ノード → design element 形式に変換
 */
function figmaNodeToDna(node) {
  const isText = node.type === "TEXT";

  // Typography
  const typography = {};
  if (node.style) {
    const s = node.style;
    typography.fontFamily = s.fontFamily || "sans-serif";
    typography.fontSize = s.fontSize ? `${s.fontSize}px` : "16px";
    typography.fontWeight = String(s.fontWeight || 400);
    typography.lineHeight =
      s.lineHeightPx ? `${Math.round(s.lineHeightPx)}px` : "normal";
    typography.letterSpacing =
      s.letterSpacing ? `${s.letterSpacing}px` : "normal";
    typography.textAlign = (s.textAlignHorizontal || "LEFT").toLowerCase();
  }

  // Text color (from fills on TEXT nodes)
  if (isText && node.fills && node.fills.length > 0) {
    const fill = node.fills.find((f) => f.type === "SOLID" && f.visible !== false);
    if (fill) {
      typography.color = figmaColorToRgb(fill.color, fill.opacity ?? 1);
    }
  }

  // Visual
  const visual = {};

  // Background color (from fills on non-TEXT nodes)
  if (!isText && node.fills && node.fills.length > 0) {
    const fill = node.fills.find((f) => f.type === "SOLID" && f.visible !== false);
    if (fill) {
      visual.backgroundColor = figmaColorToRgb(fill.color, fill.opacity ?? 1);
    }
  }
  if (!visual.backgroundColor) {
    visual.backgroundColor = "rgba(0, 0, 0, 0)";
  }

  // Border radius
  if (node.cornerRadius != null) {
    visual.borderRadius = `${node.cornerRadius}px`;
  } else if (node.rectangleCornerRadii) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii;
    visual.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
  } else {
    visual.borderRadius = "0px";
  }

  // Border (strokes)
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes.find((s) => s.type === "SOLID" && s.visible !== false);
    if (stroke) {
      const w = node.strokeWeight || 1;
      const c = figmaColorToRgb(stroke.color, stroke.opacity ?? 1);
      visual.border = `${w}px solid ${c}`;
    } else {
      visual.border = "none";
    }
  } else {
    visual.border = "none";
  }

  // Box shadow (effects)
  if (node.effects && node.effects.length > 0) {
    const shadows = node.effects
      .map(effectToBoxShadow)
      .filter(Boolean);
    visual.boxShadow = shadows.length > 0 ? shadows.join(", ") : "none";
  } else {
    visual.boxShadow = "none";
  }

  visual.opacity = String(node.opacity != null ? node.opacity : 1);
  visual.overflow = node.clipsContent ? "hidden" : "visible";

  // Layout
  const layout = {};
  if (node.layoutMode) {
    layout.display = "flex";
    layout.flexDirection = node.layoutMode === "VERTICAL" ? "column" : "row";
    layout.justifyContent = mapAxisAlign(node.primaryAxisAlignItems);
    layout.alignItems = mapAxisAlign(node.counterAxisAlignItems);
    layout.gap = node.itemSpacing != null ? `${node.itemSpacing}px` : "0px";
  } else {
    layout.display = "block";
    layout.flexDirection = "row";
    layout.justifyContent = "flex-start";
    layout.alignItems = "stretch";
    layout.gap = "0px";
  }
  layout.position = "static";

  // Bounding box
  const bb = node.absoluteBoundingBox || {};
  layout.width = bb.width != null ? `${Math.round(bb.width)}px` : "auto";
  layout.height = bb.height != null ? `${Math.round(bb.height)}px` : "auto";

  // Padding
  const pt = node.paddingTop || 0;
  const pr = node.paddingRight || 0;
  const pb = node.paddingBottom || 0;
  const pl = node.paddingLeft || 0;
  layout.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
  layout.margin = "0px";

  // Build design element
  const tagName = isText ? "p" : nodeTypeToTag(node.type);
  const textContent = isText ? (node.characters || "").slice(0, 200) : "";

  return {
    id: randomUUID(),
    tagName,
    selector: node.name || tagName,
    textContent,
    boundingBox: {
      x: Math.round(bb.x || 0),
      y: Math.round(bb.y || 0),
      width: Math.round(bb.width || 0),
      height: Math.round(bb.height || 0),
    },
    styles: { typography, layout, visual },
    children: [],
    figmaNodeId: node.id,
    figmaNodeName: node.name,
  };
}

/**
 * Figma layoutAlign → CSS align/justify 値
 */
function mapAxisAlign(value) {
  switch (value) {
    case "CENTER": return "center";
    case "MAX": return "flex-end";
    case "SPACE_BETWEEN": return "space-between";
    case "MIN":
    default: return "flex-start";
  }
}

/**
 * Figma ノードタイプ → HTML タグ名
 */
function nodeTypeToTag(type) {
  switch (type) {
    case "FRAME":
    case "GROUP":
    case "COMPONENT":
    case "COMPONENT_SET":
    case "INSTANCE":
      return "div";
    case "TEXT":
      return "p";
    case "RECTANGLE":
    case "ELLIPSE":
    case "LINE":
    case "VECTOR":
      return "div";
    default:
      return "div";
  }
}

/**
 * ノードツリーを再帰的にフラット化（主要ノードのみ抽出）
 */
function flattenNodes(node, maxDepth = 3, currentDepth = 0) {
  const results = [];

  // 意味のあるノードのみ追加（DOCUMENT, CANVAS はスキップ）
  if (node.type !== "DOCUMENT" && node.type !== "CANVAS") {
    results.push(figmaNodeToDna(node));
  }

  if (currentDepth < maxDepth && node.children) {
    for (const child of node.children.slice(0, 20)) {
      results.push(...flattenNodes(child, maxDepth, currentDepth + 1));
    }
  }

  return results;
}

/**
 * Figma ファイルからノードツリーを取得し design 形式に変換
 * @param {string} accessToken - Figma Personal Access Token
 * @param {string} fileKey - Figma File Key
 * @param {string[]} [nodeIds] - 特定ノード ID（省略時はファイル全体 depth=2）
 * @returns {Promise<{elements: object[], fileName: string, pageNames: string[]}>}
 */
async function extractFigmaNodes(accessToken, fileKey, nodeIds) {
  const headers = { "X-Figma-Token": accessToken };

  if (nodeIds && nodeIds.length > 0) {
    // 特定ノードを取得
    const ids = nodeIds.join(",");
    const res = await fetch(
      `${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Figma API error: ${res.status}`);
    }
    const data = await res.json();
    const elements = [];
    for (const [, nodeData] of Object.entries(data.nodes || {})) {
      if (nodeData.document) {
        elements.push(...flattenNodes(nodeData.document, 3));
      }
    }
    return { elements, fileName: data.name || fileKey, pageNames: [] };
  }

  // ファイル全体を取得（depth=2 で主要構造を把握）
  const res = await fetch(
    `${FIGMA_API_BASE}/files/${fileKey}?depth=2`,
    { headers }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Figma API error: ${res.status}`);
  }
  const data = await res.json();

  const pageNames = [];
  const elements = [];

  if (data.document && data.document.children) {
    for (const page of data.document.children) {
      pageNames.push(page.name);
      if (page.children) {
        for (const child of page.children.slice(0, 30)) {
          elements.push(...flattenNodes(child, 2));
        }
      }
    }
  }

  return { elements, fileName: data.name, pageNames };
}

/**
 * Figma ファイルのページ構造のみを取得（ノード選択 UI 用）
 */
async function getFigmaFileStructure(accessToken, fileKey) {
  const res = await fetch(
    `${FIGMA_API_BASE}/files/${fileKey}?depth=2`,
    { headers: { "X-Figma-Token": accessToken } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Figma API error: ${res.status}`);
  }
  const data = await res.json();

  const pages = (data.document?.children || []).map((page) => ({
    id: page.id,
    name: page.name,
    children: (page.children || []).slice(0, 50).map((child) => ({
      id: child.id,
      name: child.name,
      type: child.type,
    })),
  }));

  return { fileName: data.name, pages };
}

/**
 * Figma Images API でフレームのサムネイル URL を取得
 * @param {string} accessToken - Figma Personal Access Token
 * @param {string} fileKey - Figma ファイルキー
 * @param {string[]} nodeIds - ノード ID の配列
 * @param {string} format - 画像形式 ("png" | "svg")
 * @param {number} scale - 画像スケール (1-4, デフォルト 1)
 * @returns {{ [nodeId: string]: string }} ノード ID → サムネイル URL のマップ
 */
async function getFigmaImages(accessToken, fileKey, nodeIds, format = "png", scale = 1) {
  const ids = nodeIds.join(",");
  const res = await fetch(
    `${FIGMA_API_BASE}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`,
    { headers: { "X-Figma-Token": accessToken } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.err || `Figma Images API error: ${res.status}`);
  }
  const data = await res.json();
  return data.images || {};
}

/**
 * Figma フレームの高解像度レンダリング画像をダウンロードしてローカルに保存
 * @param {string} accessToken - Figma Personal Access Token
 * @param {string} fileKey - Figma ファイルキー
 * @param {string} nodeId - フレームのノード ID
 * @param {number} scale - 画像スケール (1-4, デフォルト 2)
 * @returns {Promise<{ filename: string }>} 保存されたファイル名
 */
async function downloadFigmaImage(accessToken, fileKey, nodeId, scale = 2) {
  const images = await getFigmaImages(accessToken, fileKey, [nodeId], "png", scale);
  const cdnUrl = images[nodeId];
  if (!cdnUrl) throw new Error("Figma image URL not found for node: " + nodeId);

  const imgRes = await fetch(cdnUrl);
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const imagesDir = path.join(__dirname, "../../data/images");
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  const filename = `${randomUUID()}.png`;
  fs.writeFileSync(path.join(imagesDir, filename), buffer);

  return { filename };
}

module.exports = {
  extractFigmaNodes,
  getFigmaFileStructure,
  getFigmaImages,
  downloadFigmaImage,
  figmaNodeToDna,
  figmaColorToRgb,
  flattenNodes,
};
