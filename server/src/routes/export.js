const express = require("express");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { getDnaById, getLatestDna } = require("../models/dnaStore");
const { refactorDnaToComponent, extractDnaSummary, sanitizeComponentOutput } = require("../services/aiRefactorService");
const { generateTailwindConfig } = require("../services/tailwindConfigGenerator");
const { generateDnaHash, extractColorMap, applyColorMap, extractPrimaryAccentColor } = require("../services/templateHasher");
const { callAI } = require("../services/aiClientFactory");
const {
  findByHash,
  saveGeneratedCode,
  registerAsTemplate,
  unregisterTemplate,
  getAllTemplates,
  getTemplateById,
  updateTemplateName,
} = require("../models/templateStore");

const router = express.Router();

/**
 * POST /api/export/refactor
 * デザイン → AI → React + Tailwind コンポーネントに変換
 * ハッシュキャッシュ: 同一デザイン構成ならAIスキップ
 * Body: { dnaId?: string, model?: string, apiKey?: string }
 */
router.post("/refactor", verifyToken, async (req, res) => {
  const { dnaId, model, apiKey } = req.body;

  const dna = dnaId ? getDnaById(dnaId) : getLatestDna();
  if (!dna) {
    return res.status(404).json({ error: "デザインデータが見つかりません" });
  }

  try {
    // ハッシュ生成 → キャッシュ検索
    const dnaHash = generateDnaHash(dna.elements);
    const cached = findByHash(dnaHash);

    if (cached) {
      return res.json({
        success: true,
        componentCode: cached.componentCode,
        previewHtml: cached.previewHtml,
        dnaSource: { id: dna.id, url: dna.url },
        cached: true,
        cacheId: cached.id,
      });
    }

    // キャッシュミス → AI 呼び出し
    if (!model && !apiKey && !process.env.deepseek_API_KEY) {
      return res.status(500).json({
        error: "API キーが設定されていません。設定ページで登録するか、サーバー環境変数を設定してください。",
      });
    }

    const rawResult = await refactorDnaToComponent(dna.elements, { model, apiKey });
    const result = sanitizeComponentOutput(rawResult.componentCode, rawResult.previewHtml);
    const colorMap = extractColorMap(dna.elements);

    // 結果をキャッシュ保存（サニタイズ済み）
    const saved = saveGeneratedCode({
      dnaHash,
      dnaId: dna.id,
      componentCode: result.componentCode,
      previewHtml: result.previewHtml,
      colorMap,
      createdBy: req.user.id,
    });

    res.json({
      success: true,
      componentCode: result.componentCode,
      previewHtml: result.previewHtml,
      dnaSource: { id: dna.id, url: dna.url },
      cached: false,
      cacheId: saved.id,
    });
  } catch (err) {
    res.status(500).json({ error: `AI変換に失敗しました: ${err.message}` });
  }
});

/**
 * POST /api/export/refactor-elements
 * 生のデザイン要素配列を直接受け取り AI 変換（パーツ別プレビュー用）
 * Body: { elements: object[], dnaId?: string, model?: string, apiKey?: string }
 */
router.post("/refactor-elements", verifyToken, async (req, res) => {
  const { elements, dnaId, model, apiKey } = req.body;

  if (!Array.isArray(elements) || elements.length === 0) {
    return res.status(400).json({ error: "elements 配列は必須です" });
  }

  try {
    const dnaHash = generateDnaHash(elements);
    const cached = findByHash(dnaHash);

    if (cached) {
      return res.json({
        success: true,
        componentCode: cached.componentCode,
        previewHtml: cached.previewHtml,
        cached: true,
        cacheId: cached.id,
      });
    }

    if (!model && !apiKey && !process.env.deepseek_API_KEY) {
      return res.status(500).json({
        error: "API キーが設定されていません。設定ページで登録するか、サーバー環境変数を設定してください。",
      });
    }

    const rawResult = await refactorDnaToComponent(elements, { model, apiKey });
    const result = sanitizeComponentOutput(rawResult.componentCode, rawResult.previewHtml);
    const colorMap = extractColorMap(elements);

    const saved = saveGeneratedCode({
      dnaHash,
      dnaId: dnaId || null,
      componentCode: result.componentCode,
      previewHtml: result.previewHtml,
      colorMap,
      createdBy: req.user.id,
    });

    res.json({
      success: true,
      componentCode: result.componentCode,
      previewHtml: result.previewHtml,
      cached: false,
      cacheId: saved.id,
    });
  } catch (err) {
    res.status(500).json({ error: `AI変換に失敗しました: ${err.message}` });
  }
});

/**
 * POST /api/export/tailwind-config
 * デザイン → tailwind.config.js 形式で出力
 * Body: { dnaId?: string }
 */
router.post("/tailwind-config", verifyToken, (req, res) => {
  const { dnaId } = req.body;

  const dna = dnaId ? getDnaById(dnaId) : getLatestDna();
  if (!dna) {
    return res.status(404).json({ error: "デザインデータが見つかりません" });
  }

  try {
    const config = generateTailwindConfig(dna.elements);
    res.json({
      success: true,
      config,
      dnaSource: { id: dna.id, url: dna.url },
    });
  } catch (err) {
    res.status(500).json({ error: `Config生成に失敗しました: ${err.message}` });
  }
});

/**
 * POST /api/export/register-template
 * AI 生成結果をマスターテンプレートとして登録 (admin のみ)
 * Body: { cacheId: string, name: string, description?: string, category?: string }
 */
router.post("/register-template", verifyToken, requireAdmin, (req, res) => {
  const { cacheId, name, description, category } = req.body;

  if (!cacheId || !name) {
    return res.status(400).json({ error: "cacheId と name は必須です" });
  }

  const existing = getTemplateById(cacheId);
  if (!existing) {
    return res.status(404).json({ error: "キャッシュデータが見つかりません" });
  }

  const result = registerAsTemplate(cacheId, {
    name,
    description: description || "",
    category: category || "other",
    registeredBy: req.user.id,
  });

  res.json({ success: true, template: result });
});

/**
 * DELETE /api/export/templates/:id
 * テンプレート登録を解除 (admin のみ)
 */
router.delete("/templates/:id", verifyToken, requireAdmin, (req, res) => {
  const result = unregisterTemplate(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "テンプレートが見つかりません" });
  }
  res.json({ success: true });
});

/**
 * PATCH /api/export/templates/:id/name
 * テンプレートの名前を更新（要認証）
 * Body: { name: string }
 */
router.patch("/templates/:id/name", verifyToken, (req, res) => {
  const { name } = req.body;
  if (typeof name !== "string") {
    return res.status(400).json({ error: "name は文字列で指定してください" });
  }
  const updated = updateTemplateName(req.params.id, name);
  if (!updated) {
    return res.status(404).json({ error: "テンプレートが見つかりません" });
  }
  res.json({ success: true, data: updated });
});

/**
 * GET /api/export/templates
 * 登録済みマスターテンプレート一覧 (全ユーザー)
 * Query: ?full=true でコード本体も含める
 */
router.get("/templates", verifyToken, (req, res) => {
  if (req.query.full === "true") {
    const { getAllTemplatesFull } = require("../models/templateStore");
    const templates = getAllTemplatesFull();
    return res.json({ success: true, data: templates });
  }
  const templates = getAllTemplates();
  res.json({ success: true, data: templates });
});

/**
 * POST /api/export/apply-template
 * テンプレートを指定デザインに適用（カラー置換）
 * Body: { templateId: string, dnaId?: string }
 */
router.post("/apply-template", verifyToken, (req, res) => {
  const { templateId, dnaId } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: "templateId は必須です" });
  }

  const template = getTemplateById(templateId);
  if (!template) {
    return res.status(404).json({ error: "テンプレートが見つかりません" });
  }

  const dna = dnaId ? getDnaById(dnaId) : getLatestDna();
  if (!dna) {
    return res.status(404).json({ error: "デザインデータが見つかりません" });
  }

  try {
    const targetColorMap = extractColorMap(dna.elements);
    const rawComponentCode = applyColorMap(
      template.componentCode,
      template.colorMap || {},
      targetColorMap
    );
    const rawPreviewHtml = applyColorMap(
      template.previewHtml,
      template.colorMap || {},
      targetColorMap
    );

    // テンプレート適用後もサニタイズを実行
    const sanitized = sanitizeComponentOutput(rawComponentCode, rawPreviewHtml);

    res.json({
      success: true,
      componentCode: sanitized.componentCode,
      previewHtml: sanitized.previewHtml,
      templateSource: {
        id: template.id,
        name: template.templateMeta?.name || "Unnamed",
      },
      dnaSource: { id: dna.id, url: dna.url },
    });
  } catch (err) {
    res.status(500).json({ error: `テンプレート適用に失敗しました: ${err.message}` });
  }
});

/**
 * POST /api/export/preview-with-dna
 * テンプレートを現在のデザインカラーで動的プレビュー
 * Body: { templateId: string, dnaId?: string }
 */
router.post("/preview-with-dna", verifyToken, (req, res) => {
  const { templateId, dnaId } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: "templateId は必須です" });
  }

  const template = getTemplateById(templateId);
  if (!template) {
    return res.status(404).json({ error: "テンプレートが見つかりません" });
  }

  const dna = dnaId ? getDnaById(dnaId) : getLatestDna();
  if (!dna) {
    // デザインデータがなければテンプレートのまま返す
    return res.json({
      success: true,
      previewHtml: template.previewHtml,
      componentCode: template.componentCode,
      applied: false,
    });
  }

  try {
    const targetColorMap = extractColorMap(dna.elements);
    const newPreviewHtml = applyColorMap(
      template.previewHtml,
      template.colorMap || {},
      targetColorMap
    );

    res.json({
      success: true,
      previewHtml: newPreviewHtml,
      componentCode: template.componentCode,
      applied: true,
      dnaSource: { id: dna.id, url: dna.url },
    });
  } catch (err) {
    res.status(500).json({ error: `プレビュー生成に失敗しました: ${err.message}` });
  }
});

/**
 * POST /api/export/generate-subpage
 * 選択デザインを元に、AI で下層ページ構造を生成
 * Body: {
 *   dnaElements: object[],
 *   frameName?: string,
 *   pageTitle?: string,
 *   contentMode?: "manual" | "dummy" | "ai",
 *   manualContent?: string,
 *   customInstructions?: string,
 *   model?: string,
 *   apiKey?: string
 * }
 */
/**
 * previewHtml に混入しがちな JSX 構文を純 HTML に変換するヘルパー
 * - className → class
 * - htmlFor → for
 * - {/* ... * /} JSX コメント削除
 * - リテラル \n の正規化
 * - JSX 式 {expression} の除去（テキスト表示用）
 */
function jsxToHtml(html) {
  if (!html || typeof html !== "string") return html || "";

  let out = html;

  // リテラル文字列 "\n" を実際の改行に変換（AI が \\n を返すケース）
  out = out.replace(/\\n/g, "\n");
  // リテラル文字列 "\\t" をタブに
  out = out.replace(/\\t/g, "\t");
  // エスケープされた引用符
  out = out.replace(/\\"/g, '"');
  out = out.replace(/\\\\/g, "\\");

  // JSX コメント {/* ... */} を除去
  out = out.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // className → class
  out = out.replace(/\bclassName=/g, "class=");

  // htmlFor → for
  out = out.replace(/\bhtmlFor=/g, "for=");

  // onChange, onClick 等の JSX イベントハンドラを除去
  out = out.replace(/\s(?:onChange|onClick|onSubmit|onFocus|onBlur|onKeyDown|onKeyUp|onMouseEnter|onMouseLeave)=\{[^}]*\}/g, "");

  // JSX 式 {...} をテキストとしては空文字に（ただし style={{...}} は残す）
  // style={{...}} 以外の単独 {variable} を除去
  out = out.replace(/\{(?!\{)(?!\/\*)([^}]*)\}/g, (match, inner) => {
    // style= の直後の場合は残す
    if (inner.trim().startsWith("{") || inner.trim().startsWith("'") || inner.trim().startsWith('"')) return match;
    // テンプレートリテラルや変数参照は除去
    if (inner.includes("`") || /^[a-zA-Z_$]/.test(inner.trim())) return "";
    return match;
  });

  // import 文の除去（AI が componentCode をそのまま previewHtml に入れるケース）
  out = out.replace(/^import\s+.*?;\s*\n?/gm, "");
  // export default function ... { return ( の除去
  out = out.replace(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?return\s*\(\s*/m, "");
  // 末尾の ); } の除去
  out = out.replace(/\s*\);\s*\}\s*$/, "");

  return out.trim();
}

/**
 * 優先度ベースで要素を選択し、2 階層の子要素付きで構造化する
 * header/footer/nav を最優先、hero/section/h1-h2 を次優先
 */
function buildStructuredContext(dnaElements) {
  const HEADER_SIGNALS = ["header", "nav", "navbar", "gnav", "site-header", "page-header"];
  const FOOTER_SIGNALS = ["footer", "site-footer", "page-footer"];
  const HERO_SIGNALS = ["hero", "kv", "mv", "mainvisual", "jumbotron", "fv"];

  function scoreElement(el) {
    const tag = (el.tagName || "").toLowerCase();
    const sel = (el.selector || "").toLowerCase();
    if (HEADER_SIGNALS.some((s) => tag === s || sel.includes(s))) return 100;
    if (FOOTER_SIGNALS.some((s) => tag === s || sel.includes(s))) return 90;
    if (HERO_SIGNALS.some((s) => sel.includes(s))) return 80;
    if (tag === "section" || tag === "main" || tag === "article") return 50;
    if (tag === "h1" || tag === "h2") return 40;
    if (tag === "svg" || sel.includes("icon") || sel.includes("decoration")) return 70;
    return 10;
  }

  const scored = dnaElements.map((el) => ({ el, score: scoreElement(el) }));
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, 20).map(({ el }) => el);

  return selected.map((el) => ({
    tag: el.tagName,
    selector: el.selector,
    text: el.textContent?.slice(0, 100),
    boundingBox: el.boundingBox,
    styles: el.styles,
    children: (el.children || []).slice(0, 8).map((c) => ({
      tag: c.tagName,
      selector: c.selector,
      text: c.textContent?.slice(0, 60),
      styles: c.styles,
      children: (c.children || []).slice(0, 5).map((gc) => ({
        tag: gc.tagName,
        text: gc.textContent?.slice(0, 40),
        styles: gc.styles,
      })),
    })),
  }));
}

function buildSubpageSystemPrompt({ pageTitle, contentMode, manualContent, customInstructions, fontMode, accentColor, lockedHeaderHtml, lockedFooterHtml }) {
  const title = pageTitle || "下層ページ";

  // === コンテンツモード別のシステムロール ===
  let systemRole;
  if (contentMode === "ai") {
    systemRole = `あなたはシニアデザイナー兼コピーライターです。
元デザインのブランド世界観（配色・装飾・余白・トーン）を完全に継承しながら、
「${title}」にふさわしい説得力あるコピーと、ブランドらしいビジュアル表現を生み出してください。
コーディングの制約より、ブランドの一貫性と文章の訴求力を優先してください。`;
  } else if (contentMode === "manual") {
    systemRole = `あなたは UI コーダーです。
ユーザーが提供したテキストを一字一句変更せず、元デザインのタイポグラフィルール・余白・装飾パターンに従って配置してください。
文章を要約・言い換え・省略することは絶対に禁止です。テキスト内容への干渉は一切行わないでください。`;
  } else {
    // dummy
    systemRole = `あなたは UI コーダーです。
テキスト内容には一切干渉せず、仮テキスト（見出し見出し、本文本文...）を元デザインのタイポグラフィルールと余白に完璧に適合させることだけに集中してください。
レイアウト構造の再現精度が唯一の評価基準です。`;
  }

  // === コンテンツ生成ルール ===
  let contentRule = "";
  if (contentMode === "dummy") {
    contentRule = `
### コンテンツ生成ルール（仮テキストモード）
- 見出しテキストは「見出し見出し」の繰り返しで出力
- 本文テキストは「本文本文本文本文本文本文本文本文」の繰り返しで出力
- リスト項目は「項目テキスト項目テキスト」の繰り返しで出力
- 画像プレースホルダーには「Image Placeholder」と表示
- 構造やレイアウトの確認が目的のため、意味のある文章は不要`;
  } else if (contentMode === "manual") {
    contentRule = `
### コンテンツ生成ルール（手動入力テキスト — 絶対遵守）
以下のテキストを**一字一句変更せず**にページ内に配置してください:
---
${manualContent || ""}
---
- テキストをセクションごとに適切に分割し、見出し・本文・リストなどに振り分ける
- 文章の改変・要約・省略は禁止。必ず全文をそのまま使用すること
- 足りない場合でもダミーテキストを追加しない`;
  } else {
    contentRule = `
### コンテンツ生成ルール（AI 生成モード）
ページタイトル「${title}」に沿った具体的で現実的な文章を生成してください。
- 見出しはページの目的に合った簡潔なタイトル
- 本文は 3〜5 文程度の自然な説明文
- CTA ボタンのテキストも目的に合ったもの
- リスト項目がある場合は具体的な内容
- 元デザインの語調・トーン（フォーマル/カジュアル）を踏襲すること`;
  }

  let customRule = "";
  if (customInstructions) {
    customRule = `
### カスタム指示（ユーザーからの追加要望）
${customInstructions}`;
  }

  return `${systemRole}

## 最重要指示: グローバル・ビジュアル・シェル（Shell）の保護

ユーザーメッセージ内の「構造ヒエラルキー」と「ビジュアルキー」に含まれる **Shell 要素**（shell: true のフラグが付いた要素）は、
ブランドの魂であり、**1px も変更・削除してはなりません**。

### クローン（完全複製）すべき Shell 要素:
- **ヘッダー**: 背景色、高さ、ロゴ位置、ナビゲーション項目の並び方、フォント、パディングをそのまま複製
- **フッター**: 背景色、リンク構造、コピーライト形式、パディングをそのまま複製
- **グローバルナビゲーション**: 項目名・順序・ホバースタイルをそのまま複製
- **装飾シェイプ**: 有機的な border-radius を持つ背景ブロック、浮遊アイコン、SVG 風装飾をそのまま複製
  - 装飾シェイプのクラス名は必ず \`decorative_\` プレフィックスを付ける（例: \`decorative_blob_top\`, \`decorative_circle_bg\`）
  - 装飾シェイプにのみ \`absolute\` + 座標指定を使用可能
  - 親要素は \`relative overflow-hidden\` を設定すること

### 新規生成すべき要素（main セクション内のみ）:
- ページタイトルセクション（パンくずリスト + ページ固有 h1）
- メインコンテンツエリア（ページタイトル「${title}」に合わせた構造）
- ページ固有 CTA

### Shell 保護 — 禁止事項（Negative Prompt）:
❌ ヘッダー・フッターの背景色を変更する
❌ ナビゲーション項目を並べ替え・追加・削除する
❌ ヘッダー・フッター内のフォントを変更する
❌ 装飾シェイプの形状・色・位置を変更する
❌ Shell 要素を省略する

---

## ビジュアル DNA 継承指示（Design Token による数値強制）

ユーザーメッセージの「ビジュアルキー」内の \`designTokens\` は、プログラムが抽出した**正確な数値**です。
AI の推測ではなく、これらの値をそのまま Tailwind クラスとして適用してください。

### 形状 Design Token の適用:
- **dominantBorderRadius**: 最頻出の border-radius 値を、ボタン・カード・バッジ・入力欄など全 UI 要素に適用
  - 提供された \`tailwindClass\` をそのまま使用すること（例: \`rounded-[20px]\`, \`rounded-full\`）
- **topShadows**: 最頻出シャドウをカード・パネル要素に \`shadow-[値]\` 形式で適用
- **decorativeShapes**: 装飾ブロックの \`borderRadius\`, \`backgroundColor\`, \`width\`, \`height\` を正確に再現

### タイポグラフィ Design Token の適用:
- **typographyQuirks**: 抽出された特殊表現を必ず継承
  - \`extreme-letter-spacing\` → 対応する見出しに \`tracking-[値]\` を適用
  - \`vertical-writing\` → \`writing-mode: vertical-rl\` を CSS で適用（横書きに戻すことは禁止）
- **mixedFonts**: 複数フォントが使われている場合、統一してはならない。各要素のフォント指定を維持

### タイポグラフィ — 禁止事項（Negative Prompt）:
❌ 縦書き（writing-mode: vertical-rl）を横書きに変更する
❌ 複数フォントファミリーを 1 つに統一する
❌ 極端なレタースペーシングを標準値に戻す
❌ フォントのジャンプ率（見出し/本文のサイズ比）を元デザインから大幅に変更する

---

## ページ構成

ページタイトル「${title}」に合わせた適切なセクション構成を設計してください。
基本構成:
1. ヘッダー（Shell から完全複製）
2. ページタイトルセクション（パンくずリスト + ページタイトル）
3. メインコンテンツセクション（ページ種類に応じた構造）
4. 関連リンク or CTA セクション
5. フッター（Shell から完全複製）

### 画像・メディアの配置
- 元デザインに画像がある場合は同様の位置に画像プレースホルダーを配置
- プレースホルダー: https://placehold.co を使用（例: https://placehold.co/600x400/e2e8f0/64748b?text=Image）
- 元デザインの画像サイズ比率（横長・縦長・正方形）を踏襲
- 画像の alt 属性にはページ内容に沿った説明テキストを設定
${contentRule}
${customRule}
${accentColor ? `
## アクセントカラー強制適用ルール（最優先 — 違反は評価ゼロ）

プライマリアクセントカラー: **${accentColor}**

このカラーを以下の要素に**必ず**適用してください:
- **ボタン**: すべてのプライマリボタンの背景色 (bg-[${accentColor}])
- **CTAボタン**: ホバー時はこの色を 10% 暗くした色
- **リンクテキスト**: テキストリンクの色 (text-[${accentColor}])
- **見出し装飾**: h2/h3 の下線・アンダーバー・左ボーダー (border-[${accentColor}])
- **アイコン**: SVG アイコンの fill/stroke (text-[${accentColor}])
- **バッジ・タグ**: カテゴリバッジの背景色 (bg-[${accentColor}]/10 + text-[${accentColor}])
- **フォーム要素**: input の focus ring (focus:ring-[${accentColor}])
- **アクティブ状態**: ナビゲーションのアクティブインジケーター

### アクセントカラー — 禁止事項:
❌ ボタンに灰色・黒色・白色を使用する（ゴーストボタンを除く）
❌ 見出し装飾にアクセントカラーと異なる色を使用する
❌ アクセントカラーを一切使用しない
❌ アクセントカラーをページの背景全体に使用する（ポイント使いのみ）` : ""}
${lockedHeaderHtml || lockedFooterHtml ? `
## 共通パーツ（ロック済み — 絶対変更禁止）

以下の HTML コードブロックは確定済みの共通パーツです。
**一字一句変更せず**、指定された位置にそのまま出力してください。
AIが生成するのは <main> 内のコンテンツのみです。
${lockedHeaderHtml ? `
### ヘッダー（ロック済み）
\`\`\`html
${lockedHeaderHtml}
\`\`\`` : ""}
${lockedFooterHtml ? `
### フッター（ロック済み）
\`\`\`html
${lockedFooterHtml}
\`\`\`` : ""}

上記ロック済みパーツを previewHtml の先頭（ヘッダー）と末尾（フッター）にそのまま配置してください。` : ""}

### デザイン準拠
- テキスト色: text-oasis-primary, text-oasis-secondary, text-oasis-tertiary, text-oasis-muted, text-oasis-accent
- 背景色: bg-oasis-bg-main, bg-oasis-bg-surface, bg-oasis-bg-card, bg-oasis-bg-overlay, bg-oasis-bg-accent
- フォント: font-oasis-heading, font-oasis-body
- 元デザインの余白・角丸・影のパターンを踏襲（Design Token の数値を使用）
- 配色やトーンは元デザインと統一感を保つこと

${fontMode === "original" ? `### フォント指定ルール（元デザイン優先）
- 元デザインで使用されているフォントをそのまま使用すること
- CSS の font-family にはフォールバックとして sans-serif / serif を必ず含める
- 元デザインのフォントが不明な場合は Noto Sans JP をデフォルトで使用` : `### フォント指定ルール（Google Fonts 優先）
- フォントは必ず **Google Fonts** から選択すること（Figma との互換性を保つため）
- 元デザインが Google Fonts でない場合は、最も近い Google Fonts に置き換える
- 日本語: Noto Sans JP, Noto Serif JP, M PLUS 1p, Zen Kaku Gothic New, Kosugi Maru 等
- 英字: Inter, Roboto, Open Sans, Montserrat, Poppins, Lato 等
- CSS の font-family にはフォールバックとして sans-serif / serif を必ず含める`}

### コーディング規約（絶対遵守）
- 16px = 1rem（html font-size ハック禁止）
- 本文テキストの font-size は最小 15px（0.9375rem）以上
- 見出しは本文に対して適切なジャンプ率を設定（h1: 2rem〜, h2: 1.5rem〜, h3: 1.25rem〜）
- カスタムクラス名は snake_case（例: section_hero, card_wrapper）
- モバイルファースト: ベースにモバイル、md: / lg: で拡張
- position: absolute は **装飾シェイプ（decorative_ プレフィックス）のみ** 許可。それ以外は flex / grid で構成
- セマンティック HTML（header, nav, main, section, footer）

### 出力形式
以下の JSON 形式で回答（JSON のみ、説明不要）:
{
  "componentCode": "import React from 'react';\\n\\nexport default function SubPage() {\\n  return (\\n    ...\\n  );\\n}",
  "previewHtml": "<header class='...'>...</header>\\n<main>...</main>\\n<footer>...</footer>"
}

**重要: previewHtml は純粋な HTML で出力してください。**
- className ではなく class を使用
- {/* コメント */} ではなく <!-- コメント --> を使用
- React/JSX 構文（import, export, onClick, onChange 等）は含めない
- previewHtml は <body> 直下に挿入されるため、<html>/<head>/<body> タグは不要`;
}

/**
 * 要素のスタイルからインラインCSS配列を構築するヘルパー
 */
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
  if (l.margin && l.margin !== "0px") styles.push(`margin:${l.margin}`);
  if (l.display === "flex") {
    styles.push("display:flex");
    if (l.flexDirection && l.flexDirection !== "row") styles.push(`flex-direction:${l.flexDirection}`);
    if (l.justifyContent) styles.push(`justify-content:${l.justifyContent}`);
    if (l.alignItems) styles.push(`align-items:${l.alignItems}`);
    if (l.gap && l.gap !== "0px") styles.push(`gap:${l.gap}`);
    if (l.flexWrap) styles.push(`flex-wrap:${l.flexWrap}`);
  }
  if (l.display === "grid") {
    styles.push("display:grid");
  }
  if (t.fontFamily) styles.push(`font-family:${t.fontFamily}`);
  if (t.fontSize) styles.push(`font-size:${t.fontSize}`);
  if (t.fontWeight) styles.push(`font-weight:${t.fontWeight}`);
  if (t.lineHeight && t.lineHeight !== "normal") styles.push(`line-height:${t.lineHeight}`);
  if (t.letterSpacing && t.letterSpacing !== "normal") styles.push(`letter-spacing:${t.letterSpacing}`);
  if (t.textAlign && t.textAlign !== "start") styles.push(`text-align:${t.textAlign}`);
  if (t.color) styles.push(`color:${t.color}`);

  return styles;
}

/**
 * 要素を再帰的にHTMLへ変換（最大3階層）
 */
function renderElementRecursive(element, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return "";
  const indent = "  ".repeat(depth + 1);

  const styles = buildElementStyles(element);
  const bb = element.boundingBox;
  if (bb && bb.width > 0 && depth === 0) {
    styles.push("width:100%");
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
  const text = (element.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tagName = (element.tagName || "div").toLowerCase();
  const tag = ["p", "a", "span", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "img", "button", "nav", "header", "footer", "section", "article", "main", "aside"].includes(tagName) ? tagName : "div";

  if (element.children && element.children.length > 0) {
    const childrenHtml = element.children
      .map((child) => renderElementRecursive(child, depth + 1, maxDepth))
      .filter(Boolean)
      .join("\n");
    return `${indent}<${tag}${styleAttr}>\n${childrenHtml}\n${indent}</${tag}>`;
  }

  return `${indent}<${tag}${styleAttr}>${text}</${tag}>`;
}

/**
 * ロック済み要素からセマンティック HTML を生成
 * @param {object} element - DNA element with styles
 * @param {string} role - "header" | "footer" | "nav" | "section" | etc.
 * @returns {string} HTML string
 */
function renderLockedPartHtml(element, role) {
  const tagMap = { header: "header", footer: "footer", nav: "nav", section: "section", fv: "section", cta: "section" };
  const tag = tagMap[role] || "div";

  const styles = buildElementStyles(element);
  const bb = element.boundingBox;
  if (bb && bb.width > 0) {
    styles.push("width:100%");
    if (bb.height > 0) styles.push(`min-height:${bb.height}px`);
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
  const name = element.figmaNodeName || element.selector || "";
  const text = (element.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 子要素がある場合は再帰的にHTMLを生成（最大3階層）
  let childrenHtml = "";
  if (element.children && element.children.length > 0) {
    childrenHtml = element.children
      .map((child) => renderElementRecursive(child, 0, 3))
      .filter(Boolean)
      .join("\n");
  }

  return `<${tag}${styleAttr}>\n  <!-- ${name} -->\n${childrenHtml || `  ${text}`}\n</${tag}>`;
}

router.post("/generate-subpage", verifyToken, async (req, res) => {
  const {
    dnaElements,
    frameName,
    pageTitle,
    contentMode,
    manualContent,
    customInstructions,
    fontMode,
    accentColor,
    lockedParts,
    model,
    apiKey,
  } = req.body;

  if (!Array.isArray(dnaElements) || dnaElements.length === 0) {
    return res.status(400).json({ error: "dnaElements 配列は必須です" });
  }

  try {
    // ロック済みパーツのHTMLを生成
    let lockedHeaderHtml = "";
    let lockedFooterHtml = "";
    if (Array.isArray(lockedParts)) {
      for (const lp of lockedParts) {
        const el = dnaElements[lp.elementIndex];
        if (!el) continue;
        if (lp.role === "header" || lp.role === "nav") {
          lockedHeaderHtml += renderLockedPartHtml(el, lp.role) + "\n";
        } else if (lp.role === "footer") {
          lockedFooterHtml += renderLockedPartHtml(el, lp.role) + "\n";
        }
      }
    }

    // アクセントカラーの自動検出（クライアントから未指定の場合）
    const resolvedAccentColor = accentColor || (() => {
      const detected = extractPrimaryAccentColor(dnaElements);
      return detected ? detected.hex : null;
    })();

    const summary = extractDnaSummary(dnaElements);
    const systemPrompt = buildSubpageSystemPrompt({
      pageTitle,
      contentMode: contentMode || "ai",
      manualContent,
      customInstructions,
      fontMode: fontMode || "google",
      accentColor: resolvedAccentColor,
      lockedHeaderHtml: lockedHeaderHtml || null,
      lockedFooterHtml: lockedFooterHtml || null,
    });

    const structuredContext = buildStructuredContext(dnaElements);

    const userMessage = `## 元デザイン情報

**フレーム名**: ${frameName || pageTitle || "選択デザイン"}
**生成ページタイトル**: ${pageTitle || "下層ページ"}

---

## デザインサマリー（配色・タイポグラフィ・レイアウト）

${JSON.stringify({ colors: summary.colors, typography: summary.typography, layout: summary.layout, visual: summary.visual }, null, 2)}

---

## 構造ヒエラルキー（Shell 要素の確認用 — shell: true の要素は変更禁止）

${JSON.stringify(summary.structuralHierarchy, null, 2)}

---

## ビジュアルキー（ブランドの視覚的アイデンティティ — Design Token）

${JSON.stringify(summary.visualKeys, null, 2)}

---

## 優先度付き要素コンテキスト（ヘッダー・フッター優先、最大 20 件、2 階層子要素付き）

${JSON.stringify(structuredContext, null, 2)}`;

    let text;
    if (model && apiKey) {
      text = await callAI(systemPrompt, userMessage, {
        provider: model,
        apiKey,
        maxTokens: 6144,
      });
    } else if (process.env.deepseek_API_KEY) {
      const OpenAI = require("openai");
      const fallbackClient = new OpenAI({
        apiKey: process.env.deepseek_API_KEY,
        baseURL: "https://api.deepseek.com",
      });
      const response = await fallbackClient.chat.completions.create({
        model: "deepseek-chat",
        max_tokens: 6144,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      text = response.choices[0]?.message?.content || "";
    } else {
      return res.status(500).json({
        error: "API キーが設定されていません。設定ページで登録するか、サーバー環境変数を設定してください。",
      });
    }

    let parsed;
    try {
      // 1. コードブロックを除去 (```json ... ``` や ``` ... ```)
      let cleaned = text.replace(/```(?:json|html|jsx)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();

      // 2. JSON パース試行: componentCode + previewHtml の両方を含むオブジェクト
      const jsonMatch = cleaned.match(/\{[^{}]*"componentCode"\s*:\s*"[\s\S]*?"previewHtml"\s*:\s*"[\s\S]*?"\s*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      // 3. フォールバック: componentCode / previewHtml を個別抽出
      let componentCode = "";
      let previewHtml = "";

      // componentCode フィールドを抽出
      const codeMatch = text.match(/"componentCode"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"previewHtml"|"\s*\})/);
      if (codeMatch) {
        componentCode = codeMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }

      // previewHtml フィールドを抽出
      const htmlMatch = text.match(/"previewHtml"\s*:\s*"([\s\S]*?)"\s*\}?$/);
      if (htmlMatch) {
        previewHtml = htmlMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }

      // 4. どちらも取れない場合: テキスト全体から HTML タグを検出して previewHtml に
      if (!previewHtml) {
        const htmlTagMatch = text.match(/<(?:header|main|section|div|nav|footer)[\s\S]*<\/(?:header|main|section|div|nav|footer)>/i);
        if (htmlTagMatch) {
          previewHtml = htmlTagMatch[0];
        }
      }

      // 5. componentCode から JSX の return 部分を抽出して previewHtml に
      if (!previewHtml && componentCode) {
        const returnMatch = componentCode.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*\}?\s*$/);
        if (returnMatch) {
          previewHtml = returnMatch[1]
            .replace(/className=/g, "class=")
            .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        }
      }

      // 6. それでもダメならテキスト全体を使う
      if (!previewHtml) {
        previewHtml = text.includes("<") ? text : `<div class="p-8 text-gray-500">${text.slice(0, 2000)}</div>`;
      }
      if (!componentCode) {
        componentCode = text;
      }

      parsed = { componentCode, previewHtml };
    }

    const result = sanitizeComponentOutput(parsed.componentCode, parsed.previewHtml);
    // previewHtml に JSX 構文が混入している場合は純 HTML に変換
    const cleanedPreviewHtml = jsxToHtml(result.previewHtml);
    const colorMap = extractColorMap(dnaElements);
    const dnaHash = generateDnaHash(dnaElements);

    const saved = saveGeneratedCode({
      dnaHash,
      dnaId: null,
      componentCode: result.componentCode,
      previewHtml: cleanedPreviewHtml,
      colorMap,
      createdBy: req.user.id,
    });

    res.json({
      success: true,
      componentCode: result.componentCode,
      previewHtml: cleanedPreviewHtml,
      cacheId: saved.id,
    });
  } catch (err) {
    res.status(500).json({ error: `ページ生成に失敗しました: ${err.message}` });
  }
});

/**
 * セクション単位生成用のシステムプロンプト
 */
function buildSectionSystemPrompt({ pageTitle, sectionLabel, sectionIndex, totalSections, contentMode, manualContent, customInstructions, fontMode, accentColor }) {
  const title = pageTitle || "下層ページ";

  let systemRole;
  if (contentMode === "ai") {
    systemRole = `あなたはシニアデザイナー兼コピーライターです。
元デザインのブランド世界観を完全に継承しながら、ページ「${title}」の一部セクション「${sectionLabel}」を生成してください。`;
  } else if (contentMode === "manual") {
    systemRole = `あなたは UI コーダーです。
ユーザーが提供したテキストのうち、このセクション「${sectionLabel}」に該当する部分を一字一句変更せず配置してください。`;
  } else {
    systemRole = `あなたは UI コーダーです。
このセクション「${sectionLabel}」に仮テキスト（見出し見出し、本文本文...）を配置してください。レイアウト精度のみが評価基準です。`;
  }

  let contentRule = "";
  if (contentMode === "dummy") {
    contentRule = `
### コンテンツ（仮テキスト）
- 見出し: 「見出し見出し」の繰り返し
- 本文: 「本文本文本文本文」の繰り返し`;
  } else if (contentMode === "manual" && manualContent) {
    contentRule = `
### コンテンツ（手動入力 — 一字一句変更禁止）
以下のテキストからこのセクションに適切な部分を使用:
---
${manualContent}
---`;
  } else {
    contentRule = `
### コンテンツ（AI生成）
セクション「${sectionLabel}」にふさわしい具体的で現実的な文章を生成してください。`;
  }

  let customRule = customInstructions ? `\n### カスタム指示\n${customInstructions}` : "";

  let accentRule = "";
  if (accentColor) {
    accentRule = `
## アクセントカラー: ${accentColor}
ボタン・リンク・見出し装飾に bg-[${accentColor}] / text-[${accentColor}] / border-[${accentColor}] を必ず適用。`;
  }

  return `${systemRole}

## セクション情報
- ページタイトル: 「${title}」
- セクション: 「${sectionLabel}」（${sectionIndex + 1}/${totalSections}）
- 生成するのは **<section> タグ 1 つだけ** です。ヘッダー・フッターは含めないでください。
${accentRule}

## ビジュアル DNA 継承
ユーザーメッセージのデザインサマリーに含まれる配色・タイポグラフィ・角丸・シャドウを忠実に再現してください。
designTokens の数値をそのまま Tailwind クラスとして適用してください。
${contentRule}
${customRule}

### デザイン準拠
- テキスト色: text-oasis-primary, text-oasis-secondary, text-oasis-tertiary, text-oasis-muted, text-oasis-accent
- 背景色: bg-oasis-bg-main, bg-oasis-bg-surface, bg-oasis-bg-card
- フォント: font-oasis-heading, font-oasis-body
${fontMode === "original" ? "- 元デザインのフォントをそのまま使用" : "- Google Fonts から選択（Noto Sans JP, Inter 等）"}

### コーディング規約
- 16px = 1rem、本文 font-size 最小 15px
- カスタムクラス名は snake_case
- position: absolute は装飾シェイプ（decorative_）のみ
- モバイルファースト: ベースにモバイル、md:/lg: で拡張

### 出力形式
以下の JSON のみ出力（説明不要）:
{
  "sectionHtml": "<section class='...'>...</section>",
  "sectionCode": "/* React JSX for this section */"
}

**sectionHtml は純粋な HTML（class 属性、React構文なし）で出力。**`;
}

/**
 * POST /api/export/generate-section
 * セクション単位で AI コード生成
 */
router.post("/generate-section", verifyToken, async (req, res) => {
  const {
    dnaElements,
    pageTitle,
    sectionLabel,
    sectionIndex,
    totalSections,
    previousSectionsHtml,
    contentMode,
    manualContent,
    customInstructions,
    fontMode,
    accentColor,
    model,
    apiKey,
    partConfig,
  } = req.body;

  if (!Array.isArray(dnaElements) || dnaElements.length === 0) {
    return res.status(400).json({ error: "dnaElements 配列は必須です" });
  }
  if (!sectionLabel) {
    return res.status(400).json({ error: "sectionLabel は必須です" });
  }

  // ── Clone mode: generate HTML directly from source elements ──
  if (partConfig && partConfig.mode === "clone") {
    try {
      const sourceIndices = partConfig.elementIndices || [];
      const role = partConfig.role || "section";
      const htmlParts = [];

      for (const idx of sourceIndices) {
        const el = dnaElements[idx];
        if (!el) continue;
        htmlParts.push(renderLockedPartHtml(el, role));
      }

      // If no specific elements, wrap all in a section
      if (htmlParts.length === 0 && partConfig.sourceElements) {
        for (const el of partConfig.sourceElements) {
          htmlParts.push(renderLockedPartHtml(el, role));
        }
      }

      const sectionHtml = htmlParts.length > 0
        ? `<section class="clone_${role}" style="width:100%;">\n${htmlParts.join("\n")}\n</section>`
        : `<section class="clone_${role}" style="width:100%;padding:2rem;"><!-- Clone: no matching elements --></section>`;

      return res.json({ success: true, sectionHtml, sectionCode: sectionHtml });
    } catch (err) {
      return res.status(500).json({ error: `Clone 生成に失敗しました: ${err.message}` });
    }
  }

  try {
    const summary = extractDnaSummary(dnaElements);
    const systemPrompt = buildSectionSystemPrompt({
      pageTitle,
      sectionLabel,
      sectionIndex: sectionIndex || 0,
      totalSections: totalSections || 1,
      contentMode: contentMode || "ai",
      manualContent,
      customInstructions,
      fontMode: fontMode || "google",
      accentColor,
    });

    // 前セクションのコンテキスト（スタイル統一のため）
    let prevContext = "";
    if (previousSectionsHtml && previousSectionsHtml.length > 0) {
      prevContext = `\n\n## 前セクション（参考 — スタイル統一用）\n以下は既に承認済みのセクションです。配色・余白・フォントサイズを統一してください:\n\`\`\`html\n${previousSectionsHtml.slice(-2000)}\n\`\`\``;
    }

    const userMessage = `## デザインサマリー
${JSON.stringify(summary, null, 2)}
${prevContext}`;

    const provider = model || "deepseek";
    const key = apiKey || process.env.deepseek_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "API キーが設定されていません" });
    }

    const aiResult = await callAI(systemPrompt, userMessage, {
      provider,
      apiKey: key,
      maxTokens: 4000,
    });

    let sectionHtml = "";
    let sectionCode = "";

    try {
      let cleaned = aiResult.replace(/```(?:json|html|jsx)?\s*\n?/gi, "").replace(/```\s*$/gm, "").trim();
      const parsed = JSON.parse(cleaned);
      sectionHtml = parsed.sectionHtml || "";
      sectionCode = parsed.sectionCode || "";
    } catch {
      // フォールバック: HTMLタグを検出
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

/**
 * POST /api/export/assemble-page
 * 承認済みセクション + ロック済みパーツを結合してページを組み立て
 */
router.post("/assemble-page", verifyToken, async (req, res) => {
  const {
    lockedHeaderHtml,
    lockedFooterHtml,
    approvedSections,
    pageTitle,
    dnaElements,
  } = req.body;

  if (!Array.isArray(approvedSections) || approvedSections.length === 0) {
    return res.status(400).json({ error: "approvedSections は必須です" });
  }

  try {
    const header = lockedHeaderHtml || "";
    const footer = lockedFooterHtml || "";
    const mainContent = approvedSections.map((s) => s.html).join("\n\n");

    const previewHtml = `${header}\n<main>\n${mainContent}\n</main>\n${footer}`;

    const sectionCodes = approvedSections.map((s) => s.code).join("\n\n");
    const componentCode = `import React from 'react';

export default function ${(pageTitle || "SubPage").replace(/[^a-zA-Z0-9]/g, "")}Page() {
  return (
    <>
${header ? `      {/* Locked Header */}\n      <header dangerouslySetInnerHTML={{ __html: \`${header.replace(/`/g, "\\`")}\` }} />` : ""}
      <main>
${sectionCodes}
      </main>
${footer ? `      {/* Locked Footer */}\n      <footer dangerouslySetInnerHTML={{ __html: \`${footer.replace(/`/g, "\\`")}\` }} />` : ""}
    </>
  );
}`;

    const colorMap = extractColorMap(dnaElements || []);
    const dnaHash = generateDnaHash(dnaElements || []);
    const saved = saveGeneratedCode({
      dnaHash,
      componentCode,
      previewHtml,
      colorMap,
      createdBy: req.user.id,
    });

    res.json({
      success: true,
      componentCode,
      previewHtml,
      cacheId: saved.id,
    });
  } catch (err) {
    res.status(500).json({ error: `ページ組み立てに失敗しました: ${err.message}` });
  }
});

module.exports = router;
