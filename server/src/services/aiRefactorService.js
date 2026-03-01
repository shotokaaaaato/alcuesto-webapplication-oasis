const OpenAI = require("openai");
const {
  extractColorsFromDna,
  extractTypographyFromDna,
  parseFontFamily,
  parseFontSize,
} = require("./figmaService");
const { callAI } = require("./aiClientFactory");

const client = new OpenAI({
  apiKey: process.env.deepseek_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const SYSTEM_PROMPT = `あなたはシニアフロントエンドエンジニアです。与えられたデザイン JSON を、OASIS で定義された命名規則（text-oasis-primary 等）に従い、アクセシビリティに配慮した React + Tailwind コンポーネントに変換してください。

## 変換ルール

### カラー
- テキスト色は OASIS セマンティッククラスを優先使用: text-oasis-primary, text-oasis-secondary, text-oasis-tertiary, text-oasis-muted, text-oasis-accent
- 背景色は: bg-oasis-bg-main, bg-oasis-bg-surface, bg-oasis-bg-card, bg-oasis-bg-overlay, bg-oasis-bg-accent
- OASIS変数に対応しない色のみ Tailwind カスタム形式を使用: text-[#HEXVAL], bg-[#HEXVAL]
- OASIS命名規則に従いコメントで意味付け: {/* oasis-primary */}

### border-radius
以下の標準 Tailwind クラスに可能な限りマッピング:
- 0px → rounded-none
- 2px → rounded-sm
- 4px → rounded
- 6px → rounded-md
- 8px → rounded-lg
- 12px → rounded-xl
- 16px → rounded-2xl
- 24px → rounded-3xl
- 9999px → rounded-full
- その他 → rounded-[Xpx] (カスタム値)

### box-shadow
以下の標準 Tailwind クラスに可能な限りマッピング:
- none → shadow-none
- 小さい影 (0 1px 2px) → shadow-sm
- 中程度 (0 1px 3px, 0 4px 6px) → shadow / shadow-md
- 大きい影 (0 10px 15px, 0 20px 25px) → shadow-lg / shadow-xl
- その他 → shadow-[カスタム値]

### タイポグラフィ
- font-size → text-xs/sm/base/lg/xl/2xl... または text-[Xpx]
- font-weight → font-thin/light/normal/medium/semibold/bold/extrabold/black
- font-family → font-sans / font-serif / font-mono、またはカスタム font-['FontName']
- line-height → leading-tight/snug/normal/relaxed/loose または leading-[値]
- letter-spacing → tracking-tighter/tight/normal/wide/wider/widest または tracking-[値]

### レイアウト
- display: flex → flex, flexDirection: column → flex-col
- justify-content → justify-start/center/end/between/around/evenly
- align-items → items-start/center/end/stretch/baseline
- gap → gap-1/2/3/4... または gap-[Xpx]
- padding → p-1/2/3/4... または px-[Xpx] py-[Xpx]
- margin → m-1/2/3/4... または mx-[Xpx] my-[Xpx]

### アクセシビリティ
- 適切な HTML セマンティクスを使用 (header, nav, main, section, article, aside, footer)
- 画像には alt 属性
- ボタンには aria-label（必要時）
- リンクには意味のあるテキスト
- コントラスト比に注意

## サニタイゼーションルール（必須）

### 1. トラッキングコードの全除去
入力に含まれる以下のトラッキング・分析系コードをすべて除去してください:
- Google Analytics (gtag.js, ga(), dataLayer.push, UA-XXXXXXX)
- Google Tag Manager (GTM-XXXXXXX, data-gtm-* 属性, googletagmanager.com)
- Facebook Pixel (fbq(), connect.facebook.net)
- その他の分析スクリプト (hotjar, mixpanel, segment, amplitude 等)
- data-gtm-*, data-analytics-*, data-tracking-* などの計測用カスタム属性
- noscript タグ内のトラッキング用 img/iframe

### 2. サイト固有IDの削除
- id 属性に含まれるサイト固有の識別子を除去（例: id="header-nav-1234", id="wp-block-xxx"）
- CMS固有のクラス名を汎用クラスに置換（例: wp-block-*, elementor-*, framer-*）
- data-* 属性のうちサイト固有のものを除去（data-page-id, data-section-id 等）
- 出力コンポーネントには id 属性を使用せず、className のみで構造化

### 3. OASIS 変数への置換
ハードコードされた HEX/RGB カラー値を OASIS セマンティック変数に置換してください:
- テキスト色: text-oasis-primary, text-oasis-secondary, text-oasis-tertiary, text-oasis-muted, text-oasis-accent
- 背景色: bg-oasis-bg-main, bg-oasis-bg-surface, bg-oasis-bg-card, bg-oasis-bg-overlay, bg-oasis-bg-accent
- フォント: font-oasis-heading, font-oasis-body, font-oasis-mono, font-oasis-accent
- 角丸: rounded-oasis-sm, rounded-oasis-md, rounded-oasis-lg
- 影: shadow-oasis-sm, shadow-oasis, shadow-oasis-md, shadow-oasis-lg
色の対応はユーザーメッセージ内の「デザインカラーマッピング」に基づきます。
ハードコード HEX 値 (text-[#XXXXXX], bg-[#XXXXXX]) は残さず、必ず OASIS 変数クラスに変換してください。

### 4. 汎用 React コンポーネント出力
- 環境非依存: 特定のCMS、フレームワーク、ホスティング環境に依存するコードを含めない
- 再利用可能: Props でコンテンツを差し替え可能な構造にする（テキスト、画像URL等）
- セマンティック HTML: div の濫用を避け、header/nav/main/section/article/footer を適切に使用
- クリーンな構造: 不要なラッパー div を除去し、最小限のネスト構造にする
- 外部依存なし: CDN リンク、外部スクリプト、iframe 埋め込みを含めない

## 標準コーディング規約（絶対遵守）

### 命名規則: snake_case
- カスタムクラス名はすべて snake_case を使用（ハイフン - は禁止。JS 誤認防止のため）
- 例: btn_primary, section_title, card_wrapper, nav_link
- Tailwind 標準ユーティリティクラス（flex, p-4, text-lg 等）はそのまま使用
- OASIS 変数クラス（text-oasis-primary 等）もそのまま使用

### 単位: 標準 rem ベース
- ブラウザ標準の 16px = 1rem を前提に計算
- html { font-size: 62.5%; } などのハックは絶対に使用しない
- px 値から rem への変換: 8px → 0.5rem, 12px → 0.75rem, 16px → 1rem, 24px → 1.5rem, 32px → 2rem
- Tailwind の rem ベースクラス（p-4 = 1rem, text-base = 1rem 等）を優先使用

### レスポンシブ設計
- モバイルファースト原則: ベースにモバイルスタイルを記述し、md:, lg: で拡張
- ただしレイアウト維持に有利な場合は max-w-[breakpoint] パターンを適切に使用
- 370px 幅（SP 最小）でも表示が崩れないよう設計:
  - 余白に min-w-0 / overflow-hidden / truncate を適用して溢れを防止
  - テキストは break-words / text-wrap で折り返しを保証
  - 画像・メディアは max-w-full / w-full で幅制御
- ブレークポイント: sm(640px), md(768px), lg(1024px), xl(1280px)

### 構造の最適化
- position: absolute は原則禁止。flex または grid でレイアウトを構成
- Anima / Figma Dev Mode 等の出力に多い absolute + top/left の座標配置を排除
- 代替: flex + gap, grid + grid-cols, auto レイアウトを使用
- ネスト深度は最大 4 階層までに抑制

## 出力形式
以下の JSON 形式で回答してください（JSON のみ、説明不要）:
{
  "componentCode": "// React + Tailwind コンポーネント (JSX)\nimport React from 'react';\n\nexport default function DesignComponent() {\n  return (\n    ...\n  );\n}",
  "previewHtml": "<!-- iframe プレビュー用の HTML + Tailwind クラス -->\n<div class='...'>\n  ...\n</div>"
}

componentCode は React コンポーネント（export default）として出力してください。
previewHtml は同等の見た目を持つ HTML + Tailwind クラスで出力してください（React 不要、ブラウザで直接表示可能）。`;

/**
 * ブランドの視覚的モチーフ（Visual Keys）を抽出する
 * - 支配的な border-radius、シャドウパターン（Design Token として数値定数化）
 * - 装飾シェイプ（Shell 要素候補）
 * - タイポグラフィの癖（絶対規約）
 * - 形状 Design Token（正確な数値を Tailwind クラスとして強制適用用）
 */
function extractVisualKeys(elements) {
  const radiusPatterns = new Map();
  const shadowPatterns = new Map();
  const decorativeShapes = [];
  const typographyQuirks = [];
  const fontFamilies = new Set();
  let hasVerticalWriting = false;

  function processEl(el) {
    const v = el.styles?.visual;
    const l = el.styles?.layout;
    const t = el.styles?.typography;

    // border-radius パターン集計
    if (v?.borderRadius && v.borderRadius !== "0px") {
      const key = v.borderRadius;
      const existing = radiusPatterns.get(key) || { count: 0, tags: [], selectors: [] };
      existing.count++;
      if (el.tagName && !existing.tags.includes(el.tagName)) {
        existing.tags.push(el.tagName);
      }
      if (el.selector && existing.selectors.length < 3) {
        existing.selectors.push(el.selector);
      }
      radiusPatterns.set(key, existing);
    }

    // boxShadow パターン集計
    if (v?.boxShadow && v.boxShadow !== "none") {
      shadowPatterns.set(v.boxShadow, (shadowPatterns.get(v.boxShadow) || 0) + 1);
    }

    // 装飾シェイプ検出: 大きな要素 + 高 border-radius + テキストなし/短い
    const width = parseFloat(l?.width);
    const radiusVal = parseFloat(v?.borderRadius);
    const isLarge = width > 200;
    const hasOrganicRadius = radiusVal > 40;
    const isDecorative = isLarge && hasOrganicRadius &&
      (!el.textContent || el.textContent.trim().length < 10);
    if (isDecorative && decorativeShapes.length < 5) {
      decorativeShapes.push({
        tag: el.tagName,
        selector: el.selector,
        width: l.width,
        height: l.height,
        backgroundColor: v?.backgroundColor,
        borderRadius: v.borderRadius,
        opacity: v?.opacity,
        shellFlag: true, // Shell 要素としてフラグ
      });
    }

    // タイポグラフィの癖
    if (t?.letterSpacing) {
      const ls = parseFloat(t.letterSpacing);
      if (Math.abs(ls) > 2 && typographyQuirks.length < 5) {
        typographyQuirks.push({
          selector: el.selector,
          tag: el.tagName,
          letterSpacing: t.letterSpacing,
          fontSize: t.fontSize,
          fontFamily: t.fontFamily,
          type: "extreme-letter-spacing",
        });
      }
    }

    // フォントファミリー収集（混在検出用）
    if (t?.fontFamily) {
      fontFamilies.add(t.fontFamily);
    }

    // 縦書き検出（writing-mode が存在する場合）
    if (l?.writingMode && l.writingMode.includes("vertical")) {
      hasVerticalWriting = true;
      if (typographyQuirks.length < 5) {
        typographyQuirks.push({
          selector: el.selector,
          tag: el.tagName,
          writingMode: l.writingMode,
          fontSize: t?.fontSize,
          type: "vertical-writing",
        });
      }
    }

    if (el.children) el.children.forEach(processEl);
  }

  elements.forEach(processEl);

  // Design Token: border-radius の正確な数値定数
  const dominantBorderRadius = [...radiusPatterns.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([value, data]) => ({
      value,
      tailwindClass: borderRadiusToTailwind(value),
      count: data.count,
      tags: data.tags,
      selectors: data.selectors,
    }));

  // Design Token: boxShadow の正確な数値定数
  const topShadows = [...shadowPatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([value, count]) => ({
      value,
      tailwindClass: `shadow-[${value.replace(/\s+/g, "_")}]`,
      count,
    }));

  // フォント混在情報
  const mixedFonts = [...fontFamilies].slice(0, 6);

  return {
    dominantBorderRadius,
    topShadows,
    decorativeShapes,
    typographyQuirks,
    designTokens: {
      borderRadiusValues: dominantBorderRadius.map((r) => r.value),
      shadowValues: topShadows.map((s) => s.value),
      fontFamilies: mixedFonts,
      hasVerticalWriting,
      hasMixedFonts: mixedFonts.length > 1,
    },
  };
}

/**
 * border-radius 値を最適な Tailwind クラスに変換
 */
function borderRadiusToTailwind(value) {
  const px = parseFloat(value);
  if (isNaN(px)) return `rounded-[${value}]`;
  if (px === 0) return "rounded-none";
  if (px <= 2) return "rounded-sm";
  if (px <= 4) return "rounded";
  if (px <= 6) return "rounded-md";
  if (px <= 8) return "rounded-lg";
  if (px <= 12) return "rounded-xl";
  if (px <= 16) return "rounded-2xl";
  if (px <= 24) return "rounded-3xl";
  if (px >= 9999) return "rounded-full";
  return `rounded-[${px}px]`;
}

/**
 * ページの構造ゾーン（header/nav/hero/footer/main/sections）を分類し、
 * Shell（変更不可）要素にフラグを立てる
 */
function extractStructuralHierarchy(elements) {
  const zones = {
    header: null,
    nav: null,
    hero: null,
    footer: null,
    main: null,
    sections: [],
  };
  const shellElements = []; // 変更不可のブランド要素

  function summarizeEl(el, isShell = false) {
    const summary = {
      tag: el.tagName,
      selector: el.selector,
      text: (el.textContent || "").slice(0, 80),
      backgroundColor: el.styles?.visual?.backgroundColor,
      borderRadius: el.styles?.visual?.borderRadius,
      height: el.styles?.layout?.height,
      padding: el.styles?.layout?.padding,
      display: el.styles?.layout?.display,
      childCount: el.children?.length || 0,
    };
    if (isShell) summary.shell = true;
    return summary;
  }

  function classify(el) {
    const tag = (el.tagName || "").toLowerCase();
    const sel = (el.selector || "").toLowerCase();

    // Shell 候補: header
    if (tag === "header" && !zones.header) {
      zones.header = summarizeEl(el, true);
      shellElements.push({ zone: "header", ...summarizeEl(el, true) });
      return;
    }
    if (tag === "nav" && !zones.nav) {
      zones.nav = summarizeEl(el, true);
      shellElements.push({ zone: "nav", ...summarizeEl(el, true) });
      return;
    }
    // Shell 候補: footer
    if (tag === "footer" && !zones.footer) {
      zones.footer = summarizeEl(el, true);
      shellElements.push({ zone: "footer", ...summarizeEl(el, true) });
      return;
    }
    if (tag === "main" && !zones.main) {
      zones.main = summarizeEl(el);
    }

    // Class 名ヒューリスティクス
    if (!zones.header && (sel.includes("header") || sel.includes("gnav") || sel.includes("site-header"))) {
      zones.header = summarizeEl(el, true);
      shellElements.push({ zone: "header", ...summarizeEl(el, true) });
    }
    if (!zones.hero && (sel.includes("hero") || sel.includes("kv") || sel.includes("mv") || sel.includes("mainvisual") || sel.includes("jumbotron"))) {
      zones.hero = summarizeEl(el);
    }
    if (!zones.footer && (sel.includes("footer") || sel.includes("site-footer"))) {
      zones.footer = summarizeEl(el, true);
      shellElements.push({ zone: "footer", ...summarizeEl(el, true) });
    }

    // 装飾系 SVG / アイコン / 背景装飾を Shell として検出
    if (tag === "svg" || sel.includes("icon") || sel.includes("decoration") || sel.includes("ornament")) {
      if (shellElements.length < 10) {
        shellElements.push({ zone: "decoration", ...summarizeEl(el, true) });
      }
    }

    if (tag === "section" && zones.sections.length < 5) {
      zones.sections.push(summarizeEl(el));
    }

    if (el.children) el.children.forEach(classify);
  }

  elements.forEach(classify);
  return { ...zones, shellElements };
}

/**
 * デザイン要素をAI用に軽量化・構造化する
 */
function extractDnaSummary(elements) {
  const colors = extractColorsFromDna(elements);
  const typography = extractTypographyFromDna(elements);

  const layoutInfo = [];
  const visualInfo = [];

  function processElement(el) {
    if (el.styles?.layout) {
      const l = el.styles.layout;
      const layoutEntry = {
        tag: el.tagName,
        display: l.display,
        position: l.position,
        width: l.width,
        height: l.height,
        padding: l.padding,
        margin: l.margin,
        gap: l.gap,
      };
      if (l.flexDirection) layoutEntry.flexDirection = l.flexDirection;
      if (l.justifyContent) layoutEntry.justifyContent = l.justifyContent;
      if (l.alignItems) layoutEntry.alignItems = l.alignItems;
      layoutInfo.push(layoutEntry);
    }

    if (el.styles?.visual) {
      const v = el.styles.visual;
      if (v.borderRadius || v.boxShadow || v.border) {
        visualInfo.push({
          tag: el.tagName,
          borderRadius: v.borderRadius,
          boxShadow: v.boxShadow,
          border: v.border,
          opacity: v.opacity,
        });
      }
    }

    if (el.children) el.children.forEach(processElement);
  }

  elements.forEach(processElement);

  return {
    colors: colors.map((c) => ({
      name: c.name,
      css: c.cssValue,
    })),
    typography: typography.map((t) => ({
      name: t.name,
      fontFamily: t.fontFamily,
      fontSize: t.fontSize,
      fontWeight: t.fontWeight,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
    })),
    layout: layoutInfo,
    visual: visualInfo,
    visualKeys: extractVisualKeys(elements),
    structuralHierarchy: extractStructuralHierarchy(elements),
  };
}

/**
 * デザイン要素をReact + Tailwindコンポーネントに変換
 * @param {Array} dnaElements - デザイン要素の配列
 * @param {{ model?: string, apiKey?: string }} options - AI プロバイダー設定（省略時は env の DeepSeek）
 * @returns {{ componentCode: string, previewHtml: string }}
 */
async function refactorDnaToComponent(dnaElements, options = {}) {
  const summary = extractDnaSummary(dnaElements);

  // デザインカラーマッピングを生成（HEX → OASIS変数名）
  const colors = extractColorsFromDna(dnaElements);
  const colorMap = {};
  const textNames = ["primary", "secondary", "tertiary", "muted", "accent"];
  const bgNames = ["bg-main", "bg-surface", "bg-card", "bg-overlay", "bg-accent"];
  let textIdx = 0;
  let bgIdx = 0;
  colors.forEach((c) => {
    if (c.name.includes("/text/")) {
      const name = textIdx < textNames.length ? textNames[textIdx] : `text-${textIdx}`;
      colorMap[`oasis-${name}`] = c.cssValue;
      textIdx++;
    } else if (c.name.includes("/bg/")) {
      const name = bgIdx < bgNames.length ? bgNames[bgIdx] : `bg-${bgIdx}`;
      colorMap[`oasis-${name}`] = c.cssValue;
      bgIdx++;
    }
  });

  const userMessage = `以下のデザインJSONデータをReact + Tailwindコンポーネントに変換してください。

デザインサマリー:
${JSON.stringify(summary, null, 2)}

デザインカラーマッピング (HEX → OASIS変数):
${JSON.stringify(colorMap, null, 2)}

上記マッピングに基づき、ハードコードされたカラー値をOASIS変数クラスに置換してください。

元の要素構造:
${JSON.stringify(
  dnaElements.map((el) => ({
    tag: el.tagName,
    selector: el.selector,
    text: el.textContent?.slice(0, 100),
    boundingBox: el.boundingBox,
    styles: el.styles,
    children: el.children?.map((c) => ({
      tag: c.tagName,
      text: c.textContent?.slice(0, 100),
      styles: c.styles,
    })),
  })),
  null,
  2
)}`;

  let text;
  const { model, apiKey } = options;

  if (model && apiKey) {
    // ユーザー指定のプロバイダーを使用
    text = await callAI(SYSTEM_PROMPT, userMessage, {
      provider: model,
      apiKey,
      maxTokens: 4096,
    });
  } else {
    // フォールバック: 環境変数の DeepSeek
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });
    text = response.choices[0]?.message?.content || "";
  }

  // JSON部分を抽出（```json ... ``` でラップされている場合も考慮）
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*"componentCode"[\s\S]*"previewHtml"[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      parsed = JSON.parse(text);
    }
  } catch (err) {
    // JSONパースに失敗した場合、テキスト全体をコンポーネントコードとして扱う
    parsed = {
      componentCode: text,
      previewHtml: `<div class="p-4 text-gray-500">プレビュー生成に失敗しました。コードを確認してください。</div>`,
    };
  }

  return {
    componentCode: parsed.componentCode,
    previewHtml: parsed.previewHtml,
  };
}

/**
 * AI 出力のサニタイゼーション後処理
 * システムプロンプトの指示をプログラム的に検証・補完
 */
function sanitizeComponentOutput(componentCode, previewHtml) {
  let cleanCode = componentCode;
  let cleanHtml = previewHtml;

  // ルール1: トラッキングコードの除去
  const trackingPatterns = [
    /<!--\s*Google Tag Manager[\s\S]*?-->/gi,
    /<!--\s*End Google Tag Manager[\s\S]*?-->/gi,
    /<script[^>]*gtag[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*google-analytics[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*facebook[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*fbq[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*hotjar[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*mixpanel[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*segment[^>]*>[\s\S]*?<\/script>/gi,
    /<noscript>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/gi,
    /<noscript>[\s\S]*?facebook[\s\S]*?<\/noscript>/gi,
    /\s+data-gtm-[a-z-]*="[^"]*"/gi,
    /\s+data-analytics-[a-z-]*="[^"]*"/gi,
    /\s+data-tracking-[a-z-]*="[^"]*"/gi,
  ];

  for (const pattern of trackingPatterns) {
    cleanCode = cleanCode.replace(pattern, "");
    cleanHtml = cleanHtml.replace(pattern, "");
  }

  // ルール2: id 属性の除去（コンポーネントは className のみ使用）
  cleanCode = cleanCode.replace(/\s+id=["'][^"']*["']/gi, "");
  cleanHtml = cleanHtml.replace(/\s+id=["'][^"']*["']/gi, "");

  // CMS 固有クラスの除去
  const cmsPatterns = [
    /\bwp-block-[a-z0-9-]+/gi,
    /\belementor-[a-z0-9-]+/gi,
    /\bframer-[a-z0-9-]+/gi,
    /\bwix-[a-z0-9-]+/gi,
    /\bsquarespace-[a-z0-9-]+/gi,
    /\banima-[a-z0-9-]+/gi,
  ];

  for (const pattern of cmsPatterns) {
    cleanCode = cleanCode.replace(pattern, "");
    cleanHtml = cleanHtml.replace(pattern, "");
  }

  // position: absolute のインラインスタイルを除去（decorative_ / bg_shape_ 要素は保持）
  const absoluteInlinePattern = /(<[^>]*class(?:Name)?=["'][^"']*(?:decorative_|bg_shape_)[^"']*["'][^>]*>)|position:\s*['"]?absolute['"]?\s*[,;]?\s*/gi;
  cleanCode = cleanCode.replace(absoluteInlinePattern, (match) => {
    if (match.startsWith("<")) return match; // decorative 要素タグ全体はそのまま
    return "";
  });
  cleanHtml = cleanHtml.replace(absoluteInlinePattern, (match) => {
    if (match.startsWith("<")) return match;
    return "";
  });

  // Tailwind の absolute クラスを relative に置換（decorative_ / bg_shape_ クラスを含む場合は保持）
  const absoluteClassPattern = /(class(?:Name)?=["'])([^"']*)\babsolute\b([^"']*)(["'])/g;
  function replaceAbsoluteInClass(match, prefix, before, after, suffix) {
    const fullClass = before + "absolute" + after;
    if (fullClass.includes("decorative_") || fullClass.includes("bg_shape_")) {
      return match; // 装飾シェイプは absolute を保持
    }
    return prefix + before + "relative" + after + suffix;
  }
  cleanCode = cleanCode.replace(absoluteClassPattern, replaceAbsoluteInClass);
  cleanHtml = cleanHtml.replace(absoluteClassPattern, replaceAbsoluteInClass);

  // top-[N] / left-[N] / right-[N] / bottom-[N] の座標指定を除去（decorative_ / bg_shape_ 要素は保持）
  const coordClassPattern = /(class(?:Name)?=["'])([^"']*)\b(top|left|right|bottom)-\[[^\]]+\]([^"']*)(["'])/g;
  function replaceCoordInClass(match, prefix, before, _dir, after, suffix) {
    const fullClass = before + after;
    if (fullClass.includes("decorative_") || fullClass.includes("bg_shape_")) {
      return match; // 装飾シェイプは座標指定を保持
    }
    return prefix + before + after + suffix;
  }
  cleanCode = cleanCode.replace(coordClassPattern, replaceCoordInClass);
  cleanHtml = cleanHtml.replace(coordClassPattern, replaceCoordInClass);

  // 空 className の除去
  cleanCode = cleanCode.replace(/className=["']\s*["']/g, "");
  cleanHtml = cleanHtml.replace(/class=["']\s*["']/g, "");

  // 連続スペースの正規化
  cleanCode = cleanCode.replace(/  +/g, " ");
  cleanHtml = cleanHtml.replace(/  +/g, " ");

  return {
    componentCode: cleanCode.trim(),
    previewHtml: cleanHtml.trim(),
  };
}

module.exports = {
  refactorDnaToComponent,
  extractDnaSummary,
  sanitizeComponentOutput,
};
