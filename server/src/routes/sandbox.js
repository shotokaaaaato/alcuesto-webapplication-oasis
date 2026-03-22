const express = require("express");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { callAI } = require("../services/aiClientFactory");
const {
  extractDnaSummary,
  sanitizeComponentOutput,
} = require("../services/aiRefactorService");
const { getDnaById, getAllDna, updateDnaElements } = require("../models/dnaStore");
const { scanAtViewport } = require("../services/urlScannerService");

const router = express.Router();

// ────────────────────────────────────────────
// GET /api/sandbox/designs
// デザインライブラリ一覧（軽量: elements は含まない）
// ────────────────────────────────────────────
router.get("/designs", verifyToken, requireAdmin, (_req, res) => {
  const all = getAllDna();
  const list = all.map((d) => ({
    id: d.id,
    name: d.name || d.url || "Untitled",
    type: d.type || "graphic",
    url: d.url,
    createdAt: d.createdAt,
    elementCount: d.elementCount || (d.elements || []).length,
    hasDeviceFrames: !!d.deviceFrames,
    deviceFrameKeys: d.deviceFrames ? Object.keys(d.deviceFrames) : [],
    masterImage: d.masterImage
      ? { filename: d.masterImage.filename, width: d.masterImage.width, height: d.masterImage.height }
      : null,
  }));
  res.json({ success: true, data: list });
});

// ────────────────────────────────────────────
// GET /api/sandbox/designs/:id/elements
// 特定デザインの elements を取得
// ────────────────────────────────────────────
router.get("/designs/:id/elements", verifyToken, requireAdmin, (req, res) => {
  const dna = getDnaById(req.params.id);
  if (!dna) return res.status(404).json({ error: "デザインが見つかりません" });

  const deviceFrame = req.query.deviceFrame;
  let elements;
  let masterImage;

  if (deviceFrame && dna.deviceFrames?.[deviceFrame]) {
    elements = dna.deviceFrames[deviceFrame].elements || [];
    masterImage = dna.deviceFrames[deviceFrame].masterImage || null;
  } else {
    elements = dna.elements || [];
    masterImage = dna.masterImage || null;
  }

  // 各 root 要素のサマリーを返す（選択 UI 用）
  const elementSummaries = elements.map((el, i) => ({
    index: i,
    tagName: el.tagName,
    selector: el.selector,
    figmaNodeName: el.figmaNodeName,
    textPreview: (el.textContent || "").slice(0, 80),
    childCount: (el.children || []).length,
    boundingBox: el.boundingBox,
  }));

  res.json({
    success: true,
    elementSummaries,
    elementCount: elements.length,
    masterImage: masterImage
      ? { filename: masterImage.filename, width: masterImage.width, height: masterImage.height }
      : null,
  });
});

// ────────────────────────────────────────────
// POST /api/sandbox/rescan/:id
// URL を更新済みスキャナーで再スキャンし elements を更新
// ────────────────────────────────────────────
router.post("/rescan/:id", verifyToken, requireAdmin, async (req, res) => {
  const dna = getDnaById(req.params.id);
  if (!dna) return res.status(404).json({ error: "デザインが見つかりません" });

  const url = dna.url;
  if (!url || url.startsWith("figma://")) {
    return res.status(400).json({ error: "URL インポートのデザインのみ再スキャン可能です" });
  }

  const viewport = req.body.viewport || "pc";
  try {
    console.log(`[Sandbox] Re-scanning ${url} at ${viewport}...`);
    const result = await scanAtViewport(url, viewport);

    // 要素 + マスター画像 + ボディ背景を更新
    const updated = updateDnaElements(
      req.params.id,
      result.elements,
      result.masterImage,
      result.bodyBackground || null
    );

    if (!updated) return res.status(500).json({ error: "更新に失敗しました" });

    console.log(`[Sandbox] Re-scan complete: ${result.elements.length} elements, bodyBg: ${result.bodyBackground?.backgroundColor}`);

    res.json({
      success: true,
      elementCount: result.elements.length,
      masterImage: result.masterImage,
      bodyBackground: result.bodyBackground,
    });
  } catch (err) {
    console.error("[Sandbox] Re-scan error:", err.message);
    res.status(500).json({ error: `再スキャンに失敗: ${err.message}` });
  }
});

// ────────────────────────────────────────────
// POST /api/sandbox/generate
// 隔離された AI 生成 — elements + テキスト → sectionHtml
// ────────────────────────────────────────────
router.post("/generate", verifyToken, requireAdmin, async (req, res) => {
  const {
    dnaId,
    deviceFrame,
    elementIndices,
    userText,
    mode,         // "clone-keep" | "clone-replace" | "reference"
    model,
    apiKey,
  } = req.body;

  if (!dnaId) return res.status(400).json({ error: "dnaId は必須です" });

  const dna = getDnaById(dnaId);
  if (!dna) return res.status(404).json({ error: "デザインが見つかりません" });

  // 要素取得
  let allElements;
  if (deviceFrame && dna.deviceFrames?.[deviceFrame]) {
    allElements = dna.deviceFrames[deviceFrame].elements || [];
  } else {
    allElements = dna.elements || [];
  }

  // 要素フィルタ
  let sourceElements;
  if (elementIndices && elementIndices.length > 0) {
    sourceElements = allElements.filter((_, i) => elementIndices.includes(i));
  } else {
    sourceElements = allElements;
  }

  if (sourceElements.length === 0) {
    return res.status(400).json({ error: "選択された要素がありません" });
  }

  // リクエストペイロードのサイズ計測
  const requestPayload = JSON.stringify(req.body);
  const requestSize = Buffer.byteLength(requestPayload, "utf8");

  const generateMode = mode || "reference";

  try {
    let sectionHtml = "";
    let aiPromptSent = "";
    let aiResponseRaw = "";

    if (generateMode === "clone-keep") {
      // 完全再現（そのまま）— AI 不要、ソース要素から直接 HTML 構築
      sectionHtml = renderCloneSection(sourceElements, "section");

      // ── 背景色の継承: セクションルートに背景がなければ bodyBackground を適用 ──
      const rootEl = sourceElements[0];
      const rootBg = rootEl?.styles?.visual?.backgroundColor;
      const rootBgImg = rootEl?.styles?.visual?.backgroundImage;
      const hasRootBg = (rootBg && rootBg !== "rgba(0, 0, 0, 0)") || (rootBgImg && rootBgImg !== "none");
      if (!hasRootBg && dna.bodyBackground) {
        const bb = dna.bodyBackground;
        const bgStyles = [];
        if (bb.backgroundColor && bb.backgroundColor !== "rgba(0, 0, 0, 0)") {
          bgStyles.push(`background-color:${bb.backgroundColor}`);
        }
        if (bb.backgroundImage && bb.backgroundImage !== "none") {
          bgStyles.push(`background-image:${bb.backgroundImage}`);
        }
        if (bgStyles.length > 0) {
          // sectionHtml の最初のタグに背景スタイルを注入
          sectionHtml = sectionHtml.replace(
            /^(<\w+)([\s>])/,
            (_, tag, rest) => {
              const inject = bgStyles.join(";");
              // 既存 style 属性があればマージ、なければ追加
              if (_.includes('style="')) {
                return _.replace(/style="/, `style="${inject};`);
              }
              return `${tag} style="${inject}"${rest}`;
            }
          );
        }
      }

      aiPromptSent = "(AI 未使用 — clone-keep モード)";
      aiResponseRaw = "(AI 未使用)";

    } else if (generateMode === "clone-replace") {
      // 完全再現（入替）— 構造保持 + テキスト差替
      const baseHtml = renderCloneSection(sourceElements, "section");

      if (!userText) {
        sectionHtml = baseHtml;
        aiPromptSent = "(テキスト未指定 — baseHtml をそのまま返却)";
        aiResponseRaw = "(AI 未使用)";
      } else {
        const provider = model || "deepseek";
        const key = apiKey || process.env.deepseek_API_KEY;
        if (!key) return res.status(500).json({ error: "API キーが未設定です" });

        const prompt = `あなたは HTML エディターです。以下の HTML の**テキスト内容だけ**を差し替えてください。

## 最優先ルール（style 属性の完全保持）
**入力 HTML に存在する style 属性は 1 バイトたりとも変更してはいけません。**
各タグの style="..." 内にある background-color, font-size, color, position, padding, border, display, width, height, margin, font-family, font-weight, line-height, border-radius, box-shadow, opacity, overflow — これらの CSS プロパティと値を**絶対にそのまま保持**してください。

## 絶対厳守ルール
1. HTML タグ構造は一切変更禁止（タグの追加・削除・並び替え・ネスト変更すべて禁止）
2. style 属性の値は一切変更禁止（プロパティの追加・削除・変更すべて禁止）
3. class 属性は一切変更禁止
4. 変更するのは**テキストノード（タグの開始タグと終了タグの間のテキスト）のみ**
5. <img> タグの src/alt 属性は変更しない

## 差し替え用テキスト
${userText}

## 元の HTML
\`\`\`html
${baseHtml}
\`\`\`

上記 HTML のテキストだけを差し替えた結果の HTML のみ出力してください。説明不要。\`\`\`html で囲まず HTML のみ。`;

        aiPromptSent = prompt;
        const aiResult = await callAI(prompt, "", { provider, apiKey: key, maxTokens: 4000 });
        aiResponseRaw = aiResult;
        sectionHtml = aiResult.replace(/```(?:html)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();
        if (!sectionHtml.includes("<")) sectionHtml = baseHtml;
      }

    } else {
      // reference モード — DNA スタイルを style 属性に直接書き込むよう強制
      const provider = model || "deepseek";
      const key = apiKey || process.env.deepseek_API_KEY;
      if (!key) return res.status(500).json({ error: "API キーが未設定です" });

      const summary = extractDnaSummary(sourceElements);

      // ソース要素から具体的な CSS プロパティ値を抽出（AI に強制適用させる）
      const styleExtracts = sourceElements.slice(0, 8).map((el) => {
        const v = el.styles?.visual || {};
        const l = el.styles?.layout || {};
        const t = el.styles?.typography || {};
        return {
          tag: el.tagName,
          name: el.figmaNodeName || el.selector || el.tagName,
          css: {
            "background-color": v.backgroundColor && v.backgroundColor !== "rgba(0, 0, 0, 0)" ? v.backgroundColor : undefined,
            "border-radius": v.borderRadius && v.borderRadius !== "0px" ? v.borderRadius : undefined,
            border: v.border && v.border !== "none" && v.border !== "0px none" ? v.border : undefined,
            "box-shadow": v.boxShadow && v.boxShadow !== "none" ? v.boxShadow : undefined,
            opacity: v.opacity && v.opacity !== "1" ? v.opacity : undefined,
            display: l.display || undefined,
            padding: l.padding && l.padding !== "0px" ? l.padding : undefined,
            margin: l.margin && l.margin !== "0px" ? l.margin : undefined,
            width: l.width && l.width !== "auto" ? l.width : undefined,
            "font-family": t.fontFamily || undefined,
            "font-size": t.fontSize || undefined,
            "font-weight": t.fontWeight && t.fontWeight !== "400" ? t.fontWeight : undefined,
            "line-height": t.lineHeight && t.lineHeight !== "normal" ? t.lineHeight : undefined,
            color: t.color || undefined,
          },
        };
      }).map((item) => {
        // undefined を除去
        const cleaned = {};
        for (const [k, v] of Object.entries(item.css)) {
          if (v !== undefined) cleaned[k] = v;
        }
        return { ...item, css: cleaned };
      });

      const styleExtractsStr = styleExtracts.map((s) => {
        const cssStr = Object.entries(s.css).map(([k, v]) => `${k}:${v}`).join("; ");
        return `  <${s.tag}> "${s.name}" → style="${cssStr}"`;
      }).join("\n");

      const systemPrompt = `あなたはシニアウェブデザイナーです。
参照デザインの DNA スタイルを**忠実に再現**したセクション HTML を生成してください。

## 最優先ルール — style 属性への直接書き込み（違反は評価ゼロ）

生成する **すべての HTML タグ** に、参照元 DNA から抽出した CSS プロパティを **style 属性に直接記述** してください。
Tailwind クラスだけに頼らず、以下のプロパティは必ず style="..." に含めること:

- background-color（背景色 — 白にしない。DNA の値をそのまま使う）
- color（文字色 — DNA の値をそのまま使う）
- font-family（フォント — DNA の値をそのまま使う）
- font-size（文字サイズ）
- font-weight（太さ）
- line-height（行間）
- padding（内余白）
- border-radius（角丸）
- border（枠線）
- box-shadow（影）

### 具体的な DNA スタイル値（これらを style 属性にそのまま書き込め）
${styleExtractsStr}

## 構造ルール
- <section> を 1 つだけ出力
- <section> の style 属性に必ず background-color を含める
- セマンティック HTML (header, nav, h2, p, ul, button 等)
- モバイルファースト、Tailwind ユーティリティも併用可

## 出力形式
HTML のみ出力（JSON 不要、説明不要）。\`\`\`html で囲まず <section> タグから始めてください。`;

      const userMessage = `## ユーザー指示
${userText || "このデザインスタイルを使ったランディングページのヒーローセクションを生成してください"}

## 参照デザインの要素構造
${JSON.stringify(sourceElements.slice(0, 5).map(el => ({
  tag: el.tagName,
  selector: el.selector,
  text: (el.textContent || "").slice(0, 100),
  styles: el.styles,
  childCount: (el.children || []).length,
})), null, 2)}

## DNA サマリー
${JSON.stringify(summary, null, 2)}`;

      aiPromptSent = `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${userMessage}`;
      const aiResult = await callAI(systemPrompt, userMessage, { provider, apiKey: key, maxTokens: 4000 });
      aiResponseRaw = aiResult;

      // HTML 抽出（JSON ラップ対応 + フォールバック）
      let cleaned = aiResult.replace(/```(?:json|html|jsx)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();
      // JSON ラップされている場合
      try {
        const parsed = JSON.parse(cleaned);
        sectionHtml = parsed.sectionHtml || parsed.html || "";
      } catch {
        // <section> タグを直接抽出
        const htmlMatch = cleaned.match(/<section[\s\S]*<\/section>/i);
        sectionHtml = htmlMatch ? htmlMatch[0] : cleaned;
      }
    }

    // サニタイズ（sandbox ではトラッキング除去のみ、position:absolute 除去はスキップ）
    const sanitized = sanitizeComponentOutput(sectionHtml, sectionHtml);

    // ソース要素のスタイルマップを生成（クライアント側 DNA インジェクター用）
    const dnaStyleMap = extractDnaStyleMap(sourceElements);

    const responsePayload = {
      success: true,
      sectionHtml: sanitized.previewHtml,
      dnaStyleMap,
      requestSizeBytes: requestSize,
      responseSizeBytes: 0, // 後で計算
      aiPromptSent,
      aiResponseRaw,
      sourceElementCount: sourceElements.length,
      mode: generateMode,
    };
    responsePayload.responseSizeBytes = Buffer.byteLength(JSON.stringify(responsePayload), "utf8");

    res.json(responsePayload);
  } catch (err) {
    res.status(500).json({
      error: `生成に失敗: ${err.message}`,
      requestSizeBytes: requestSize,
    });
  }
});

// ─── DNA スタイルマップ抽出（クライアント側インジェクター用） ───
function extractDnaStyleMap(sourceElements) {
  const result = {
    // セクション全体に適用するルートスタイル
    rootStyles: {},
    // 支配的な色・フォント
    dominantBg: null,
    dominantTextColor: null,
    dominantFont: null,
    // 全要素から集約したスタイル値
    palette: { backgrounds: [], textColors: [] },
    fonts: [],
  };

  let maxArea = 0;
  const fontSet = new Set();
  const bgSet = new Set();
  const textColorSet = new Set();

  function processEl(el, depth) {
    const v = el.styles?.visual || {};
    const l = el.styles?.layout || {};
    const t = el.styles?.typography || {};
    const bb = el.boundingBox || {};
    const area = (bb.width || 0) * (bb.height || 0);

    // 背景色集約（backgroundColor + background/backgroundImage グラデーション対応）
    const hasBgColor = v.backgroundColor && v.backgroundColor !== "rgba(0, 0, 0, 0)";
    const hasBgImage = v.backgroundImage && v.backgroundImage !== "none";
    const hasBgShorthand = v.background && v.background !== "none" && !v.background.startsWith("rgba(0, 0, 0, 0)");
    if (hasBgColor) {
      bgSet.add(v.backgroundColor);
      if (area > maxArea && depth < 2) {
        maxArea = area;
        result.dominantBg = v.backgroundColor;
      }
    } else if ((hasBgImage || hasBgShorthand) && depth < 2) {
      // グラデーション等の background-image から色を抽出
      const bgVal = v.backgroundImage || v.background || "";
      const colorMatch = bgVal.match(/rgb\([^)]+\)|rgba\([^)]+\)|#[0-9a-fA-F]{3,8}/);
      if (colorMatch) {
        bgSet.add(colorMatch[0]);
        if (area > maxArea) {
          maxArea = area;
          result.dominantBg = colorMatch[0];
        }
      }
    }
    // テキスト色集約
    if (t.color && t.color.startsWith("rgb")) {
      textColorSet.add(t.color);
      if (!result.dominantTextColor) result.dominantTextColor = t.color;
    }
    // フォント集約
    if (t.fontFamily) fontSet.add(t.fontFamily);

    // ルート要素（depth=0）のスタイルを rootStyles に
    if (depth === 0) {
      if (hasBgColor) {
        result.rootStyles["background-color"] = v.backgroundColor;
      } else if (hasBgImage) {
        result.rootStyles["background-image"] = v.backgroundImage;
      } else if (hasBgShorthand) {
        result.rootStyles["background"] = v.background;
      }
      if (l.padding && l.padding !== "0px") result.rootStyles.padding = l.padding;
      if (l.display) result.rootStyles.display = l.display;
      if (l.flexDirection && l.flexDirection !== "row") result.rootStyles["flex-direction"] = l.flexDirection;
      if (l.justifyContent) result.rootStyles["justify-content"] = l.justifyContent;
      if (l.alignItems) result.rootStyles["align-items"] = l.alignItems;
      if (l.gap && l.gap !== "normal" && l.gap !== "0px") result.rootStyles.gap = l.gap;
      if (t.fontFamily) result.rootStyles["font-family"] = t.fontFamily;
      if (t.color) result.rootStyles.color = t.color;
    }

    if (el.children) el.children.forEach((c) => processEl(c, depth + 1));
  }

  sourceElements.forEach((el) => processEl(el, 0));

  result.palette.backgrounds = [...bgSet];
  result.palette.textColors = [...textColorSet];
  result.fonts = [...fontSet];
  if (!result.dominantFont && fontSet.size > 0) result.dominantFont = [...fontSet][0];

  return result;
}

// ─── Clone ヘルパー (compose.js と同等) ───

function buildFullStyles(element) {
  const styles = [];
  const v = element.styles?.visual || {};
  const l = element.styles?.layout || {};
  const t = element.styles?.typography || {};
  if (v.backgroundColor && v.backgroundColor !== "rgba(0, 0, 0, 0)") styles.push(`background-color:${v.backgroundColor}`);
  if (v.backgroundImage && v.backgroundImage !== "none") styles.push(`background-image:${v.backgroundImage}`);
  else if (v.background && v.background !== "none" && !v.background.startsWith("rgba(0, 0, 0, 0)")) styles.push(`background:${v.background}`);
  if (v.borderRadius && v.borderRadius !== "0px") styles.push(`border-radius:${v.borderRadius}`);
  if (v.border && v.border !== "none" && v.border !== "0px none") styles.push(`border:${v.border}`);
  if (v.boxShadow && v.boxShadow !== "none") styles.push(`box-shadow:${v.boxShadow}`);
  if (v.opacity && v.opacity !== "1") styles.push(`opacity:${v.opacity}`);
  if (v.overflow && v.overflow !== "visible") styles.push(`overflow:${v.overflow}`);
  if (l.display) styles.push(`display:${l.display}`);
  if (l.position && l.position !== "static") styles.push(`position:${l.position}`);
  if (l.width && l.width !== "auto") styles.push(`width:${l.width}`);
  if (l.height && l.height !== "auto") styles.push(`height:${l.height}`);
  if (l.margin && l.margin !== "0px") styles.push(`margin:${l.margin}`);
  if (l.padding && l.padding !== "0px") styles.push(`padding:${l.padding}`);
  if (l.flexDirection && l.flexDirection !== "row") styles.push(`flex-direction:${l.flexDirection}`);
  if (l.justifyContent) styles.push(`justify-content:${l.justifyContent}`);
  if (l.alignItems) styles.push(`align-items:${l.alignItems}`);
  if (l.gap && l.gap !== "normal" && l.gap !== "0px") styles.push(`gap:${l.gap}`);
  if (t.fontFamily) styles.push(`font-family:${t.fontFamily}`);
  if (t.fontSize) styles.push(`font-size:${t.fontSize}`);
  if (t.fontWeight && t.fontWeight !== "400") styles.push(`font-weight:${t.fontWeight}`);
  if (t.lineHeight && t.lineHeight !== "normal") styles.push(`line-height:${t.lineHeight}`);
  if (t.letterSpacing && t.letterSpacing !== "normal") styles.push(`letter-spacing:${t.letterSpacing}`);
  if (t.textAlign && t.textAlign !== "start") styles.push(`text-align:${t.textAlign}`);
  if (t.color) styles.push(`color:${t.color}`);
  return styles;
}

function renderCloneElement(element, depth = 0, maxDepth = 6) {
  if (depth > maxDepth || !element) return "";
  const indent = "  ".repeat(depth);
  const styles = buildFullStyles(element);
  if (depth === 0 && element.boundingBox?.width > 0) styles.push("width:100%");
  const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
  const tagName = (element.tagName || "div").toLowerCase();
  const validTags = new Set(["p","a","span","h1","h2","h3","h4","h5","h6","ul","ol","li","img","button","nav","header","footer","section","article","main","aside","div","form","input","textarea","select","figure","figcaption","table","thead","tbody","tr","td","th","dl","dt","dd","label","strong","em","small","blockquote","code","pre","video","picture","svg"]);
  const tag = validTags.has(tagName) ? tagName : "div";
  if (tag === "img") {
    const src = element.outerHTML?.match(/src="([^"]+)"/)?.[1] || "";
    const alt = element.outerHTML?.match(/alt="([^"]+)"/)?.[1] || "";
    return `${indent}<img src="${src}" alt="${alt}"${styleAttr} />`;
  }
  if (element.children && element.children.length > 0) {
    const childrenHtml = element.children.map((c) => renderCloneElement(c, depth + 1, maxDepth)).filter(Boolean).join("\n");
    return `${indent}<${tag}${styleAttr}>\n${childrenHtml}\n${indent}</${tag}>`;
  }
  const text = (element.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `${indent}<${tag}${styleAttr}>${text}</${tag}>`;
}

function renderCloneSection(sourceElements, role) {
  const tagMap = { header: "header", footer: "footer", nav: "nav", section: "section", fv: "section", cta: "section" };
  const outerTag = tagMap[role] || "section";
  const innerParts = sourceElements.map((el) => {
    const styles = buildFullStyles(el);
    styles.push("width:100%");
    if (el.boundingBox?.height > 0) styles.push(`min-height:${el.boundingBox.height}px`);
    const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
    const tag = (el.tagName || "div").toLowerCase();
    let childrenHtml = "";
    if (el.children && el.children.length > 0) {
      childrenHtml = el.children.map((c) => renderCloneElement(c, 1, 6)).filter(Boolean).join("\n");
    } else {
      const text = (el.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      childrenHtml = text ? `  ${text}` : "";
    }
    return `<${tag}${styleAttr}>\n${childrenHtml}\n</${tag}>`;
  });
  if (sourceElements.length === 1 && ["header","footer","nav","section","article","main"].includes((sourceElements[0].tagName || "").toLowerCase())) {
    return innerParts[0];
  }
  return `<${outerTag} style="width:100%">\n${innerParts.join("\n")}\n</${outerTag}>`;
}

module.exports = router;
