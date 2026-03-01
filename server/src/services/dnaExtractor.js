const puppeteer = require("puppeteer");
const { randomUUID } = require("crypto");

/**
 * Oasis デザイン Extractor
 * 指定URLの要素から computedStyle を抽出し、デザインデータとして返す
 */

// 抽出対象のスタイルプロパティ定義
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
  "borderRadius",
  "border",
  "boxShadow",
  "opacity",
  "overflow",
];

let browser = null;

/** Puppeteer ブラウザインスタンスを取得（再利用） */
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browser;
}

/**
 * 単一要素の computedStyle を抽出
 * @param {string} url - 対象ページURL
 * @param {string} selector - CSSセレクタ
 * @param {{ depth?: number }} options - 抽出オプション
 * @returns {Promise<object>} デザインデータ
 */
async function extractDNA(url, selector, options = {}) {
  const { depth = 0 } = options;
  const maxDepth = Math.min(depth, 3); // 最大3階層まで

  const instance = await getBrowser();
  const page = await instance.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const dna = await page.evaluate(
      (sel, typoProps, layoutProps, visualProps, maxD) => {
        function extractElement(el, currentDepth) {
          if (!el) return null;

          const computed = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          // スタイル抽出ヘルパー
          function pickStyles(props) {
            const result = {};
            for (const prop of props) {
              result[prop] = computed.getPropertyValue(
                prop.replace(/([A-Z])/g, "-$1").toLowerCase()
              );
            }
            return result;
          }

          const data = {
            tagName: el.tagName.toLowerCase(),
            selector: buildSelector(el),
            textContent: (el.textContent || "").trim().slice(0, 200),
            outerHTML: el.outerHTML.slice(0, 50000),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            styles: {
              typography: pickStyles(typoProps),
              layout: pickStyles(layoutProps),
              visual: pickStyles(visualProps),
            },
            children: [],
          };

          // 再帰的に子要素を抽出
          if (currentDepth < maxD) {
            const kids = el.children;
            for (let i = 0; i < kids.length && i < 10; i++) {
              const child = extractElement(kids[i], currentDepth + 1);
              if (child) data.children.push(child);
            }
          }

          return data;
        }

        // 一意セレクタを構築
        function buildSelector(el) {
          if (el.id) return `#${el.id}`;
          const parts = [];
          let current = el;
          while (current && current !== document.body) {
            let part = current.tagName.toLowerCase();
            if (current.className && typeof current.className === "string") {
              const cls = current.className.trim().split(/\s+/).slice(0, 2);
              if (cls.length) part += "." + cls.join(".");
            }
            parts.unshift(part);
            current = current.parentElement;
          }
          return parts.join(" > ");
        }

        const target = document.querySelector(sel);
        if (!target) return null;
        return extractElement(target, 0);
      },
      selector,
      TYPOGRAPHY_PROPS,
      LAYOUT_PROPS,
      VISUAL_PROPS,
      maxDepth
    );

    if (!dna) {
      throw new Error(`セレクタ "${selector}" に一致する要素が見つかりません`);
    }

    return {
      id: randomUUID(),
      url,
      ...dna,
      extractedAt: new Date().toISOString(),
    };
  } finally {
    await page.close();
  }
}

/**
 * ページ全体の主要要素を自動検出して抽出
 * @param {string} url - 対象ページURL
 * @returns {Promise<object[]>} デザインデータの配列
 */
async function extractPageDNA(url) {
  const instance = await getBrowser();
  const page = await instance.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const selectors = await page.evaluate(() => {
      // ページの主要構造要素を自動検出
      const targets = [
        "header",
        "nav",
        "main",
        "section",
        "article",
        "footer",
        "h1",
        "h2",
        "h3",
        '[class*="hero"]',
        '[class*="card"]',
        '[class*="btn"]',
        '[class*="button"]',
      ];
      const found = [];
      for (const sel of targets) {
        const el = document.querySelector(sel);
        if (el) found.push(sel);
      }
      return found.length > 0 ? found : ["body"];
    });

    const results = [];
    for (const selector of selectors) {
      try {
        // 各要素を個別ページで抽出する代わりに、同ページ内で処理
        const dna = await page.evaluate(
          (sel, typoProps, layoutProps, visualProps) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const computed = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            function pickStyles(props) {
              const result = {};
              for (const prop of props) {
                result[prop] = computed.getPropertyValue(
                  prop.replace(/([A-Z])/g, "-$1").toLowerCase()
                );
              }
              return result;
            }

            return {
              tagName: el.tagName.toLowerCase(),
              selector: sel,
              textContent: (el.textContent || "").trim().slice(0, 200),
              outerHTML: el.outerHTML.slice(0, 50000),
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              styles: {
                typography: pickStyles(typoProps),
                layout: pickStyles(layoutProps),
                visual: pickStyles(visualProps),
              },
              children: [],
            };
          },
          selector,
          TYPOGRAPHY_PROPS,
          LAYOUT_PROPS,
          VISUAL_PROPS
        );

        if (dna) {
          results.push({
            id: randomUUID(),
            url,
            ...dna,
            extractedAt: new Date().toISOString(),
          });
        }
      } catch {
        // 個別要素の失敗はスキップ
      }
    }

    return results;
  } finally {
    await page.close();
  }
}

/** ブラウザを安全に終了 */
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

module.exports = { extractDNA, extractPageDNA, closeBrowser };
