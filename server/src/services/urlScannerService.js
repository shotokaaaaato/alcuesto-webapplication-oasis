const { getBrowser } = require("./dnaExtractor");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

// ── ビューポート定義 ──
const VIEWPORTS = {
  sp: { width: 375, height: 812, label: "SP (375px)" },
  tablet: { width: 768, height: 1024, label: "Tablet (768px)" },
  pc: { width: 1440, height: 900, label: "PC (1440px)" },
};

// ── HTML タグ → Figma ノードタイプ ──
const TAG_TO_FIGMA_TYPE = {
  header: "FRAME",
  footer: "FRAME",
  nav: "FRAME",
  main: "FRAME",
  section: "FRAME",
  article: "FRAME",
  aside: "FRAME",
  div: "FRAME",
  form: "FRAME",
  fieldset: "FRAME",
  ul: "FRAME",
  ol: "FRAME",
  dl: "FRAME",
  table: "FRAME",
  thead: "FRAME",
  tbody: "FRAME",
  tr: "FRAME",
  button: "FRAME",
  input: "FRAME",
  textarea: "FRAME",
  select: "FRAME",
  details: "FRAME",
  dialog: "FRAME",
  figure: "FRAME",
  figcaption: "TEXT",
  h1: "TEXT",
  h2: "TEXT",
  h3: "TEXT",
  h4: "TEXT",
  h5: "TEXT",
  h6: "TEXT",
  p: "TEXT",
  span: "TEXT",
  a: "TEXT",
  label: "TEXT",
  li: "TEXT",
  td: "TEXT",
  th: "TEXT",
  dt: "TEXT",
  dd: "TEXT",
  em: "TEXT",
  strong: "TEXT",
  small: "TEXT",
  blockquote: "TEXT",
  cite: "TEXT",
  code: "TEXT",
  pre: "TEXT",
  time: "TEXT",
  img: "RECTANGLE",
  picture: "RECTANGLE",
  video: "RECTANGLE",
  canvas: "RECTANGLE",
  svg: "VECTOR",
};

// 抽出対象スタイルプロパティ (dnaExtractor.js と同一)
const TYPOGRAPHY_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "color",
];

const LAYOUT_PROPS = [
  "display",
  "position",
  "width",
  "height",
  "margin",
  "padding",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
];

const VISUAL_PROPS = [
  "backgroundColor",
  "background",
  "backgroundImage",
  "borderRadius",
  "border",
  "boxShadow",
  "opacity",
  "overflow",
];

const IMAGES_DIR = path.join(__dirname, "../../data/images");

// 画像ディレクトリ確保
function ensureImagesDir() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * ページ全体を自動スクロールして IntersectionObserver / scroll-trigger アニメーションを発火させる
 * - ビューポートの半分ずつ段階的にスクロール (IntersectionObserver threshold 対応)
 * - 各ステップで 150ms 待機、動的コンテンツ用に長めの待機を挟む
 * - 最下部到達後にアニメーション完了を 800ms 待ち、先頭に戻る
 * - 1 ビューポートあたり最大 10 秒のタイムアウト
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    const TIMEOUT = 10000; // 10 秒上限
    const start = Date.now();
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    // ステップ: ビューポートの 50% (IntersectionObserver の threshold=0.1 でも確実に発火)
    const step = Math.max(Math.floor(window.innerHeight * 0.5), 300);
    let currentMax = document.documentElement.scrollHeight;
    let pos = 0;

    // Phase 1: 下方向に段階スクロール
    while (pos < currentMax && (Date.now() - start) < TIMEOUT) {
      window.scrollTo({ top: pos, behavior: "instant" });
      await delay(150);

      pos += step;

      // 動的にコンテンツが追加されるケース (lazy load 等) に対応
      const newMax = document.documentElement.scrollHeight;
      if (newMax > currentMax) {
        // 無限スクロール対策: 元の 2 倍以上に伸びたら打ち切り
        if (newMax > currentMax * 2) break;
        currentMax = newMax;
      }
    }

    // Phase 2: 確実に最下部へ到達
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await delay(400);

    // Phase 3: 逆方向に高速スクロール (一部ライブラリは scroll-up でもアニメーション発火)
    const quickStep = Math.max(window.innerHeight, 800);
    let backPos = document.documentElement.scrollHeight;
    while (backPos > 0 && (Date.now() - start) < TIMEOUT) {
      backPos -= quickStep;
      window.scrollTo({ top: Math.max(backPos, 0), behavior: "instant" });
      await delay(80);
    }

    // Phase 4: 先頭に戻してアニメーション安定待ち
    window.scrollTo({ top: 0, behavior: "instant" });
    await delay(500);
  });
}

/**
 * 単一ビューポートでページをスキャン
 * @param {string} url - 対象 URL
 * @param {string} viewportKey - "sp" | "tablet" | "pc"
 * @returns {Promise<{ elements: object[], masterImage: object, viewport: object }>}
 */
async function scanAtViewport(url, viewportKey) {
  const vp = VIEWPORTS[viewportKey];
  if (!vp) throw new Error(`無効なビューポート: ${viewportKey}`);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // ── 0. スクロールスルー: アニメーション要素を表示させる ──
    await autoScroll(page);

    // ── 0.5. 強制表示: アニメーション未完了の要素を CSS で可視化 ──
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "__oasis_force_reveal";
      style.textContent = `
        *, *::before, *::after {
          opacity: 1 !important;
          visibility: visible !important;
          transform: none !important;
          clip-path: none !important;
          -webkit-clip-path: none !important;
        }
      `;
      document.head.appendChild(style);
    });
    // アニメーション CSS 適用を少し待つ
    await new Promise((r) => setTimeout(r, 300));

    // ── 1. フルページスクリーンショット ──
    ensureImagesDir();
    const filename = `${randomUUID()}.png`;
    const screenshotPath = path.join(IMAGES_DIR, filename);

    // スクリーンショット高さ上限 15000px
    const pageHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    const clipHeight = Math.min(pageHeight, 15000);

    await page.screenshot({
      path: screenshotPath,
      fullPage: clipHeight <= 15000,
      clip:
        clipHeight >= 15000
          ? { x: 0, y: 0, width: vp.width, height: 15000 }
          : undefined,
    });

    const masterImage = {
      filename,
      width: vp.width,
      height: Math.min(pageHeight, 15000),
      scale: 1,
    };

    // ── 2. 階層構造 DOM 抽出 ──
    const elements = await page.evaluate(
      (typoProps, layoutProps, visualProps, tagMap) => {
        let totalCount = 0;
        const MAX_ELEMENTS = 500;
        const MAX_DEPTH = 6;
        const MAX_CHILDREN = 20;

        const SKIP_TAGS = new Set([
          "script","style","noscript","template","link","meta","br","hr","wbr",
        ]);

        // テキストノード判定
        const TEXT_TAGS = new Set([
          "h1","h2","h3","h4","h5","h6","p","span","a","label",
          "li","td","th","dt","dd","em","strong","small","blockquote",
          "cite","code","pre","time","figcaption",
        ]);

        // 展開すべき大コンテナ (中の子をセクション単位で取り出す)
        const UNWRAP_TAGS = new Set(["main","article"]);

        // 可視判定
        function isVisible(el) {
          if (!el || !el.tagName) return false;
          const tag = el.tagName.toLowerCase();
          if (SKIP_TAGS.has(tag)) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return false;
          const computed = window.getComputedStyle(el);
          if (computed.display === "none" || computed.visibility === "hidden") return false;
          return true;
        }

        // スタイル抽出
        function pickStyles(computed, props) {
          const result = {};
          for (const prop of props) {
            result[prop] = computed.getPropertyValue(
              prop.replace(/([A-Z])/g, "-$1").toLowerCase()
            );
          }
          return result;
        }

        // CSS セレクタ構築
        function buildSelector(el) {
          if (el.id) return `#${el.id}`;
          const parts = [];
          let cur = el;
          while (cur && cur !== document.body && parts.length < 4) {
            let part = cur.tagName.toLowerCase();
            if (cur.className && typeof cur.className === "string") {
              const cls = cur.className.trim().split(/\s+/).slice(0, 2);
              if (cls.length && cls[0]) part += "." + cls.join(".");
            }
            parts.unshift(part);
            cur = cur.parentElement;
          }
          return parts.join(" > ");
        }

        // Figma レイヤー名構築
        function buildNodeName(el) {
          const tag = el.tagName.toLowerCase();
          if (el.className && typeof el.className === "string") {
            const cls = el.className.trim().split(/\s+/).slice(0, 2).join(".");
            if (cls) return `${tag}.${cls}`;
          }
          if (el.id) return `${tag}#${el.id}`;
          return tag;
        }

        // 再帰的階層抽出
        function extractNode(el, depth) {
          if (!el || totalCount >= MAX_ELEMENTS || depth > MAX_DEPTH) return null;

          const tag = el.tagName.toLowerCase();
          if (SKIP_TAGS.has(tag)) return null;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return null;

          const computed = window.getComputedStyle(el);
          if (computed.display === "none" || computed.visibility === "hidden") return null;

          totalCount++;

          const isText = TEXT_TAGS.has(tag);
          const figmaNodeType = tagMap[tag] || "FRAME";

          const node = {
            tagName: tag,
            figmaNodeType: figmaNodeType,
            figmaNodeName: buildNodeName(el),
            selector: buildSelector(el),
            textContent: isText ? (el.textContent || "").trim().slice(0, 200) : "",
            outerHTML: el.outerHTML.slice(0, 50000),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            styles: {
              typography: pickStyles(computed, typoProps),
              layout: pickStyles(computed, layoutProps),
              visual: pickStyles(computed, visualProps),
            },
            children: [],
          };

          // 子要素を再帰抽出
          if (depth < MAX_DEPTH && totalCount < MAX_ELEMENTS) {
            const kids = el.children;
            for (let i = 0; i < kids.length && i < MAX_CHILDREN; i++) {
              if (totalCount >= MAX_ELEMENTS) break;
              const child = extractNode(kids[i], depth + 1);
              if (child) node.children.push(child);
            }
          }

          return node;
        }

        // ── セクション分割戦略 ──
        // Step 1: body から単一子ラッパーを再帰展開して「コンテンツルート」を見つける
        function unwrapToContent(el) {
          const visible = Array.from(el.children).filter(isVisible);
          if (visible.length === 1) {
            const tag = visible[0].tagName.toLowerCase();
            // 単一 div/main ラッパーなら展開して中へ
            if (tag === "div" || tag === "main") {
              return unwrapToContent(visible[0]);
            }
          }
          return el;
        }

        const contentRoot = unwrapToContent(document.body);

        // Step 2: コンテンツルートの直接子を収集
        //   - <main>, <article> → その子を展開してセクション単位に
        //   - <header>, <footer>, <nav>, <section>, <div> → そのまま 1 セクション
        const sectionElements = [];
        const directChildren = Array.from(contentRoot.children).filter(isVisible);

        for (const child of directChildren) {
          if (totalCount >= MAX_ELEMENTS) break;
          const tag = child.tagName.toLowerCase();

          if (UNWRAP_TAGS.has(tag)) {
            // <main> / <article> の中身をセクション単位で展開
            const innerChildren = Array.from(child.children).filter(isVisible);
            if (innerChildren.length > 0) {
              for (const inner of innerChildren) {
                sectionElements.push(inner);
              }
            } else {
              // 子がない main/article はそのまま
              sectionElements.push(child);
            }
          } else {
            sectionElements.push(child);
          }
        }

        // Step 3: 各セクション要素を extractNode で階層抽出
        const results = [];
        for (const el of sectionElements) {
          if (totalCount >= MAX_ELEMENTS) break;
          const tree = extractNode(el, 0);
          if (tree) results.push(tree);
        }

        // フォールバック: 結果が 0 件なら body 直下を浅く抽出
        if (results.length === 0) {
          const bodyChildren = Array.from(document.body.children).filter(isVisible);
          for (const child of bodyChildren) {
            if (totalCount >= MAX_ELEMENTS) break;
            const tree = extractNode(child, 0);
            if (tree) results.push(tree);
          }
        }

        return results;
      },
      TYPOGRAPHY_PROPS,
      LAYOUT_PROPS,
      VISUAL_PROPS,
      TAG_TO_FIGMA_TYPE
    );

    // ── 3. ボディ背景色を取得（セクション背景の継承フォールバック用） ──
    const bodyBackground = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const bodyCs = window.getComputedStyle(body);
      const htmlCs = window.getComputedStyle(html);
      return {
        backgroundColor: bodyCs.backgroundColor !== "rgba(0, 0, 0, 0)" ? bodyCs.backgroundColor : htmlCs.backgroundColor,
        backgroundImage: bodyCs.backgroundImage !== "none" ? bodyCs.backgroundImage : htmlCs.backgroundImage,
        background: bodyCs.background || htmlCs.background || null,
      };
    });

    return { elements, masterImage, viewport: vp, bodyBackground };
  } finally {
    await page.close();
  }
}

/**
 * URL を複数ビューポートでスキャン (直列実行)
 * @param {string} url - 対象 URL
 * @param {string[]} viewportKeys - ["sp", "tablet", "pc"]
 * @returns {Promise<{ [key: string]: { elements, masterImage, viewport } }>}
 */
async function scanUrl(url, viewportKeys = ["sp", "tablet", "pc"]) {
  const results = {};
  // メモリ節約のため直列実行
  for (const key of viewportKeys) {
    results[key] = await scanAtViewport(url, key);
  }
  return results;
}

module.exports = { scanUrl, scanAtViewport, VIEWPORTS };
