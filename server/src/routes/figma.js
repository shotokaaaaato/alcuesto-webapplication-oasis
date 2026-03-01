const { Router } = require("express");
const cors = require("cors");
const { verifyToken } = require("../middleware/auth");
const { getDnaById, getLatestDna } = require("../models/dnaStore");
const {
  validateConnection,
  extractColorsFromDna,
  extractTypographyFromDna,
  formatPaintStyles,
  formatTextStyles,
} = require("../services/figmaService");
const { getFigmaImages } = require("../services/figmaExtractor");

const router = Router();

// Figma Plugin UI は iframe (origin: null) から通信するため、
// plugin-styles エンドポイントのみ CORS をオープンにする
const pluginCors = cors({ origin: true, credentials: true });

/**
 * POST /api/figma/validate
 * Figma API 接続を検証
 * Body: { accessToken: string, fileKey: string }
 */
router.post("/validate", verifyToken, async (req, res) => {
  try {
    const { accessToken, fileKey } = req.body;
    if (!accessToken || !fileKey) {
      return res.status(400).json({ error: "accessToken と fileKey は必須です" });
    }

    const result = await validateConnection(accessToken, fileKey);
    if (!result.valid) {
      return res.status(400).json({ error: `Figma接続に失敗: ${result.error}` });
    }

    res.json({ success: true, fileName: result.fileName });
  } catch (err) {
    console.error("Figma validate error:", err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

/**
 * POST /api/figma/preview
 * 同期対象のカラー・タイポグラフィをプレビュー
 * Body: { dnaId?: string }
 */
router.post("/preview", verifyToken, (req, res) => {
  try {
    const { dnaId } = req.body;
    const dna = dnaId ? getDnaById(dnaId) : getLatestDna();
    if (!dna) {
      return res.status(404).json({ error: "デザインデータが見つかりません" });
    }

    const colors = extractColorsFromDna(dna.elements);
    const typography = extractTypographyFromDna(dna.elements);

    res.json({
      success: true,
      dnaId: dna.id,
      url: dna.url,
      colors,
      typography,
    });
  } catch (err) {
    console.error("Figma preview error:", err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

/**
 * POST /api/figma/plugin-styles
 * Figma Plugin が消費する形式で PaintStyle / TextStyle データを返す
 * Body: { dnaId?: string }
 * Figma Plugin UI (iframe) からのリクエストのため CORS オープン
 */
router.options("/plugin-styles", pluginCors);
router.post("/plugin-styles", pluginCors, verifyToken, (req, res) => {
  try {
    const { dnaId } = req.body;
    const dna = dnaId ? getDnaById(dnaId) : getLatestDna();
    if (!dna) {
      return res.status(404).json({ error: "デザインデータが見つかりません" });
    }

    const colors = extractColorsFromDna(dna.elements);
    const typography = extractTypographyFromDna(dna.elements);

    res.json({
      success: true,
      paintStyles: formatPaintStyles(colors),
      textStyles: formatTextStyles(typography),
      dnaSource: { id: dna.id, url: dna.url },
    });
  } catch (err) {
    console.error("Figma plugin-styles error:", err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

/**
 * POST /api/figma/images
 * Figma フレームのサムネイル画像 URL を取得
 * Body: { accessToken: string, fileKey: string, nodeIds: string[], format?: "png"|"svg" }
 */
router.post("/images", verifyToken, async (req, res) => {
  try {
    const { accessToken, fileKey, nodeIds, format } = req.body;
    if (!accessToken || !fileKey || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return res.status(400).json({ error: "accessToken, fileKey, nodeIds は必須です" });
    }

    const images = await getFigmaImages(accessToken, fileKey, nodeIds, format || "png");
    res.json({ success: true, images });
  } catch (err) {
    console.error("Figma images error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/figma/plugin-files
 * プラグインの 3 ファイルの内容を返す（クライアント側で Zip 生成用）
 */
router.get("/plugin-files", verifyToken, (req, res) => {
  const fs = require("fs");
  const path = require("path");
  // Docker: /app/src/routes → ../../apps  Local: server/src/routes → ../../../apps
  const candidates = [
    path.join(__dirname, "../../apps/figma-sync/plugin"),
    path.join(__dirname, "../../../apps/figma-sync/plugin"),
  ];
  const pluginDir = candidates.find((d) => fs.existsSync(d));

  if (!pluginDir) {
    return res.status(500).json({ error: "プラグインフォルダが見つかりません" });
  }

  try {
    // リクエスト元からサーバー URL を自動検出して ui.html に埋め込む
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const host = req.get("x-forwarded-host") || req.get("host");
    const serverUrl = `${protocol}://${host}`;

    const files = ["manifest.json", "code.js", "ui.html"].map((name) => {
      let content = fs.readFileSync(path.join(pluginDir, name), "utf-8");
      if (name === "ui.html") {
        content = content.replace(
          'var SERVER_URL = "http://localhost:4000"',
          'var SERVER_URL = "' + serverUrl + '"'
        );
      }
      return { name, content };
    });
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: `プラグインファイルの読み込みに失敗: ${err.message}` });
  }
});

module.exports = router;
