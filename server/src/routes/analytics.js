const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { readDnaLibrary } = require("../models/dnaStore");
const { readTemplates } = require("../models/templateStore");

const router = express.Router();

/**
 * GET /api/analytics/stats
 * design ライブラリとテンプレートを集計してアナリティクスデータを返す
 */
router.get("/stats", verifyToken, (_req, res) => {
  try {
    const dnaLibrary = readDnaLibrary();
    const templates = readTemplates();

    // ── 1. デザイン・スタッツ（フォントサイズ・カラー分布） ──
    const fontSizeMap = {};
    const colorMap = {};
    const fontFamilyMap = {};

    for (const record of dnaLibrary) {
      for (const el of record.elements || []) {
        const typo = el.styles?.typography;
        const visual = el.styles?.visual;

        if (typo?.fontSize) {
          const size = Math.round(parseFloat(typo.fontSize));
          if (!isNaN(size) && size > 0) {
            fontSizeMap[size] = (fontSizeMap[size] || 0) + 1;
          }
        }

        if (typo?.color && typo.color !== "rgba(0, 0, 0, 0)") {
          colorMap[typo.color] = (colorMap[typo.color] || 0) + 1;
        }

        if (visual?.backgroundColor && visual.backgroundColor !== "rgba(0, 0, 0, 0)") {
          colorMap[visual.backgroundColor] = (colorMap[visual.backgroundColor] || 0) + 1;
        }

        if (typo?.fontFamily) {
          const family = typo.fontFamily.split(",")[0].trim().replace(/['"]/g, "");
          fontFamilyMap[family] = (fontFamilyMap[family] || 0) + 1;
        }
      }
    }

    const fontSizes = Object.entries(fontSizeMap)
      .map(([size, count]) => ({ size: Number(size), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const colors = Object.entries(colorMap)
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 16);

    const fontFamilies = Object.entries(fontFamilyMap)
      .map(([family, count]) => ({ family, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── 2. コーディング・プロファイル（レイアウト傾向） ──
    const layoutStats = {
      flex: 0,
      grid: 0,
      block: 0,
      inline: 0,
      total: 0,
    };
    const maxWidthMap = {};
    const positionMap = {};
    const gapMap = {};

    for (const record of dnaLibrary) {
      for (const el of record.elements || []) {
        const layout = el.styles?.layout;
        if (!layout) continue;

        layoutStats.total++;

        if (layout.display?.includes("flex")) layoutStats.flex++;
        else if (layout.display?.includes("grid")) layoutStats.grid++;
        else if (layout.display === "block") layoutStats.block++;
        else if (layout.display?.includes("inline")) layoutStats.inline++;

        if (layout.width && layout.width !== "auto" && layout.width !== "0px") {
          const w = parseFloat(layout.width);
          if (!isNaN(w) && w > 200) {
            const bucket = Math.round(w / 10) * 10;
            maxWidthMap[bucket] = (maxWidthMap[bucket] || 0) + 1;
          }
        }

        if (layout.position && layout.position !== "static") {
          positionMap[layout.position] = (positionMap[layout.position] || 0) + 1;
        }

        if (layout.gap && layout.gap !== "normal" && layout.gap !== "0px") {
          const g = Math.round(parseFloat(layout.gap));
          if (!isNaN(g) && g > 0) {
            gapMap[g] = (gapMap[g] || 0) + 1;
          }
        }
      }
    }

    const widthDistribution = Object.entries(maxWidthMap)
      .map(([width, count]) => ({ width: Number(width), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const gapDistribution = Object.entries(gapMap)
      .map(([gap, count]) => ({ gap: Number(gap), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── 3. パーツ・インベントリ（カテゴリ分布） ──
    const categoryMap = {};
    const tagMap = {};

    for (const t of templates) {
      const cat = t.templateMeta?.category || (t.isTemplate ? "other" : "generated");
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }

    for (const record of dnaLibrary) {
      for (const el of record.elements || []) {
        if (el.tagName) {
          tagMap[el.tagName] = (tagMap[el.tagName] || 0) + 1;
        }
      }
    }

    const categories = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const tagDistribution = Object.entries(tagMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // ── サマリー ──
    res.json({
      success: true,
      data: {
        summary: {
          totalDnaRecords: dnaLibrary.length,
          totalElements: dnaLibrary.reduce((sum, r) => sum + (r.elements?.length || 0), 0),
          totalTemplates: templates.length,
          registeredTemplates: templates.filter((t) => t.isTemplate).length,
        },
        designStats: {
          fontSizes,
          colors,
          fontFamilies,
        },
        codingProfile: {
          layoutStats,
          widthDistribution,
          gapDistribution,
          positionMap,
        },
        partsInventory: {
          categories,
          tagDistribution,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: `集計に失敗しました: ${err.message}` });
  }
});

module.exports = router;
