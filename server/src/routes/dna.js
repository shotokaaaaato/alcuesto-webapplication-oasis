const express = require("express");
const cors = require("cors");
const { extractDNA, extractPageDNA } = require("../services/dnaExtractor");
const { extractFigmaNodes, getFigmaFileStructure, downloadFigmaImage } = require("../services/figmaExtractor");
const { saveDna, getLatestDna, getAllDna, getAllDnaFull, getDnaById, updateDnaName, updateDnaLockedParts, updateDnaMasterImage, updateDnaType, updateDnaDeviceFrames, updateDnaPageStructure, deleteDnaById, deleteDnaByIds } = require("../models/dnaStore");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Figma Plugin iframe 用 CORS
const pluginCors = cors({ origin: true, credentials: true });

/**
 * POST /api/dna/extract-figma
 * Figma ファイルからレイヤーデータを抽出して design 化（全ユーザー）
 * Body: { accessToken: string, fileKey: string, nodeIds?: string[], frameName?: string }
 */
router.post("/extract-figma", verifyToken, async (req, res) => {
  const { accessToken, fileKey, nodeIds, frameName } = req.body;

  if (!accessToken || !fileKey) {
    return res.status(400).json({ error: "accessToken と fileKey は必須です" });
  }

  try {
    const { elements, fileName } = await extractFigmaNodes(accessToken, fileKey, nodeIds);
    if (elements.length === 0) {
      return res.status(404).json({ error: "抽出可能なノードが見つかりません" });
    }
    const userId = req.user?.id || "anonymous";
    // デフォルト名: "ファイル名 - フレーム名"
    let name = "";
    if (fileName && frameName) {
      name = `${fileName} - ${frameName}`;
    } else {
      name = frameName || fileName || "";
    }

    // マスター画像をダウンロード（Figma Images API でフレームをレンダリング）
    let masterImage = null;
    if (nodeIds && nodeIds.length > 0) {
      try {
        // ルート要素（最大面積）からフレームサイズを取得
        let rootBB = { width: 1440, height: 900 };
        for (const el of elements) {
          const bb = el.boundingBox;
          if (bb && bb.width * bb.height > rootBB.width * rootBB.height) {
            rootBB = bb;
          }
        }
        // 長いページは scale=1 にフォールバック
        const scale = rootBB.height > 5000 ? 1 : 2;
        const { filename } = await downloadFigmaImage(accessToken, fileKey, nodeIds[0], scale);
        masterImage = {
          filename,
          width: rootBB.width,
          height: rootBB.height,
          scale,
        };
      } catch (imgErr) {
        console.warn("Master image download failed:", imgErr.message);
      }
    }

    const saved = saveDna({ url: `figma://${fileKey}`, userId, elements, name, masterImage });
    res.json({
      success: true,
      data: elements,
      count: elements.length,
      savedId: saved.id,
      fileName,
      masterImage: masterImage ? { url: `/api/images/${masterImage.filename}` } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/dna/extract-figma-paired
 * PC/SP フレームを同時抽出して1レコードとして保存（Web デザイン用）
 * Body: { accessToken, fileKey, type: "web"|"graphic", pcNodeId?, spNodeId?, pcFrameName?, spFrameName? }
 */
router.post("/extract-figma-paired", verifyToken, async (req, res) => {
  const { accessToken, fileKey, type, pcNodeId, spNodeId, pcFrameName, spFrameName } = req.body;

  if (!accessToken || !fileKey) {
    return res.status(400).json({ error: "accessToken と fileKey は必須です" });
  }
  if (type === "web" && !pcNodeId) {
    return res.status(400).json({ error: "Web デザインの場合、PC フレームは必須です" });
  }

  try {
    const userId = req.user?.id || "anonymous";

    // ── Helper: extract + download master for a single frame ──
    async function extractFrame(nodeId, frameName) {
      const { elements, fileName } = await extractFigmaNodes(accessToken, fileKey, [nodeId]);
      let masterImage = null;
      if (elements.length > 0) {
        let rootBB = { width: 1440, height: 900 };
        for (const el of elements) {
          const bb = el.boundingBox;
          if (bb && bb.width * bb.height > rootBB.width * rootBB.height) rootBB = bb;
        }
        const scale = rootBB.height > 5000 ? 1 : 2;
        try {
          const { filename } = await downloadFigmaImage(accessToken, fileKey, nodeId, scale);
          masterImage = { filename, width: rootBB.width, height: rootBB.height, scale };
        } catch (imgErr) {
          console.warn(`Master image download failed for ${frameName}:`, imgErr.message);
        }
      }
      return { nodeId, name: frameName || "", elements, masterImage, fileName };
    }

    // ── Extract PC (required) ──
    const pc = await extractFrame(pcNodeId, pcFrameName);

    // ── Extract SP (optional) ──
    let sp = null;
    if (spNodeId) {
      sp = await extractFrame(spNodeId, spFrameName);
    }

    // ── Build record name ──
    const baseName = pc.fileName || "";
    let name = baseName;
    if (pcFrameName) name += ` - ${pcFrameName}`;
    if (spFrameName) name += ` / ${spFrameName}`;

    // ── Save: root elements/masterImage come from PC frame ──
    const saved = saveDna({
      url: `figma://${fileKey}`,
      userId,
      elements: pc.elements,
      name,
      masterImage: pc.masterImage,
      type: type || "web",
      deviceFrames: {
        pc: { nodeId: pc.nodeId, name: pc.name, elements: pc.elements, masterImage: pc.masterImage },
        sp: sp ? { nodeId: sp.nodeId, name: sp.name, elements: sp.elements, masterImage: sp.masterImage } : null,
      },
    });

    res.json({
      success: true,
      savedId: saved.id,
      fileName: pc.fileName,
      pcCount: pc.elements.length,
      spCount: sp ? sp.elements.length : 0,
      masterImage: pc.masterImage ? { url: `/api/images/${pc.masterImage.filename}` } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/dna/figma-structure
 * Figma ファイルのページ・ノード構造を取得（ノード選択 UI 用）
 * Body: { accessToken: string, fileKey: string }
 */
router.post("/figma-structure", verifyToken, async (req, res) => {
  const { accessToken, fileKey } = req.body;

  if (!accessToken || !fileKey) {
    return res.status(400).json({ error: "accessToken と fileKey は必須です" });
  }

  try {
    const structure = await getFigmaFileStructure(accessToken, fileKey);
    res.json({ success: true, ...structure });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/dna/extract
 * 単一要素のdesign抽出 — 管理者のみ（著作権コンプライアンス）
 * Body: { url: string, selector: string, depth?: number }
 */
router.post("/extract", verifyToken, requireAdmin, async (req, res) => {
  const { url, selector, depth } = req.body;

  if (!url || !selector) {
    return res.status(400).json({
      error: "url と selector は必須です",
    });
  }

  try {
    const dna = await extractDNA(url, selector, { depth: depth || 0 });
    const userId = req.user.id;
    const saved = saveDna({ url, userId, elements: [dna] });
    res.json({ success: true, data: dna, savedId: saved.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/dna/extract-page
 * ページ全体の主要要素を自動検出して抽出 — 管理者のみ（著作権コンプライアンス）design 形式
 * Body: { url: string }
 */
router.post("/extract-page", verifyToken, requireAdmin, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url は必須です" });
  }

  try {
    const dnaList = await extractPageDNA(url);
    const userId = req.user.id;
    const saved = saveDna({ url, userId, elements: dnaList });
    res.json({ success: true, data: dnaList, count: dnaList.length, savedId: saved.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/dna/bulk-delete
 * 複数のdesignレコードを一括削除（要認証）
 * Body: { ids: string[] }
 */
router.post("/bulk-delete", verifyToken, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids は配列で指定してください" });
  }
  const count = deleteDnaByIds(ids);
  res.json({ success: true, deletedCount: count });
});

/**
 * GET /api/dna/library
 * 保存済みdesign一覧を取得（要認証）
 */
router.options("/library", pluginCors);
router.get("/library", pluginCors, verifyToken, (req, res) => {
  const full = req.query.full === "true";
  const library = full ? getAllDnaFull() : getAllDna();
  res.json({ success: true, data: library });
});

/**
 * GET /api/dna/latest
 * 最新の保存済みdesignを取得（要認証）
 */
router.get("/latest", verifyToken, (req, res) => {
  const latest = getLatestDna();
  if (!latest) {
    return res.status(404).json({ error: "保存されたデザインがありません" });
  }
  res.json({ success: true, data: latest });
});

/**
 * GET /api/dna/:id
 * IDで特定のdesignを取得（要認証）
 */
router.get("/:id", verifyToken, (req, res) => {
  const dna = getDnaById(req.params.id);
  if (!dna) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, data: dna });
});

/**
 * PATCH /api/dna/:id/name
 * designレコードの名前を更新（要認証）
 * Body: { name: string }
 */
router.patch("/:id/name", verifyToken, (req, res) => {
  const { name } = req.body;
  if (typeof name !== "string") {
    return res.status(400).json({ error: "name は文字列で指定してください" });
  }
  const updated = updateDnaName(req.params.id, name);
  if (!updated) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, data: updated });
});

/**
 * PATCH /api/dna/:id/locked-parts
 * designレコードのロック済みパーツを更新（要認証）
 * Body: { lockedParts: Array<{ elementIndex: number, role: string, label: string }> }
 */
router.patch("/:id/locked-parts", verifyToken, (req, res) => {
  const { lockedParts } = req.body;
  if (!Array.isArray(lockedParts)) {
    return res.status(400).json({ error: "lockedParts は配列で指定してください" });
  }
  const updated = updateDnaLockedParts(req.params.id, lockedParts);
  if (!updated) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, data: updated });
});

/**
 * PATCH /api/dna/:id/type
 * designレコードのタイプ(web/graphic)を更新（要認証）
 * Body: { type: "web" | "graphic" }
 */
router.patch("/:id/type", verifyToken, (req, res) => {
  const { type } = req.body;
  if (type !== "web" && type !== "graphic") {
    return res.status(400).json({ error: "type は 'web' または 'graphic' で指定してください" });
  }
  const updated = updateDnaType(req.params.id, type);
  if (!updated) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, data: updated });
});

/**
 * PATCH /api/dna/:id/device-frames
 * designレコードのデバイスフレーム情報を更新（要認証）
 * Body: { deviceFrames: { pc?: {...}, sp?: {...} } }
 */
router.patch("/:id/device-frames", verifyToken, (req, res) => {
  const { deviceFrames } = req.body;
  if (!deviceFrames || typeof deviceFrames !== "object") {
    return res.status(400).json({ error: "deviceFrames はオブジェクトで指定してください" });
  }
  const updated = updateDnaDeviceFrames(req.params.id, deviceFrames);
  if (!updated) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, data: updated });
});

/**
 * PATCH /api/dna/:id/page-structure
 * designレコードのページ構成情報を更新（要認証）
 * Body: { pageStructure: { parts: [...], savedAt?: string } }
 */
router.patch("/:id/page-structure", verifyToken, (req, res) => {
  const { pageStructure } = req.body;
  if (!pageStructure || typeof pageStructure !== "object") {
    return res.status(400).json({ error: "pageStructure はオブジェクトで指定してください" });
  }
  if (!Array.isArray(pageStructure.parts)) {
    return res.status(400).json({ error: "pageStructure.parts は配列で指定してください" });
  }
  pageStructure.savedAt = new Date().toISOString();
  const updated = updateDnaPageStructure(req.params.id, pageStructure);
  if (!updated) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, data: updated });
});

/**
 * POST /api/dna/:id/capture-master
 * Figma マスター画像を（再）取得して保存（要認証）
 * Body: { accessToken: string }
 */
router.post("/:id/capture-master", verifyToken, async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: "accessToken は必須です" });
  }
  const dna = getDnaById(req.params.id);
  if (!dna) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  const fileKeyMatch = dna.url?.match(/^figma:\/\/(.+)/);
  if (!fileKeyMatch) {
    return res.status(400).json({ error: "Figma データではありません" });
  }

  // ルート要素（最大面積）の figmaNodeId を取得
  const rootEl = dna.elements.reduce((best, el) => {
    const area = (el.boundingBox?.width || 0) * (el.boundingBox?.height || 0);
    const bestArea = (best?.boundingBox?.width || 0) * (best?.boundingBox?.height || 0);
    return area > bestArea ? el : best;
  }, null);

  if (!rootEl?.figmaNodeId) {
    return res.status(400).json({ error: "ルートノードの Figma ID が見つかりません" });
  }

  try {
    const bb = rootEl.boundingBox;
    const scale = (bb?.height || 0) > 5000 ? 1 : 2;
    const { filename } = await downloadFigmaImage(accessToken, fileKeyMatch[1], rootEl.figmaNodeId, scale);
    const masterImage = {
      filename,
      width: bb?.width || 0,
      height: bb?.height || 0,
      scale,
    };
    updateDnaMasterImage(req.params.id, masterImage);
    res.json({ success: true, masterImage: { url: `/api/images/${filename}`, ...masterImage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/dna/:id
 * IDで特定のdesignレコードを削除（要認証）
 */
router.delete("/:id", verifyToken, (req, res) => {
  const deleted = deleteDnaById(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "デザインが見つかりません" });
  }
  res.json({ success: true, message: "削除しました" });
});

/**
 * POST /api/dna/save-generated
 * 生成されたページをデザインライブラリに新規保存（要認証）
 * Body: { sourceDnaId: string, name: string, previewHtml?: string, componentCode?: string }
 */
router.post("/save-generated", verifyToken, (req, res) => {
  const { sourceDnaId, name, previewHtml, componentCode } = req.body;

  if (!sourceDnaId || !name) {
    return res.status(400).json({ error: "sourceDnaId と name は必須です" });
  }

  const sourceDna = getDnaById(sourceDnaId);
  if (!sourceDna) {
    return res.status(404).json({ error: "元デザインが見つかりません" });
  }

  const userId = req.user?.id || "anonymous";
  const saved = saveDna({
    url: sourceDna.url,
    userId,
    elements: sourceDna.elements,
    name,
  });

  // 生成結果のメタ情報を追加
  if (previewHtml || componentCode) {
    const { readDnaLibrary } = require("../models/dnaStore");
    const fs = require("fs");
    const path = require("path");
    const library = readDnaLibrary();
    const idx = library.findIndex((d) => d.id === saved.id);
    if (idx !== -1) {
      library[idx].generatedPreview = previewHtml || "";
      library[idx].generatedCode = componentCode || "";
      library[idx].generatedFrom = sourceDnaId;
      const DATA_DIR = path.join(__dirname, "../../data");
      fs.writeFileSync(
        path.join(DATA_DIR, "dna-library.json"),
        JSON.stringify(library, null, 2),
        "utf-8"
      );
    }
  }

  res.json({ success: true, data: saved });
});

module.exports = router;
