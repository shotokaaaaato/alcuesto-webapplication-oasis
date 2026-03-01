const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { callAI } = require("../services/aiClientFactory");
const { getDnaById } = require("../models/dnaStore");
const { extractDnaSummary, sanitizeComponentOutput } = require("../services/aiRefactorService");
const { saveProject, getProjectById, getAllProjects, updateProject, deleteProject } = require("../models/compositionStore");

const router = express.Router();

// ─── helper: rgb/rgba → HEX 変換 ───
function rgbToHex(rgbStr) {
  if (!rgbStr || typeof rgbStr !== "string") return null;
  const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const hex = ((1 << 24) + (parseInt(m[1]) << 16) + (parseInt(m[2]) << 8) + parseInt(m[3])).toString(16).slice(1).toUpperCase();
  return `#${hex}`;
}

// ─── helper: ソース要素から支配的なスタイル情報を抽出 ───
function extractDominantStyles(sourceElements) {
  const bgColors = [];
  const textColors = [];
  const fonts = new Set();
  let dominantBg = null;
  let dominantBgArea = 0;

  for (const el of sourceElements) {
    const bg = el.styles?.visual?.backgroundColor;
    const bb = el.boundingBox;
    const area = (bb?.width || 0) * (bb?.height || 0);

    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg.startsWith("rgb")) {
      const hex = rgbToHex(bg);
      if (hex) {
        bgColors.push({ hex, area, css: bg });
        if (area > dominantBgArea) { dominantBgArea = area; dominantBg = hex; }
      }
    }

    const color = el.styles?.typography?.color;
    if (color && color.startsWith("rgb")) {
      const hex = rgbToHex(color);
      if (hex) textColors.push(hex);
    }

    const font = el.styles?.typography?.fontFamily;
    if (font) fonts.add(font);
  }

  // ユニーク化
  const uniqueBgColors = [...new Set(bgColors.map((c) => c.hex))];
  const uniqueTextColors = [...new Set(textColors)];

  return {
    dominantBg,
    bgColors: uniqueBgColors,
    textColors: uniqueTextColors,
    fonts: [...fonts],
  };
}

// ─── helper: ロック済み要素 → HTML ───
function buildElementStyles(element) {
  const styles = [];
  const v = element.styles?.visual || {};
  const l = element.styles?.layout || {};
  const t = element.styles?.typography || {};
  if (v.backgroundColor && v.backgroundColor !== "rgba(0, 0, 0, 0)") styles.push(`background-color:${v.backgroundColor}`);
  if (v.borderRadius && v.borderRadius !== "0px") styles.push(`border-radius:${v.borderRadius}`);
  if (v.border && v.border !== "none" && v.border !== "0px none") styles.push(`border:${v.border}`);
  if (v.boxShadow && v.boxShadow !== "none") styles.push(`box-shadow:${v.boxShadow}`);
  if (v.opacity && v.opacity !== "1") styles.push(`opacity:${v.opacity}`);
  if (l.padding && l.padding !== "0px") styles.push(`padding:${l.padding}`);
  if (l.display === "flex") {
    styles.push("display:flex");
    if (l.flexDirection && l.flexDirection !== "row") styles.push(`flex-direction:${l.flexDirection}`);
    if (l.justifyContent) styles.push(`justify-content:${l.justifyContent}`);
    if (l.alignItems) styles.push(`align-items:${l.alignItems}`);
    if (l.gap && l.gap !== "0px") styles.push(`gap:${l.gap}`);
  }
  if (t.fontFamily) styles.push(`font-family:${t.fontFamily}`);
  if (t.fontSize) styles.push(`font-size:${t.fontSize}`);
  if (t.fontWeight) styles.push(`font-weight:${t.fontWeight}`);
  if (t.color) styles.push(`color:${t.color}`);
  return styles;
}

function renderElementRecursive(element, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return "";
  const indent = "  ".repeat(depth + 1);
  const styles = buildElementStyles(element);
  if (element.boundingBox?.width > 0 && depth === 0) styles.push("width:100%");
  const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
  const text = (element.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tagName = (element.tagName || "div").toLowerCase();
  const tag = ["p", "a", "span", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "img", "button", "nav", "header", "footer", "section", "article", "main", "aside"].includes(tagName) ? tagName : "div";
  if (element.children && element.children.length > 0) {
    const childrenHtml = element.children.map((c) => renderElementRecursive(c, depth + 1, maxDepth)).filter(Boolean).join("\n");
    return `${indent}<${tag}${styleAttr}>\n${childrenHtml}\n${indent}</${tag}>`;
  }
  return `${indent}<${tag}${styleAttr}>${text}</${tag}>`;
}

function renderLockedPartHtml(element, role) {
  const tagMap = { header: "header", footer: "footer", nav: "nav", section: "section", fv: "section", cta: "section" };
  const tag = tagMap[role] || "div";
  const styles = buildElementStyles(element);
  if (element.boundingBox?.width > 0) {
    styles.push("width:100%");
    if (element.boundingBox.height > 0) styles.push(`min-height:${element.boundingBox.height}px`);
  }
  const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
  const name = element.figmaNodeName || element.selector || "";
  let childrenHtml = "";
  if (element.children && element.children.length > 0) {
    childrenHtml = element.children.map((c) => renderElementRecursive(c, 0, 3)).filter(Boolean).join("\n");
  }
  const text = (element.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<${tag}${styleAttr}>\n  <!-- ${name} -->\n${childrenHtml || `  ${text}`}\n</${tag}>`;
}

// ────────────────────────────────────────────
// POST /api/compose/suggest-structure
// AI にページ名から最適セクション構成を提案させる
// ────────────────────────────────────────────
router.post("/suggest-structure", verifyToken, async (req, res) => {
  const { pageName, model, apiKey } = req.body;
  if (!pageName) return res.status(400).json({ error: "pageName は必須です" });

  const provider = model || "deepseek";
  const key = apiKey || process.env.deepseek_API_KEY;
  if (!key) return res.status(500).json({ error: "API キーが設定されていません" });

  const systemPrompt = `あなたは日本のウェブデザインに精通したシニアデザイナーです。
与えられたページ名から、日本の企業・サービスサイトに最適なセクション構成を提案してください。

## ルール
- ヘッダーとフッターは自動付与されるため提案に含めないでください
- メイン・コンテンツセクションのみを 3〜7 個提案してください
- 各セクションに明確な日本語ラベルと役割(role)を付けてください
- role は次から選択: "fv"（ファーストビュー）, "section"（一般セクション）, "cta"（アクション誘導）, "card"（カード型一覧）, "nav"（ナビゲーション）
- ファーストビューは必ず先頭にしてください
- suggestedContent にそのセクションで表現すべき内容を 1 文で記載してください

## 出力形式
以下の JSON のみ出力（説明不要）:
{ "sections": [{ "label": "string", "role": "string", "suggestedContent": "string" }] }`;

  const userMessage = `ページ名: 「${pageName}」`;

  try {
    const aiResult = await callAI(systemPrompt, userMessage, { provider, apiKey: key, maxTokens: 1500 });
    let cleaned = aiResult.replace(/```(?:json)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({ success: true, sections: parsed.sections || [] });
  } catch (err) {
    res.status(500).json({ error: `構成提案に失敗しました: ${err.message}` });
  }
});

// ────────────────────────────────────────────
// POST /api/compose/generate-section-composed
// ソースデザインを「参照」として AI が新セクションを生成
// ────────────────────────────────────────────
router.post("/generate-section-composed", verifyToken, async (req, res) => {
  const {
    sourceElements,
    referenceConfig,
    sectionLabel,
    sectionIndex,
    totalSections,
    previousSectionsHtml,
    pageName,
    imageMode,
    model,
    apiKey,
  } = req.body;

  if (!sectionLabel) return res.status(400).json({ error: "sectionLabel は必須です" });
  if (!sourceElements || !Array.isArray(sourceElements)) {
    return res.status(400).json({ error: "sourceElements 配列は必須です" });
  }

  const config = referenceConfig || {};
  const provider = model || "deepseek";
  const key = apiKey || process.env.deepseek_API_KEY;
  if (!key) return res.status(500).json({ error: "API キーが設定されていません" });

  try {
    const summary = extractDnaSummary(sourceElements);
    const dominantStyles = extractDominantStyles(sourceElements);

    // ソース HTML を生成（実際のデザイン構造を AI に渡す）
    const sourceHtmlParts = sourceElements.slice(0, 5).map((el) => renderElementRecursive(el, 0, 3)).filter(Boolean);
    const sourceHtmlPreview = sourceHtmlParts.join("\n").slice(0, 3000);

    // 色の具体値を HEX で抽出
    const colorPaletteHex = [];
    if (dominantStyles.bgColors.length > 0) {
      dominantStyles.bgColors.forEach((hex) => colorPaletteHex.push(`  - 背景色: ${hex} → bg-[${hex}]`));
    }
    if (dominantStyles.textColors.length > 0) {
      dominantStyles.textColors.forEach((hex) => colorPaletteHex.push(`  - 文字色: ${hex} → text-[${hex}]`));
    }
    // RGB 形式のフォールバック
    if (colorPaletteHex.length === 0 && summary.colors.length > 0) {
      summary.colors.forEach((c) => {
        const hex = rgbToHex(c.css);
        if (hex) colorPaletteHex.push(`  - ${c.name}: ${hex} → bg-[${hex}] / text-[${hex}]`);
      });
    }
    const colorPalette = colorPaletteHex.length > 0
      ? colorPaletteHex.join("\n")
      : "  （色情報なし — 参照デザインのスタイルから推測してください）";

    // タイポグラフィの具体値
    const typographyInfo = summary.typography.length > 0
      ? summary.typography.map((t) =>
          `  - ${t.name}: font-family: ${t.fontFamily || "sans-serif"}; font-size: ${t.fontSize || "16px"}; font-weight: ${t.fontWeight || "400"};`
        ).join("\n")
      : "  （タイポグラフィ情報なし）";

    // 支配的背景色の強制ルール
    const dominantBgRule = dominantStyles.dominantBg
      ? `\n\n## 最優先: セクション背景色の強制適用
**<section> タグに必ず \`class="... bg-[${dominantStyles.dominantBg}]"\` を設定してください。**
白背景（bg-white, bg-gray-50 等）は禁止です。参照デザインの支配的背景色 ${dominantStyles.dominantBg} をセクション全体に適用してください。`
      : "";

    // 継承ルールの構築
    let inheritanceRules = "";
    if (config.inheritColors) {
      inheritanceRules += `\n- **配色（必須継承 — 違反禁止）**: 以下の HEX カラーをそのまま使用。Tailwind の bg-[#HEX] / text-[#HEX] 形式で指定。白や灰色への置換は禁止:\n${colorPalette}`;
    } else {
      inheritanceRules += "\n- 配色: 独自の配色を使用（参照デザインの色に縛られない）";
    }
    if (config.inheritFonts) {
      inheritanceRules += `\n- **フォント（必須継承）**: 以下の CSS font 宣言をそのまま使用:\n${typographyInfo}`;
    } else {
      inheritanceRules += "\n- フォント: Google Fonts (Noto Sans JP, Inter 等) から自由に選択";
    }
    if (config.inheritLayout) {
      inheritanceRules += "\n- **レイアウト（必須継承）**: 参照デザインの配置構造 (flex/grid, 間隔比率, カラム数) をそのまま踏襲";
    } else {
      inheritanceRules += "\n- レイアウト: このセクションの役割に最適なレイアウトを独自に設計";
    }

    // ビジュアル装飾情報
    let visualRules = "";
    if (summary.visual.length > 0) {
      const decorations = summary.visual.slice(0, 5).map((v) => {
        const parts = [];
        if (v.borderRadius && v.borderRadius !== "0px") parts.push(`rounded-[${v.borderRadius}]`);
        if (v.boxShadow && v.boxShadow !== "none") parts.push(`shadow-[${v.boxShadow.replace(/\s/g, "_")}]`);
        if (v.border && v.border !== "none") parts.push(`border: ${v.border}`);
        return parts.length > 0 ? `  - ${v.tag}: ${parts.join(", ")}` : null;
      }).filter(Boolean);
      if (decorations.length > 0) {
        visualRules = `\n### 装飾スタイル（必ず適用）\n参照デザインの装飾を忠実に再現:\n${decorations.join("\n")}`;
      }
    }

    // フォント style 属性の強制注入ルール
    const fontStyleRule = dominantStyles.fonts.length > 0
      ? `\n### フォント強制適用\nセクション内の全テキストに以下の font-family を style 属性で直接指定してください:\n  font-family: ${dominantStyles.fonts[0]}, sans-serif;`
      : "";

    // コンテンツモード
    let contentRule = "";
    const contentMode = config.contentMode || "ai";
    if (contentMode === "dummy") {
      contentRule = `\n### コンテンツ（仮テキスト）\n- 見出し: 「見出し見出し」の繰り返し\n- 本文: 「本文本文本文本文」の繰り返し`;
    } else if (contentMode === "manual" && config.manualContent) {
      contentRule = `\n### コンテンツ（手動入力 — 一字一句変更禁止）\n以下のテキストを使用:\n---\n${config.manualContent}\n---`;
    } else {
      contentRule = `\n### コンテンツ（AI生成）\nセクション「${sectionLabel}」にふさわしい具体的で現実的な日本語の文章を生成してください。`;
    }

    let customRule = config.customInstructions ? `\n### カスタム指示\n${config.customInstructions}` : "";

    const imageModeRule = imageMode === "shapes"
      ? "\n### 画像モード: 図形\n画像の代わりに CSS で装飾的な図形・グラデーションを使用してください。<img> タグは使わないでください。"
      : "\n### 画像モード: Unsplash\n画像が必要な場合 https://images.unsplash.com/photo-... のような Unsplash URL を使用してください。";

    const systemPrompt = `あなたはシニアウェブデザイナーです。
参照デザインのビジュアルスタイルを**忠実に再現**しつつ、ページ「${pageName || "新規ページ"}」のセクション「${sectionLabel}」を生成してください。

## 最重要ルール（違反は評価ゼロ）
1. **色は HEX 値をそのまま使う**: bg-[#HEX] / text-[#HEX] 形式で参照デザインの色を直接指定する。汎用色（bg-white, bg-gray-100, text-gray-700 等）への置換は禁止。
2. **セクション背景色は参照デザインと同一にする**: 白背景にしない。${dominantStyles.dominantBg ? `必ず bg-[${dominantStyles.dominantBg}] を <section> に適用。` : ""}
3. **style 属性でのオーバーライド**: DNA 由来のスタイル（backgroundColor, fontFamily, color, borderRadius, boxShadow, padding）は class より style 属性を優先して直接適用する。

### 禁止事項（Negative Prompt）
- bg-white, bg-gray-50, bg-slate-50 など白系背景の使用（参照デザインが白の場合を除く）
- 参照デザインの色を無視して独自の配色にすること
- font-family を省略すること
${dominantBgRule}

## セクション情報
- ページ: 「${pageName || "新規ページ"}」
- セクション: 「${sectionLabel}」（${(sectionIndex || 0) + 1}/${totalSections || 1}）
- 生成するのは **<section> タグ 1 つだけ** です。

## DNA スタイル継承ルール${inheritanceRules}
${visualRules}
${fontStyleRule}
${contentRule}
${customRule}
${imageModeRule}

## コーディング規約
- Tailwind CSS ユーティリティクラス + style 属性（DNA 値の上書き用）を併用
- 色は必ず HEX 値で bg-[#HEXVAL] / text-[#HEXVAL] 形式（rgb() は使わない）
- 16px = 1rem、本文 font-size 最小 15px
- カスタムクラス名は snake_case
- position: absolute は装飾シェイプ（decorative_）のみ
- モバイルファースト: ベースにモバイル、md:/lg: で拡張
- セマンティック HTML (<section>, <h2>, <p>, <ul> 等)
- 適切な padding (py-16 md:py-24 以上), 装飾的なグラデーション・シャドウを積極的に使用

## 出力形式
以下の JSON のみ出力（説明不要）:
{
  "sectionHtml": "<section style='background-color:${dominantStyles.dominantBg || "#fff"};' class='...'>...</section>",
  "sectionCode": "/* React JSX for this section */"
}

**sectionHtml は純粋な HTML（class 属性、React構文なし）で出力。**
**<section> の style 属性に background-color を必ず含めること。**`;

    let prevContext = "";
    if (previousSectionsHtml && previousSectionsHtml.length > 0) {
      prevContext = `\n\n## 前セクション（参考 — スタイル統一用）\n以下は既に承認済みのセクションです。配色・余白・フォントサイズを統一してください:\n\`\`\`html\n${previousSectionsHtml.slice(-2000)}\n\`\`\``;
    }

    const userMessage = `## 参照デザインの具体的な DNA スタイル情報（これらの値をそのまま適用すること）

### カラーパレット（HEX — そのまま bg-[#HEX] / text-[#HEX] で使用）
${colorPalette}

### タイポグラフィ（CSS font 宣言 — style 属性で適用）
${typographyInfo}

### 参照デザインの HTML 構造（構造とスタイルの参考）
\`\`\`html
${sourceHtmlPreview}
\`\`\`

### レイアウト情報
${JSON.stringify(summary.layout.slice(0, 10), null, 2)}
${prevContext}`;

    const aiResult = await callAI(systemPrompt, userMessage, { provider, apiKey: key, maxTokens: 4000 });

    let sectionHtml = "";
    let sectionCode = "";
    try {
      let cleaned = aiResult.replace(/```(?:json|html|jsx)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();
      const parsed = JSON.parse(cleaned);
      sectionHtml = parsed.sectionHtml || "";
      sectionCode = parsed.sectionCode || "";
    } catch {
      const htmlMatch = aiResult.match(/<section[\s\S]*?<\/section>/i);
      if (htmlMatch) {
        sectionHtml = htmlMatch[0];
        sectionCode = sectionHtml;
      } else {
        sectionHtml = aiResult;
        sectionCode = aiResult;
      }
    }

    res.json({ success: true, sectionHtml, sectionCode });
  } catch (err) {
    res.status(500).json({ error: `セクション生成に失敗しました: ${err.message}` });
  }
});

// ────────────────────────────────────────────
// POST /api/compose/optimize-page
// 全セクション結合後の余白・境界を微調整
// ────────────────────────────────────────────
router.post("/optimize-page", verifyToken, async (req, res) => {
  const { assembledHtml, pageName, model, apiKey } = req.body;

  if (!assembledHtml) return res.status(400).json({ error: "assembledHtml は必須です" });

  const provider = model || "deepseek";
  const key = apiKey || process.env.deepseek_API_KEY;
  if (!key) return res.status(500).json({ error: "API キーが設定されていません" });

  const systemPrompt = `あなたは CSS 最適化のスペシャリストです。
以下の HTML ページは複数のセクションを独立生成して結合したものです。
あなたの仕事は:
1. セクション間の padding/margin を統一し、視覚的な一貫性を確保する
2. セクション境界のスムーズな視覚的遷移を実現する
3. 隣接セクション間の背景色の不整合がある場合、グラデーション遷移を追加する
4. 見出し階層 (h1 → h2 → h3) の整合性を確保する

**重要**:
- セクションのコンテンツや構造は一切変更しないでください
- CSS プロパティ (padding, margin, border, background) のみ修正してください
- 修正後の HTML 全体を返してください

## 出力形式
以下の JSON のみ出力:
{
  "optimizedHtml": "修正後の完全な HTML",
  "changes": ["変更点1", "変更点2", ...]
}`;

  const userMessage = `## ページ: 「${pageName || "新規ページ"}」\n\n\`\`\`html\n${assembledHtml.slice(0, 12000)}\n\`\`\``;

  try {
    const aiResult = await callAI(systemPrompt, userMessage, { provider, apiKey: key, maxTokens: 8000 });
    let cleaned = aiResult.replace(/```(?:json|html)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      res.json({ success: true, optimizedHtml: parsed.optimizedHtml || assembledHtml, changes: parsed.changes || [] });
    } catch {
      res.json({ success: true, optimizedHtml: assembledHtml, changes: ["JSON パースに失敗したため、元の HTML を返却"] });
    }
  } catch (err) {
    res.status(500).json({ error: `最適化に失敗しました: ${err.message}` });
  }
});

// ────────────────────────────────────────────
// POST /api/compose/save-project
// プロジェクトを永続化
// ────────────────────────────────────────────
router.post("/save-project", verifyToken, async (req, res) => {
  const { pageName, aiModel, imageMode, sections, finalHtml, finalCode, optimizedHtml } = req.body;
  if (!pageName) return res.status(400).json({ error: "pageName は必須です" });

  try {
    const project = saveProject({
      pageName,
      aiModel,
      imageMode,
      sections,
      finalHtml: finalHtml || "",
      finalCode: finalCode || "",
      optimizedHtml: optimizedHtml || null,
      userId: req.user.id,
    });
    res.json({ success: true, projectId: project.id });
  } catch (err) {
    res.status(500).json({ error: `保存に失敗しました: ${err.message}` });
  }
});

// ────────────────────────────────────────────
// GET /api/compose/projects
// プロジェクト一覧
// ────────────────────────────────────────────
router.get("/projects", verifyToken, (req, res) => {
  const projects = getAllProjects();
  res.json({ success: true, data: projects });
});

// ────────────────────────────────────────────
// GET /api/compose/projects/:id
// プロジェクト詳細
// ────────────────────────────────────────────
router.get("/projects/:id", verifyToken, (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: "プロジェクトが見つかりません" });
  res.json({ success: true, data: project });
});

module.exports = router;
