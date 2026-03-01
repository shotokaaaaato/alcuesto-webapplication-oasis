// ─────────────────────────────────────────────────────
// OASIS Sync Tool — Figma Plugin (main thread)
// createPaintStyle / createTextStyle で Local Styles を作成・更新
// ─────────────────────────────────────────────────────

figma.showUI(__html__, { width: 420, height: 560 });

// CSS 汎用フォントファミリー（Figma に実フォントとして存在しない）
var GENERIC_FONTS = [
  "sans-serif", "serif", "monospace", "cursive", "fantasy",
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
];

// タイムアウト付き loadFontAsync（デフォルト 5秒）
function loadFontWithTimeout(fontName, ms) {
  if (!ms) ms = 5000;
  return Promise.race([
    figma.loadFontAsync(fontName),
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("Font load timeout: " + fontName.family + " " + fontName.style));
      }, ms);
    }),
  ]);
}

figma.ui.onmessage = async function (msg) {
  // ── Paint Styles + Text Styles 同期 ────────────
  if (msg.type === "sync-styles") {
    var paintStyles = msg.paintStyles;
    var textStyles = msg.textStyles;
    var result = {
      colors: { created: 0, updated: 0, errors: [] },
      typography: { created: 0, updated: 0, errors: [] },
      fontSubstitutions: [], // { original: "Helvetica Bold", resolved: "Inter Regular" }
    };

    // 進捗を UI に通知
    function sendProgress(text) {
      figma.ui.postMessage({ type: "sync-progress", text: text });
    }

    // ── 1. Paint Styles (塗りスタイル) ── 同期処理（フォント不要で高速）
    sendProgress("Paint Styles を同期中... (0/" + paintStyles.length + ")");
    var existingPaints = figma.getLocalPaintStyles();

    for (var pi = 0; pi < paintStyles.length; pi++) {
      var ps = paintStyles[pi];
      try {
        var existingPaint = null;
        for (var ep = 0; ep < existingPaints.length; ep++) {
          if (existingPaints[ep].name === ps.name) { existingPaint = existingPaints[ep]; break; }
        }
        var paints = [
          {
            type: ps.paint.type,
            color: ps.paint.color,
            opacity: ps.paint.opacity,
          },
        ];

        if (existingPaint) {
          existingPaint.paints = paints;
          result.colors.updated++;
        } else {
          var newPaint = figma.createPaintStyle();
          newPaint.name = ps.name;
          newPaint.paints = paints;
          result.colors.created++;
        }
      } catch (err) {
        result.colors.errors.push(ps.name + ": " + err.message);
      }
    }
    sendProgress("Paint Styles 完了 (" + paintStyles.length + "/" + paintStyles.length + ")");

    // ── 2. フォントのバッチプリロード ──
    // ユニークなフォントを収集し、一括ロード（重複排除）
    sendProgress("フォントをプリロード中...");
    var fontCache = {}; // "family::style" → loaded fontName or null

    // 収集: 各テキストスタイルに対して候補フォントリストを作成
    var fontsToLoad = [];
    for (var ti = 0; ti < textStyles.length; ti++) {
      var ts = textStyles[ti];
      var family = ts.fontName.family;
      // 汎用フォント名はスキップ → 直接 Inter にフォールバック
      var isGeneric = false;
      for (var gi = 0; gi < GENERIC_FONTS.length; gi++) {
        if (family.toLowerCase() === GENERIC_FONTS[gi]) { isGeneric = true; break; }
      }
      if (isGeneric) continue;

      // 候補: 指定スタイル → Regular
      var candidates = [
        { family: family, style: ts.fontName.style },
        { family: family, style: "Regular" },
      ];
      for (var ci = 0; ci < candidates.length; ci++) {
        var key = candidates[ci].family + "::" + candidates[ci].style;
        if (!(key in fontCache)) {
          fontCache[key] = null; // placeholder
          fontsToLoad.push(candidates[ci]);
        }
      }
    }
    // Inter Regular は必ずロード（最終フォールバック）
    var interKey = "Inter::Regular";
    if (!(interKey in fontCache)) {
      fontCache[interKey] = null;
      fontsToLoad.push({ family: "Inter", style: "Regular" });
    }

    // バッチロード（並列、タイムアウト付き）
    var loadPromises = [];
    for (var fi = 0; fi < fontsToLoad.length; fi++) {
      (function (font) {
        var k = font.family + "::" + font.style;
        loadPromises.push(
          loadFontWithTimeout(font, 5000)
            .then(function () { fontCache[k] = font; })
            .catch(function () { fontCache[k] = null; })
        );
      })(fontsToLoad[fi]);
    }
    await Promise.all(loadPromises);
    sendProgress("フォントプリロード完了 (" + fontsToLoad.length + " 件)");

    // ── 3. Text Styles (テキストスタイル) ── フォントは既にキャッシュ済み
    var existingTexts = figma.getLocalTextStyles();
    var interFont = fontCache[interKey] ? { family: "Inter", style: "Regular" } : null;

    for (var tsi = 0; tsi < textStyles.length; tsi++) {
      var tst = textStyles[tsi];
      sendProgress("Text Styles を同期中... (" + (tsi + 1) + "/" + textStyles.length + ")");
      try {
        var existingText = null;
        for (var et = 0; et < existingTexts.length; et++) {
          if (existingTexts[et].name === tst.name) { existingText = existingTexts[et]; break; }
        }
        var style = existingText || figma.createTextStyle();

        if (!existingText) {
          style.name = tst.name;
          result.typography.created++;
        } else {
          result.typography.updated++;
        }

        // キャッシュからフォントを解決
        var family2 = tst.fontName.family;
        var isGeneric2 = false;
        for (var gi2 = 0; gi2 < GENERIC_FONTS.length; gi2++) {
          if (family2.toLowerCase() === GENERIC_FONTS[gi2]) { isGeneric2 = true; break; }
        }

        var originalFontLabel = family2 + " " + tst.fontName.style;
        var resolvedFont = null;
        if (!isGeneric2) {
          var k1 = family2 + "::" + tst.fontName.style;
          var k2 = family2 + "::Regular";
          if (fontCache[k1]) resolvedFont = fontCache[k1];
          else if (fontCache[k2]) resolvedFont = fontCache[k2];
        }
        if (!resolvedFont) resolvedFont = interFont;

        // フォントが置換された場合は記録
        if (resolvedFont) {
          var resolvedLabel = resolvedFont.family + " " + resolvedFont.style;
          if (resolvedLabel !== originalFontLabel) {
            result.fontSubstitutions.push({
              original: originalFontLabel,
              resolved: resolvedLabel,
              styleName: tst.name,
            });
          }
        }

        if (resolvedFont) {
          style.fontName = resolvedFont;
          style.fontSize = tst.fontSize;

          if (tst.lineHeight) {
            style.lineHeight = tst.lineHeight;
          }
          if (tst.letterSpacing) {
            style.letterSpacing = tst.letterSpacing;
          }
        } else {
          result.typography.errors.push(tst.name + ": フォントをロードできませんでした");
        }
      } catch (err) {
        result.typography.errors.push(tst.name + ": " + err.message);
      }
    }

    figma.ui.postMessage({
      type: "sync-result",
      colors: result.colors,
      typography: result.typography,
      fontSubstitutions: result.fontSubstitutions,
    });
  }

  // ── プラグイン終了 ────────────────────────────
  if (msg.type === "close") {
    figma.closePlugin();
  }
};
