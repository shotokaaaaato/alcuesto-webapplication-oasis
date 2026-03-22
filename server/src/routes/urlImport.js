const express = require("express");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { scanUrl, VIEWPORTS } = require("../services/urlScannerService");
const { saveDna, getDnaById, updateDnaDeviceFrames } = require("../models/dnaStore");

const router = express.Router();

// ── ヘルパー: 要素を再帰カウント ──
function countElements(elements) {
  let count = 0;
  for (const el of elements) {
    count += 1;
    if (el.children && el.children.length > 0) {
      count += countElements(el.children);
    }
  }
  return count;
}

/**
 * POST /api/url-import/scan
 * 管理者専用: 指定 URL を 3 ビューポートでスキャン
 */
router.post("/scan", verifyToken, requireAdmin, async (req, res) => {
  const { url, viewports } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url は必須です" });
  }

  // URL フォーマットバリデーション
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "有効な URL を入力してください" });
  }

  const keys = viewports || ["sp", "tablet", "pc"];
  const invalidKeys = keys.filter((k) => !VIEWPORTS[k]);
  if (invalidKeys.length > 0) {
    return res
      .status(400)
      .json({ error: `無効なビューポート: ${invalidKeys.join(", ")}` });
  }

  try {
    const results = await scanUrl(url, keys);

    // クライアント向けにレスポンスを整形
    const scanResults = {};
    for (const [key, data] of Object.entries(results)) {
      scanResults[key] = {
        elements: data.elements,
        elementCount: countElements(data.elements),
        masterImage: data.masterImage
          ? {
              ...data.masterImage,
              url: `/api/images/${data.masterImage.filename}`,
            }
          : null,
        viewport: data.viewport,
      };
    }

    res.json({ success: true, scanResults });
  } catch (err) {
    console.error("URL scan error:", err);
    res.status(500).json({ error: err.message || "スキャンに失敗しました" });
  }
});

/**
 * POST /api/url-import/save
 * 管理者専用: スキャン結果をデザインライブラリに保存
 */
router.post("/save", verifyToken, requireAdmin, async (req, res) => {
  const { url, name, scanResults, selectedViewports } = req.body;

  if (!url || !scanResults || !selectedViewports || selectedViewports.length === 0) {
    return res
      .status(400)
      .json({ error: "url, scanResults, selectedViewports は必須です" });
  }

  try {
    const userId = req.user.id;

    // プライマリビューポートの決定 (PC > Tablet > SP)
    const primary = selectedViewports.includes("pc")
      ? "pc"
      : selectedViewports.includes("tablet")
        ? "tablet"
        : selectedViewports[0];

    const primaryData = scanResults[primary];
    if (!primaryData) {
      return res.status(400).json({ error: `選択されたビューポート "${primary}" のデータがありません` });
    }

    // deviceFrames 構築 (制作ウィザード互換: pc + sp)
    const deviceFrames = {};

    // PC フレーム
    if (selectedViewports.includes("pc") && scanResults.pc) {
      deviceFrames.pc = {
        nodeId: "url-scan-pc",
        name: "PC (1440px)",
        elements: scanResults.pc.elements,
        masterImage: scanResults.pc.masterImage || null,
      };
    } else if (selectedViewports.includes("tablet") && scanResults.tablet) {
      // Tablet を PC フレームとしてフォールバック
      deviceFrames.pc = {
        nodeId: "url-scan-tablet",
        name: "Tablet (768px)",
        elements: scanResults.tablet.elements,
        masterImage: scanResults.tablet.masterImage || null,
      };
    }

    // SP フレーム
    if (selectedViewports.includes("sp") && scanResults.sp) {
      deviceFrames.sp = {
        nodeId: "url-scan-sp",
        name: "SP (375px)",
        elements: scanResults.sp.elements,
        masterImage: scanResults.sp.masterImage || null,
      };
    }

    const saved = saveDna({
      url,
      userId,
      elements: primaryData.elements,
      name: name || url,
      masterImage: primaryData.masterImage || null,
      type: "web",
      deviceFrames: Object.keys(deviceFrames).length > 0 ? deviceFrames : null,
    });

    res.json({ success: true, savedId: saved.id });
  } catch (err) {
    console.error("URL import save error:", err);
    res.status(500).json({ error: err.message || "保存に失敗しました" });
  }
});

/**
 * POST /api/url-import/save-device
 * 管理者専用: 1 デバイス分のスキャン結果を保存（逐次保存用）
 * - recordId なし → 新規レコード作成
 * - recordId あり → 既存レコードに deviceFrame を追加
 */
router.post("/save-device", verifyToken, requireAdmin, async (req, res) => {
  const { url, name, viewportKey, elements, masterImage, recordId } = req.body;

  if (!viewportKey || !elements) {
    return res.status(400).json({ error: "viewportKey, elements は必須です" });
  }

  const validKeys = ["sp", "tablet", "pc"];
  if (!validKeys.includes(viewportKey)) {
    return res.status(400).json({ error: `無効なビューポート: ${viewportKey}` });
  }

  try {
    const userId = req.user.id;

    // deviceFrames のキー: tablet → pc にマッピング (制作ウィザード互換)
    const frameKey = viewportKey === "sp" ? "sp" : "pc";
    const frameName =
      viewportKey === "pc"
        ? "PC (1440px)"
        : viewportKey === "tablet"
          ? "Tablet (768px)"
          : "SP (375px)";

    const frame = {
      nodeId: `url-scan-${viewportKey}`,
      name: frameName,
      elements,
      masterImage: masterImage || null,
    };

    if (recordId) {
      // 既存レコードのデバイスフレームを更新
      const existing = getDnaById(recordId);
      if (!existing) {
        return res.status(404).json({ error: "レコードが見つかりません" });
      }
      const deviceFrames = existing.deviceFrames || {};
      deviceFrames[frameKey] = frame;
      updateDnaDeviceFrames(recordId, deviceFrames);

      res.json({ success: true, savedId: recordId });
    } else {
      // 新規レコード作成（最初のデバイス）
      if (!url) {
        return res.status(400).json({ error: "新規保存時は url が必須です" });
      }
      const deviceFrames = {};
      deviceFrames[frameKey] = frame;

      const saved = saveDna({
        url,
        userId,
        elements,
        name: name || url,
        masterImage: masterImage || null,
        type: "web",
        deviceFrames,
      });

      res.json({ success: true, savedId: saved.id });
    }
  } catch (err) {
    console.error("URL import save-device error:", err);
    res.status(500).json({ error: err.message || "保存に失敗しました" });
  }
});

module.exports = router;
