/**
 * Client-side HTML renderer for OASIS design elements.
 * Provides two rendering modes:
 *  1. renderDesignPreview — master image background + absolute-positioned element overlays (for live editor)
 *  2. renderCloneSection — traditional DOM-tree rendering (for final HTML export)
 */

const VALID_TAGS = new Set([
  "p","a","span","h1","h2","h3","h4","h5","h6","ul","ol","li","img","button",
  "nav","header","footer","section","article","main","aside","div","form",
  "input","textarea","select","figure","figcaption","table","thead","tbody",
  "tr","td","th","dl","dt","dd","label","strong","em","small","blockquote",
  "code","pre","video","picture","svg",
]);

function escapeHtml(text) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────

/** Build full inline CSS from element's extracted styles */
export function buildFullStyles(element) {
  const styles = [];
  const v = element.styles?.visual || {};
  const l = element.styles?.layout || {};
  const t = element.styles?.typography || {};

  // Visual
  if (v.backgroundColor && v.backgroundColor !== "rgba(0, 0, 0, 0)")
    styles.push(`background-color:${v.backgroundColor}`);
  if (v.borderRadius && v.borderRadius !== "0px")
    styles.push(`border-radius:${v.borderRadius}`);
  if (v.border && v.border !== "none" && v.border !== "0px none")
    styles.push(`border:${v.border}`);
  if (v.boxShadow && v.boxShadow !== "none")
    styles.push(`box-shadow:${v.boxShadow}`);
  if (v.opacity && v.opacity !== "1") styles.push(`opacity:${v.opacity}`);
  if (v.overflow && v.overflow !== "visible")
    styles.push(`overflow:${v.overflow}`);

  // Layout
  if (l.display) styles.push(`display:${l.display}`);
  if (l.position && l.position !== "static")
    styles.push(`position:${l.position}`);
  if (l.width && l.width !== "auto") styles.push(`width:${l.width}`);
  if (l.height && l.height !== "auto") styles.push(`height:${l.height}`);
  if (l.margin && l.margin !== "0px") styles.push(`margin:${l.margin}`);
  if (l.padding && l.padding !== "0px") styles.push(`padding:${l.padding}`);
  if (l.flexDirection && l.flexDirection !== "row")
    styles.push(`flex-direction:${l.flexDirection}`);
  if (l.justifyContent) styles.push(`justify-content:${l.justifyContent}`);
  if (l.alignItems) styles.push(`align-items:${l.alignItems}`);
  if (l.gap && l.gap !== "normal" && l.gap !== "0px")
    styles.push(`gap:${l.gap}`);

  // Typography
  if (t.fontFamily) styles.push(`font-family:${t.fontFamily}`);
  if (t.fontSize) styles.push(`font-size:${t.fontSize}`);
  if (t.fontWeight && t.fontWeight !== "400")
    styles.push(`font-weight:${t.fontWeight}`);
  if (t.lineHeight && t.lineHeight !== "normal")
    styles.push(`line-height:${t.lineHeight}`);
  if (t.letterSpacing && t.letterSpacing !== "normal")
    styles.push(`letter-spacing:${t.letterSpacing}`);
  if (t.textAlign && t.textAlign !== "start")
    styles.push(`text-align:${t.textAlign}`);
  if (t.color) styles.push(`color:${t.color}`);

  return styles;
}

// ─────────────────────────────────────────────────────────
// Mode 1: Design Preview (master image + element overlays)
//   Used by the live editor in Step 5
// ─────────────────────────────────────────────────────────

/**
 * Find the root bounding box from an elements array.
 * Returns { rootBB, rootIdx } where rootBB is the largest element's box.
 */
function findRootBB(elements) {
  let rootBB = { x: 0, y: 0, width: 1440, height: 900 };
  let maxArea = 0;
  let rootIdx = -1;

  for (let i = 0; i < elements.length; i++) {
    const bb = elements[i].boundingBox;
    if (!bb || bb.width <= 0 || bb.height <= 0) continue;
    const area = bb.width * bb.height;
    if (area > maxArea) {
      maxArea = area;
      rootBB = bb;
      rootIdx = i;
    }
  }

  return { rootBB, rootIdx };
}

/**
 * Render design preview using master image + absolute-positioned element overlays.
 * Elements are positioned based on their boundingBox relative to the root element.
 *
 * @param {Array} elements - Flat array of extracted elements
 * @param {string} role - Section role (header, fv, section, etc.)
 * @param {string|null} masterImageUrl - URL of the master image (screenshot)
 * @returns {string} HTML string for the section
 */
export function renderDesignPreview(elements, role, masterImageUrl, cropRegion = null) {
  if (!elements || elements.length === 0) return "";

  const tagMap = {
    header: "header",
    footer: "footer",
    nav: "nav",
    section: "section",
    fv: "section",
    cta: "section",
  };
  const outerTag = tagMap[role] || "section";
  const { rootBB, rootIdx } = findRootBB(elements);

  // Reference frame: cropRegion (selected portion) or rootBB (largest element)
  const refBB = cropRegion
    ? { x: cropRegion.x, y: cropRegion.y, width: cropRegion.width, height: cropRegion.height }
    : rootBB;

  let eidCounter = 0;
  const overlayParts = [];

  // Element overlays
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const bb = el.boundingBox;
    if (!bb || bb.width <= 0 || bb.height <= 0) continue;

    // Skip root container when master image covers it
    if (i === rootIdx && masterImageUrl) continue;
    // Skip root container that has no textContent (large empty wrapper)
    if (i === rootIdx && !masterImageUrl && !(el.textContent || "").trim()) {
      const bgStyles = [`position:absolute`, `left:0%`, `top:0%`, `width:100%`, `height:100%`, `z-index:0`];
      const bg = el.styles?.visual?.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)") bgStyles.push(`background-color:${bg}`);
      const borderRadius = el.styles?.visual?.borderRadius;
      if (borderRadius && borderRadius !== "0px") bgStyles.push(`border-radius:${borderRadius}`);
      overlayParts.push(`  <div data-eid="e${eidCounter++}" style="${bgStyles.join(";")}"></div>`);
      continue;
    }

    const eid = `e${eidCounter++}`;
    const tagName = (el.tagName || "div").toLowerCase();
    const tag = VALID_TAGS.has(tagName) ? tagName : "div";

    // Position as percentage of reference frame
    const left = ((bb.x - refBB.x) / refBB.width) * 100;
    const top = ((bb.y - refBB.y) / refBB.height) * 100;
    const width = (bb.width / refBB.width) * 100;
    const height = (bb.height / refBB.height) * 100;

    const styles = [
      `position:absolute`,
      `left:${left.toFixed(3)}%`,
      `top:${top.toFixed(3)}%`,
      `width:${width.toFixed(3)}%`,
      `height:${height.toFixed(3)}%`,
      `z-index:${i + 1}`,
    ];

    // When master image is present: background transparent so image shows through,
    // but text color must be visible so the user can see and edit the overlay text.
    if (masterImageUrl) {
      styles.push(`background:transparent`);
    }

    // Typography (visible in both modes; in master-image mode needed for editable text)
    const t = el.styles?.typography || {};
    if (t.fontFamily) styles.push(`font-family:${t.fontFamily}`);
    if (t.fontSize) styles.push(`font-size:${t.fontSize}`);
    if (t.fontWeight && t.fontWeight !== "400") styles.push(`font-weight:${t.fontWeight}`);
    if (t.lineHeight && t.lineHeight !== "normal") styles.push(`line-height:${t.lineHeight}`);
    if (t.letterSpacing && t.letterSpacing !== "normal") styles.push(`letter-spacing:${t.letterSpacing}`);
    if (t.textAlign && t.textAlign !== "start") styles.push(`text-align:${t.textAlign}`);
    if (t.color) styles.push(`color:${t.color}`);

    // Visual styles (only when no master image)
    const v = el.styles?.visual || {};
    if (!masterImageUrl) {
      if (v.backgroundColor && v.backgroundColor !== "rgba(0, 0, 0, 0)")
        styles.push(`background-color:${v.backgroundColor}`);
      if (v.border && v.border !== "none" && v.border !== "0px none") styles.push(`border:${v.border}`);
      if (v.boxShadow && v.boxShadow !== "none") styles.push(`box-shadow:${v.boxShadow}`);
    }
    if (v.borderRadius && v.borderRadius !== "0px") styles.push(`border-radius:${v.borderRadius}`);

    // Padding
    const l = el.styles?.layout || {};
    if (l.padding && l.padding !== "0px") styles.push(`padding:${l.padding}`);

    // Overflow
    if (l.overflow && l.overflow !== "visible") styles.push(`overflow:${l.overflow}`);

    const styleAttr = ` style="${styles.join(";")}"`;
    const text = escapeHtml(el.textContent || "");

    if (tag === "img") {
      const src = el.outerHTML?.match(/src="([^"]+)"/)?.[1] || "";
      const alt = el.outerHTML?.match(/alt="([^"]+)"/)?.[1] || "";
      overlayParts.push(`  <img data-eid="${eid}" src="${src}" alt="${alt}"${styleAttr} />`);
    } else {
      overlayParts.push(`  <${tag} data-eid="${eid}"${styleAttr}>${text}</${tag}>`);
    }
  }

  if (masterImageUrl && cropRegion) {
    // ── Cropped master image mode ──
    // Shows only the selected region of the full-page master image via CSS clipping
    const aspectPct = (cropRegion.height / cropRegion.width) * 100;
    const imgScalePct = (cropRegion.pageWidth / cropRegion.width) * 100;
    const imgLeftPct = -((cropRegion.x - cropRegion.pageX) / cropRegion.width) * 100;
    const imgTopPct = -((cropRegion.y - cropRegion.pageY) / cropRegion.height) * 100;

    return [
      `<${outerTag} style="position:relative;width:100%;padding-bottom:${aspectPct.toFixed(4)}%;overflow:hidden;">`,
      `  <img src="${masterImageUrl}" style="position:absolute;max-width:none;width:${imgScalePct.toFixed(2)}%;left:${imgLeftPct.toFixed(2)}%;top:${imgTopPct.toFixed(2)}%;pointer-events:none;" draggable="false" />`,
      `  <div style="position:absolute;top:0;left:0;right:0;bottom:0;">`,
      ...overlayParts,
      `  </div>`,
      `</${outerTag}>`,
    ].join("\n");
  } else if (masterImageUrl) {
    // ── Full master image mode (no element filtering) ──
    return [
      `<${outerTag} style="position:relative;width:100%;line-height:0;">`,
      `  <img src="${masterImageUrl}" style="width:100%;display:block;pointer-events:none;" draggable="false" />`,
      `  <div style="position:absolute;top:0;left:0;right:0;bottom:0;">`,
      ...overlayParts,
      `  </div>`,
      `</${outerTag}>`,
    ].join("\n");
  } else {
    // ── No master image mode ──
    const aspectRatio = (refBB.height / refBB.width) * 100;
    const rootStyles = [
      `position:relative`,
      `width:100%`,
      `padding-bottom:${aspectRatio.toFixed(4)}%`,
      `overflow:hidden`,
    ];
    if (rootIdx >= 0) {
      const bg = elements[rootIdx]?.styles?.visual?.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)") rootStyles.push(`background-color:${bg}`);
    }
    return `<${outerTag} style="${rootStyles.join(";")}">\n${overlayParts.join("\n")}\n</${outerTag}>`;
  }
}

// ─────────────────────────────────────────────────────────
// Mode 2: Clone rendering (traditional DOM-tree)
//   Used by server-side and final HTML export
// ─────────────────────────────────────────────────────────

/** Render a single element recursively with data-eid annotations */
export function renderCloneElement(
  element,
  depth = 0,
  maxDepth = 6,
  eidCounter = { value: 0 }
) {
  if (depth > maxDepth || !element) return "";
  const indent = "  ".repeat(depth);
  const styles = buildFullStyles(element);
  if (depth === 0 && element.boundingBox?.width > 0) styles.push("width:100%");
  const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";

  const tagName = (element.tagName || "div").toLowerCase();
  const tag = VALID_TAGS.has(tagName) ? tagName : "div";
  const eid = eidCounter.value++;
  const eidAttr = ` data-eid="e${eid}"`;

  if (tag === "img") {
    const src = element.outerHTML?.match(/src="([^"]+)"/)?.[1] || "";
    const alt = element.outerHTML?.match(/alt="([^"]+)"/)?.[1] || "";
    return `${indent}<img src="${src}" alt="${alt}"${styleAttr}${eidAttr} />`;
  }

  if (element.children && element.children.length > 0) {
    const childrenHtml = element.children
      .map((c) => renderCloneElement(c, depth + 1, maxDepth, eidCounter))
      .filter(Boolean)
      .join("\n");
    return `${indent}<${tag}${styleAttr}${eidAttr}>\n${childrenHtml}\n${indent}</${tag}>`;
  }

  const text = escapeHtml(element.textContent);
  return `${indent}<${tag}${styleAttr}${eidAttr}>${text}</${tag}>`;
}

/** Render a complete section from source elements (DOM-tree mode) */
export function renderCloneSection(sourceElements, role) {
  const tagMap = {
    header: "header",
    footer: "footer",
    nav: "nav",
    section: "section",
    fv: "section",
    cta: "section",
  };
  const outerTag = tagMap[role] || "section";
  const eidCounter = { value: 0 };

  const innerParts = sourceElements.map((el) => {
    const styles = buildFullStyles(el);
    styles.push("width:100%");
    if (el.boundingBox?.height > 0)
      styles.push(`min-height:${el.boundingBox.height}px`);
    const styleAttr = styles.length > 0 ? ` style="${styles.join(";")}"` : "";
    const tag = (el.tagName || "div").toLowerCase();
    const eid = eidCounter.value++;
    const eidAttr = ` data-eid="e${eid}"`;

    let childrenHtml = "";
    if (el.children && el.children.length > 0) {
      childrenHtml = el.children
        .map((c) => renderCloneElement(c, 1, 6, eidCounter))
        .filter(Boolean)
        .join("\n");
    } else {
      const text = escapeHtml(el.textContent);
      childrenHtml = text ? `  ${text}` : "";
    }

    return `<${tag}${styleAttr}${eidAttr}>\n${childrenHtml}\n</${tag}>`;
  });

  if (
    sourceElements.length === 1 &&
    [
      "header",
      "footer",
      "nav",
      "section",
      "article",
      "main",
    ].includes((sourceElements[0].tagName || "").toLowerCase())
  ) {
    return innerParts[0];
  }
  return `<${outerTag} style="width:100%">\n${innerParts.join("\n")}\n</${outerTag}>`;
}

// ─────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────

/** Extract project-wide dominant styles from all referenced designs */
export function extractProjectStyles(sections, dnaLibrary) {
  const bgColors = [];
  const textColors = [];
  const fonts = new Set();

  for (const section of sections) {
    if (!section.designRef?.dnaId) continue;
    const dna = dnaLibrary.find((d) => d.id === section.designRef.dnaId);
    if (!dna) continue;

    let elements = dna.elements || [];
    if (
      section.designRef.deviceFrame &&
      dna.deviceFrames?.[section.designRef.deviceFrame]
    ) {
      elements =
        dna.deviceFrames[section.designRef.deviceFrame].elements || [];
    }
    // Auto-select PC frame if no deviceFrame
    if (elements.length === 0 && dna.deviceFrames?.pc?.elements?.length > 0) {
      elements = dna.deviceFrames.pc.elements;
    }

    for (const el of elements) {
      const bg = el.styles?.visual?.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)") bgColors.push(bg);
      const color = el.styles?.typography?.color;
      if (color) textColors.push(color);
      const font = el.styles?.typography?.fontFamily;
      if (font) fonts.add(font);
    }
  }

  return {
    baseColor: bgColors[0] || null,
    mainFont: [...fonts][0] || null,
    bgColors: [...new Set(bgColors)],
    textColors: [...new Set(textColors)],
  };
}

/** Build the iframe interaction script (injected into preview document) */
export function getIframeScript() {
  return `
<script>
(function() {
  var selectedEl = null;

  function isEditable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (['html','body','head','script','style','link','meta'].indexOf(tag) >= 0) return false;
    if (el.dataset && el.dataset.sectionWrapper !== undefined) return false;
    if (!el.dataset || el.dataset.eid === undefined) return false;
    return true;
  }

  function getElementType(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'img') return 'image';
    if (tag === 'svg' || tag === 'video') return 'media';
    var textTags = ['h1','h2','h3','h4','h5','h6','p','span','a','label','li',
      'td','th','dt','dd','figcaption','blockquote','em','strong','small',
      'code','pre','button'];
    if (textTags.indexOf(tag) >= 0) return 'text';
    if (el.children.length === 0 && el.textContent.trim()) return 'text';
    return 'container';
  }

  function findSectionIndex(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.dataset && node.dataset.sectionIdx !== undefined) {
        return parseInt(node.dataset.sectionIdx);
      }
      node = node.parentElement;
    }
    return -1;
  }

  function deselectCurrent() {
    if (selectedEl) {
      selectedEl.classList.remove('oasis-selected');
      if (selectedEl.contentEditable === 'true') {
        selectedEl.contentEditable = 'false';
      }
      selectedEl = null;
    }
  }

  function notifySectionUpdate(el) {
    var sw = el;
    while (sw && sw !== document.body) {
      if (sw.dataset && sw.dataset.sectionIdx !== undefined) break;
      sw = sw.parentElement;
    }
    if (sw && sw.dataset.sectionIdx !== undefined) {
      var idx = parseInt(sw.dataset.sectionIdx);
      window.parent.postMessage({
        type: 'section-updated',
        sectionIndex: idx,
        html: sw.innerHTML
      }, '*');
    }
  }

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body && !isEditable(el)) {
      el = el.parentElement;
    }
    if (!el || !isEditable(el)) {
      deselectCurrent();
      window.parent.postMessage({ type: 'element-deselected' }, '*');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    deselectCurrent();
    selectedEl = el;
    el.classList.add('oasis-selected');

    var rect = el.getBoundingClientRect();
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    window.parent.postMessage({
      type: 'element-selected',
      eid: el.dataset.eid || '',
      elementType: getElementType(el),
      text: el.textContent || '',
      tagName: el.tagName.toLowerCase(),
      src: el.src || '',
      alt: el.alt || '',
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      iframeScrollTop: scrollTop,
      sectionIndex: findSectionIndex(el)
    }, '*');
  }, true);

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    switch (e.data.type) {
      case 'enable-edit':
        if (selectedEl) {
          selectedEl.contentEditable = 'true';
          selectedEl.focus();
          var range = document.createRange();
          range.selectNodeContents(selectedEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        break;
      case 'disable-edit':
        if (selectedEl && selectedEl.contentEditable === 'true') {
          selectedEl.contentEditable = 'false';
          notifySectionUpdate(selectedEl);
        }
        break;
      case 'replace-text':
        if (selectedEl) {
          selectedEl.textContent = e.data.text;
          notifySectionUpdate(selectedEl);
        }
        break;
      case 'replace-image':
        var img = null;
        if (selectedEl && selectedEl.tagName === 'IMG') img = selectedEl;
        else if (selectedEl) img = selectedEl.querySelector('img');
        if (img) {
          img.src = e.data.src;
          if (e.data.alt) img.alt = e.data.alt;
          notifySectionUpdate(img);
        }
        break;
      case 'delete-element':
        if (selectedEl) {
          var parent = selectedEl.parentElement;
          selectedEl.remove();
          selectedEl = null;
          if (parent) notifySectionUpdate(parent);
          window.parent.postMessage({ type: 'element-deselected' }, '*');
        }
        break;
      case 'deselect':
        deselectCurrent();
        break;
      case 'get-section-html':
        var sidx = e.data.sectionIndex;
        var wrapper = document.querySelector('[data-section-idx="' + sidx + '"]');
        if (wrapper) {
          window.parent.postMessage({
            type: 'section-html-response',
            sectionIndex: sidx,
            html: wrapper.innerHTML
          }, '*');
        }
        break;
    }
  });

  // Do NOT call notifySectionUpdate on every 'input' — it would update parent state
  // and cause the entire iframe srcdoc to be replaced, losing focus and breaking editing.
  // We only send section-updated on focusout / replace-text / replace-image / delete-element.

  document.addEventListener('focusout', function(e) {
    if (e.target === selectedEl && selectedEl && selectedEl.contentEditable === 'true') {
      selectedEl.contentEditable = 'false';
      notifySectionUpdate(selectedEl);
      window.parent.postMessage({ type: 'edit-complete' }, '*');
    }
  });
})();
<\/script>`;
}

/** Build the full preview HTML document */
export function buildPreviewDocument(sectionsHtml, dnaCssBlock = "") {
  return `<!DOCTYPE html>
<html><head>
  <base href="/" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>tailwind.config={corePlugins:{preflight:false}}<\/script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; }
    img { max-width: 100%; height: auto; }
    [data-eid] { cursor: pointer; }
    [data-eid]:hover { outline: 2px solid rgba(59,130,246,0.5); outline-offset: -1px; z-index: 9000 !important; }
    [data-eid].oasis-selected { outline: 3px solid #7c3aed !important; outline-offset: -1px; background-color: rgba(124,58,237,0.08) !important; z-index: 9001 !important; }
    [data-eid][contenteditable="true"] { outline: 3px solid #f59e0b !important; outline-offset: -1px; z-index: 9002 !important; color: inherit !important; background: rgba(255,255,255,0.92) !important; }
    .oasis-no-ref-placeholder {
      min-height: 200px; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: linear-gradient(135deg, #f8f4ee 0%, #f0e6d6 100%);
      border: 2px dashed #d4a76a; border-radius: 12px; margin: 8px;
      color: #8A7E6B; font-size: 14px;
    }
    ${dnaCssBlock}
  </style>
</head><body>
${sectionsHtml}
${getIframeScript()}
</body></html>`;
}
