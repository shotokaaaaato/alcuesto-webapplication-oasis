const express = require("express");
const { extractDNA, extractPageDNA } = require("../services/dnaExtractor");

const router = express.Router();

/**
 * POST /api/dna/extract
 * 単一要素のDNA抽出
 * Body: { url: string, selector: string, depth?: number }
 */
router.post("/extract", async (req, res) => {
  const { url, selector, depth } = req.body;

  if (!url || !selector) {
    return res.status(400).json({
      error: "url と selector は必須です",
    });
  }

  try {
    const dna = await extractDNA(url, selector, { depth: depth || 0 });
    res.json({ success: true, data: dna });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/dna/extract-page
 * ページ全体の主要要素を自動検出して抽出
 * Body: { url: string }
 */
router.post("/extract-page", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url は必須です" });
  }

  try {
    const dnaList = await extractPageDNA(url);
    res.json({ success: true, data: dnaList, count: dnaList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
