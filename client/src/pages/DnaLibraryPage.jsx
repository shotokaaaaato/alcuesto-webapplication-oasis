import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useApiKeys } from "../hooks/useApiKeys";

/** rgb(r,g,b) / rgba(r,g,b,a) → { r, g, b } (0-255) */
function parseRgb(str) {
  if (!str || typeof str !== "string") return null;
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

/** { r, g, b } → hue (0-359) or -1 for achromatic */
function rgbToHue({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  if (d === 0) return -1;
  const s = d / max;
  if (s < 0.08) return -1;
  let h;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}

/** デザイン要素からユニークな色を抽出 */
function extractColors(elements) {
  if (!elements) return [];
  const seen = new Set();
  const colors = [];
  for (const el of elements) {
    const bg = el.styles?.visual?.backgroundColor;
    const fg = el.styles?.typography?.color;
    for (const c of [bg, fg]) {
      if (!c || seen.has(c)) continue;
      if (c.includes("rgba") && c.match(/,\s*0\s*\)/)) continue;
      if (c === "rgba(0, 0, 0, 0)") continue;
      seen.add(c);
      colors.push(c);
    }
  }
  return colors;
}

/** デザイン要素からユニークなフォントを抽出 */
function extractFonts(elements) {
  if (!elements) return [];
  const seen = new Set();
  const fonts = [];
  for (const el of elements) {
    const ff = el.styles?.typography?.fontFamily;
    if (ff && !seen.has(ff)) {
      seen.add(ff);
      fonts.push(ff);
    }
  }
  return fonts;
}

/** 色リストからトーンを判定 */
function detectColorTone(colors) {
  const hues = colors.map(parseRgb).filter(Boolean).map(rgbToHue).filter((h) => h >= 0);
  if (hues.length === 0) return "mono";
  const warm = hues.filter((h) => h <= 60 || h >= 330).length;
  const cool = hues.filter((h) => h > 60 && h < 330).length;
  if (warm > 0 && cool > 0 && hues.length >= 4) return "colorful";
  if (warm >= cool) return "warm";
  return "cool";
}

/** フォントリストから書体タイプを検出 */
function detectFontType(fonts) {
  if (!fonts || fonts.length === 0) return "other";
  const joined = fonts.join(" ").toLowerCase();
  const hasSerif =
    (joined.includes("serif") && !joined.includes("sans-serif")) ||
    joined.includes("mincho") || joined.includes("明朝");
  const hasSans =
    joined.includes("sans-serif") || joined.includes("sans") ||
    joined.includes("gothic") || joined.includes("ゴシック");
  if (hasSerif && !hasSans) return "serif";
  if (hasSans && !hasSerif) return "sans";
  if (hasSerif && hasSans) return "mixed";
  return "other";
}

const COLOR_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "warm", label: "暖色系" },
  { value: "cool", label: "寒色系" },
  { value: "mono", label: "モノクロ" },
  { value: "colorful", label: "カラフル" },
];

const FONT_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "sans", label: "ゴシック体" },
  { value: "serif", label: "明朝体" },
  { value: "mixed", label: "ミックス" },
];

// Google Fonts で利用可能な日本語フォント（よく使われるもの）
const GOOGLE_FONTS = new Set([
  "noto sans jp", "noto serif jp", "m plus 1p", "m plus rounded 1c",
  "zen kaku gothic new", "zen maru gothic", "zen old mincho", "kosugi maru", "kosugi",
  "sawarabi gothic", "sawarabi mincho", "shippori mincho", "dela gothic one",
  "hachi maru pop", "klee one", "reggae one", "rocknroll one", "stick",
  "train one", "yomogi", "yusei magic", "potta one", "rampart one",
  "inter", "roboto", "open sans", "montserrat", "poppins", "lato", "raleway",
  "oswald", "source sans pro", "source sans 3", "nunito", "nunito sans",
  "playfair display", "merriweather", "pt sans", "pt serif", "ubuntu",
  "work sans", "fira sans", "dm sans", "lexend", "lexend zetta",
]);

// CSS 汎用フォント名
const GENERIC_CSS_FONTS = new Set([
  "sans-serif", "serif", "monospace", "cursive", "fantasy",
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
]);

/** フォント名が Google Fonts で利用可能か判定 */
function isGoogleFont(fontFamily) {
  if (!fontFamily) return true;
  const primary = fontFamily.split(",")[0].trim().replace(/['"]/g, "").toLowerCase();
  if (GENERIC_CSS_FONTS.has(primary)) return true;
  return GOOGLE_FONTS.has(primary);
}

/** デザイン要素をバウンディングボックス基準で絶対配置HTMLへ変換 */
function buildPreviewFromElements(elements) {
  if (!elements || elements.length === 0) return { html: "", width: 800, height: 600 };
  // ルート要素（最大サイズ）を基準キャンバスとして使用
  let rootEl = null;
  let rootArea = 0;
  for (const el of elements) {
    const bb = el.boundingBox;
    if (bb && bb.width > 0 && bb.height > 0) {
      const area = bb.width * bb.height;
      if (area > rootArea) { rootArea = area; rootEl = el; }
    }
  }
  // ルートのバウンディングボックスを基準にオフセット計算
  const rootBB = rootEl?.boundingBox || { x: 0, y: 0, width: 800, height: 600 };
  const originX = rootBB.x;
  const originY = rootBB.y;
  const canvasW = rootBB.width;
  const canvasH = rootBB.height;

  const parts = elements.map((el) => {
    const bb = el.boundingBox;
    if (!bb || bb.width <= 0 || bb.height <= 0) return "";
    // ルート範囲外の要素はスキップ
    if (bb.x + bb.width <= originX || bb.x >= originX + canvasW) return "";
    if (bb.y + bb.height <= originY || bb.y >= originY + canvasH) return "";
    const s = [];
    s.push("position:absolute");
    s.push(`left:${bb.x - originX}px`);
    s.push(`top:${bb.y - originY}px`);
    s.push(`width:${bb.width}px`);
    s.push(`height:${bb.height}px`);
    s.push("overflow:hidden");
    const typo = el.styles?.typography || {};
    const visual = el.styles?.visual || {};
    const layout = el.styles?.layout || {};
    const hasBg = visual.backgroundColor && visual.backgroundColor !== "rgba(0, 0, 0, 0)";
    const hasText = el.textContent && el.textContent.trim().length > 0;
    if (hasBg) s.push(`background-color:${visual.backgroundColor}`);
    if (!hasBg && !hasText) {
      // 透明で空のフレーム要素にはうっすらボーダーを追加
      s.push("border:1px dashed rgba(0,0,0,0.08)");
    }
    if (visual.borderRadius && visual.borderRadius !== "0px") s.push(`border-radius:${visual.borderRadius}`);
    if (visual.border && visual.border !== "none" && visual.border !== "0px none") s.push(`border:${visual.border}`);
    if (visual.boxShadow && visual.boxShadow !== "none") s.push(`box-shadow:${visual.boxShadow}`);
    if (visual.opacity && visual.opacity !== "1") s.push(`opacity:${visual.opacity}`);
    if (typo.fontFamily) s.push(`font-family:${typo.fontFamily}`);
    if (typo.fontSize) s.push(`font-size:${typo.fontSize}`);
    if (typo.fontWeight) s.push(`font-weight:${typo.fontWeight}`);
    if (typo.lineHeight) s.push(`line-height:${typo.lineHeight}`);
    if (typo.letterSpacing && typo.letterSpacing !== "normal") s.push(`letter-spacing:${typo.letterSpacing}`);
    if (typo.textAlign && typo.textAlign !== "start") s.push(`text-align:${typo.textAlign}`);
    if (typo.color) s.push(`color:${typo.color}`);
    if (layout.display === "flex") {
      s.push("display:flex");
      if (layout.flexDirection) s.push(`flex-direction:${layout.flexDirection}`);
      if (layout.justifyContent) s.push(`justify-content:${layout.justifyContent}`);
      if (layout.alignItems) s.push(`align-items:${layout.alignItems}`);
      if (layout.gap && layout.gap !== "0px") s.push(`gap:${layout.gap}`);
    }
    if (layout.padding && layout.padding !== "0px") s.push(`padding:${layout.padding}`);
    const styleAttr = ` style="${s.join(";")}"`;
    const rawText = el.textContent || "";
    const text = rawText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tag = el.tagName === "p" ? "p" : "div";
    return `<${tag}${styleAttr}>${text}</${tag}>`;
  }).filter(Boolean);
  return { html: parts.join("\n"), width: canvasW, height: canvasH };
}

export default function DnaLibraryPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { getKey } = useApiKeys();

  const [dnaList, setDnaList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [colorFilter, setColorFilter] = useState("all");
  const [fontFilter, setFontFilter] = useState("all");

  const [selectedDna, setSelectedDna] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Bulk selection
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Rename
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // Figma sync modal
  const [showFigmaModal, setShowFigmaModal] = useState(false);
  const [figmaTokenCopied, setFigmaTokenCopied] = useState(false);

  const [capturingMaster, setCapturingMaster] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("pc"); // "pc" | "sp"
  const [previewZoom, setPreviewZoom] = useState(1);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Load design library
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/dna/library?full=true", { headers });
        const data = await res.json();
        if (data.success) setDnaList(data.data || []);
      } catch (err) {
        console.error("Failed to load design library:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // Enrich with extracted colors / fonts
  const enrichedList = useMemo(
    () =>
      dnaList.map((dna) => {
        const colors = extractColors(dna.elements);
        const fonts = extractFonts(dna.elements);
        return {
          ...dna,
          _colors: colors.slice(0, 8),
          _fonts: fonts,
          _colorTone: detectColorTone(colors),
          _fontType: detectFontType(fonts),
        };
      }),
    [dnaList]
  );

  // Filter
  const filtered = enrichedList.filter((dna) => {
    const name = dna.name || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchColor = colorFilter === "all" || dna._colorTone === colorFilter;
    const matchFont = fontFilter === "all" || dna._fontType === fontFilter;
    return matchSearch && matchColor && matchFont;
  });

  // Capture master image for existing records
  async function handleCaptureMaster() {
    if (!selectedDna || capturingMaster) return;
    const figmaToken = getKey("figma");
    if (!figmaToken) {
      alert("Figma アクセストークンが設定されていません。設定ページから入力してください。");
      return;
    }
    setCapturingMaster(true);
    try {
      const res = await fetch(`/api/dna/${selectedDna.id}/capture-master`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accessToken: figmaToken }),
      });
      const data = await res.json();
      if (data.success && data.masterImage) {
        const updated = { ...selectedDna, masterImage: data.masterImage };
        setSelectedDna(updated);
        setDnaList((prev) =>
          prev.map((d) => (d.id === selectedDna.id ? { ...d, masterImage: data.masterImage } : d))
        );
      } else {
        alert(data.error || "マスター画像の取得に失敗しました");
      }
    } catch (err) {
      alert("マスター画像の取得に失敗しました: " + err.message);
    } finally {
      setCapturingMaster(false);
    }
  }

  // Delete single
  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/dna/${id}`, { method: "DELETE", headers });
      const data = await res.json();
      if (data.success) {
        setDnaList((prev) => prev.filter((d) => d.id !== id));
        if (selectedDna?.id === id) setSelectedDna(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteConfirm(null);
  }

  // Bulk delete
  async function handleBulkDelete() {
    const ids = [...checkedIds];
    try {
      const res = await fetch("/api/dna/bulk-delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.success) {
        setDnaList((prev) => prev.filter((d) => !checkedIds.has(d.id)));
        if (selectedDna && checkedIds.has(selectedDna.id)) setSelectedDna(null);
        setCheckedIds(new Set());
        setSelectMode(false);
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
    setBulkDeleteConfirm(false);
  }

  function toggleCheck(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map((d) => d.id)));
    }
  }

  // Rename
  async function handleRename(id, newName) {
    try {
      const res = await fetch(`/api/dna/${id}/name`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (data.success) {
        setDnaList((prev) => prev.map((d) => (d.id === id ? { ...d, name: newName } : d)));
        if (selectedDna?.id === id) setSelectedDna((prev) => ({ ...prev, name: newName }));
      }
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setEditingId(null);
  }

  // Open Figma sync modal (with token check)
  function handleFigmaExport() {
    if (!getKey("figma")) {
      if (window.confirm("Figma アクセストークンが設定されていません。\n環境設定ページで入力してください。\n\n環境設定を開きますか？")) {
        navigate("/settings");
      }
      return;
    }
    setFigmaTokenCopied(false);
    setShowFigmaModal(true);
  }

  function handleCopyFigmaToken() {
    navigator.clipboard.writeText(token).then(() => {
      setFigmaTokenCopied(true);
      setTimeout(() => setFigmaTokenCopied(false), 2000);
    });
  }

  function colorToneLabel(tone) {
    return COLOR_FILTERS.find((f) => f.value === tone)?.label || "";
  }

  function fontTypeLabel(ft) {
    return FONT_FILTERS.find((f) => f.value === ft)?.label || "";
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-[#E8D5B0]/50 bg-white/60 text-[15px] text-[#5A4E3A] placeholder-[#C49A6C]/60 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/40 transition-all";

  // デザインのフォントを Google Fonts URL に変換
  const googleFontsUrl = useMemo(() => {
    const fonts = selectedDna?._fonts || [];
    const googleFontFamilies = fonts
      .map((f) => f.split(",")[0].trim().replace(/['"]/g, ""))
      .filter((f) => isGoogleFont(f) && !GENERIC_CSS_FONTS.has(f.toLowerCase()));
    const families = [...new Set(["Noto Sans JP", ...googleFontFamilies])];
    return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;700`).join("&")}&display=swap`;
  }, [selectedDna]);

  // 詳細プレビュー用データ
  const previewData = useMemo(() => {
    if (!selectedDna?.elements) return null;
    return buildPreviewFromElements(selectedDna.elements);
  }, [selectedDna]);

  // 詳細パネル用プレビュー srcDoc（マスター画像ベース or DOM フォールバック）
  const detailPreviewSrcDoc = useMemo(() => {
    if (!selectedDna) return "";
    const hasMaster = !!selectedDna.masterImage?.filename;
    const imageUrl = hasMaster ? `/api/images/${selectedDna.masterImage.filename}` : null;

    // キャンバスサイズ: マスター画像のサイズ or previewData から
    let canvasW, canvasH;
    if (hasMaster) {
      canvasW = selectedDna.masterImage.width || 1440;
      canvasH = selectedDna.masterImage.height || 900;
    } else if (previewData) {
      canvasW = previewData.width;
      canvasH = previewData.height;
    } else {
      return "";
    }

    // DOM フォールバック用 HTML
    const domHtml = !hasMaster && previewData ? previewData.html : "";
    if (!hasMaster && !domHtml) return "";

    // ルート要素の boundingBox を取得（オーバーレイ座標のオフセット計算用）
    const elements = selectedDna.elements || [];
    let rootBB = { x: 0, y: 0, width: canvasW, height: canvasH };
    let rootArea = 0;
    for (const el of elements) {
      const bb = el.boundingBox;
      if (bb && bb.width > 0 && bb.height > 0) {
        const area = bb.width * bb.height;
        if (area > rootArea) { rootArea = area; rootBB = bb; }
      }
    }

    // オーバーレイ divs（マスター画像モード時のみ生成）
    const overlayDivs = hasMaster ? elements.map((el, idx) => {
      const bb = el.boundingBox;
      if (!bb || bb.width <= 0 || bb.height <= 0) return "";
      const left = bb.x - rootBB.x;
      const top = bb.y - rootBB.y;
      if (left + bb.width <= 0 || left >= canvasW) return "";
      if (top + bb.height <= 0 || top >= canvasH) return "";
      return `<div data-el-idx="${idx}" style="position:absolute;left:${left}px;top:${top}px;width:${bb.width}px;height:${bb.height}px;cursor:pointer;" class="overlay-el"></div>`;
    }).filter(Boolean).join("\n") : "";

    const fontsUrl = googleFontsUrl;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f8f8f8; }
    #wrapper {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #canvas {
      position: absolute;
      width: ${canvasW}px;
      height: ${canvasH}px;
      transform-origin: 0 0;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    ${hasMaster ? `
    #master-bg { position: absolute; top: 0; left: 0; width: ${canvasW}px; height: ${canvasH}px; pointer-events: none; }
    #master-bg img { width: 100%; height: 100%; display: block; }
    #overlay { position: absolute; top: 0; left: 0; width: ${canvasW}px; height: ${canvasH}px; }
    .overlay-el { transition: outline 0.1s, background 0.1s; }
    .overlay-el:hover { outline: 2px solid rgba(58,175,201,0.7); background: rgba(58,175,201,0.08); }
    .overlay-el.locked { outline: 2px solid rgba(124,58,237,0.5); background: rgba(124,58,237,0.05); }
    .overlay-el.hovered { outline: 3px solid rgba(58,175,201,0.9); background: rgba(58,175,201,0.15); }
    ` : ""}
  </style>
</head>
<body>
  <div id="wrapper">
    <div id="canvas">
      ${hasMaster
        ? `<div id="master-bg"><img src="${imageUrl}" alt="Figma Master" /></div>\n      <div id="overlay">${overlayDivs}</div>`
        : domHtml}
    </div>
  </div>
  <script>
    (function(){
      var c = document.getElementById('canvas');
      function fit() {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var sw = (vw - 16) / ${canvasW};
        var sh = (vh - 16) / ${canvasH};
        var s = Math.min(sw, sh, 1);
        c.style.transform = 'scale(' + s + ')';
        c.style.left = ((vw - ${canvasW} * s) / 2) + 'px';
        c.style.top = ((vh - ${canvasH} * s) / 2) + 'px';
      }
      fit();
      window.addEventListener('resize', fit);
      ${hasMaster ? `
      // Overlay interaction: hover/click → postMessage to parent
      document.querySelectorAll('.overlay-el').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
          window.parent.postMessage({ type: 'element-hover', index: +el.dataset.elIdx }, '*');
        });
        el.addEventListener('mouseleave', function() {
          window.parent.postMessage({ type: 'element-unhover', index: +el.dataset.elIdx }, '*');
        });
        el.addEventListener('click', function() {
          window.parent.postMessage({ type: 'element-click', index: +el.dataset.elIdx }, '*');
        });
      });
      // Listen for messages from parent (lock sync, highlight)
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'update-locks') {
          var locked = e.data.lockedIndices || [];
          document.querySelectorAll('.overlay-el').forEach(function(el) {
            var idx = +el.dataset.elIdx;
            el.classList.toggle('locked', locked.indexOf(idx) !== -1);
          });
        }
        if (e.data && e.data.type === 'highlight-element') {
          document.querySelectorAll('.overlay-el.hovered').forEach(function(el) {
            el.classList.remove('hovered');
          });
          if (e.data.index >= 0) {
            var target = document.querySelector('[data-el-idx="' + e.data.index + '"]');
            if (target) target.classList.add('hovered');
          }
        }
      });
      ` : ""}
    })();
  <\/script>
</body>
</html>`;
  }, [selectedDna, previewData, googleFontsUrl]);

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[13px] text-[#C49A6C] hover:text-[#8B6914] transition-colors"
          >
            ← Dashboard
          </button>
          <h1
            className="text-lg font-bold text-[#8B6914] tracking-wider"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            デザインライブラリ
          </h1>
          <div className="ml-auto">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/compose")}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-all"
            >
              + 新規ページを作成
            </motion.button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Search + Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="デザイン名で検索..."
            className={`${inputClass} max-w-sm`}
          />

          {/* Color tone chips */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#8A7E6B] font-semibold w-16 flex-shrink-0">配色</span>
            <div className="flex gap-1.5">
              {COLOR_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setColorFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
                    colorFilter === f.value
                      ? "bg-[#f59e0b] text-white shadow-sm"
                      : "bg-white/50 text-[#8A7E6B] border border-[#E8D5B0]/50 hover:bg-[#f59e0b]/10"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font type chips */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#8A7E6B] font-semibold w-16 flex-shrink-0">書体</span>
            <div className="flex gap-1.5">
              {FONT_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFontFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
                    fontFilter === f.value
                      ? "bg-[#D4A76A] text-white shadow-sm"
                      : "bg-white/50 text-[#8A7E6B] border border-[#E8D5B0]/50 hover:bg-[#D4A76A]/10"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-3 border-[#f59e0b]/30 border-t-[#f59e0b] rounded-full animate-spin" />
            <p className="text-[15px] text-[#C49A6C] mt-3">ライブラリを読み込み中...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-4xl mb-3">📚</p>
            <p className="text-[15px] text-[#8A7E6B] font-semibold">
              {dnaList.length === 0
                ? "保存されたデザインはまだありません"
                : "条件に一致するデザインが見つかりません"}
            </p>
            <p className="text-[13px] text-[#C49A6C] mt-2">
              Figma インポートでデザインを取り込むと、ここに一覧表示されます
            </p>
            {dnaList.length === 0 && (
              <button
                onClick={() => navigate("/figma-import")}
                className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[15px] shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                Figma インポートへ
              </button>
            )}
          </motion.div>
        )}

        {/* Design grid */}
        {!loading && filtered.length > 0 && (
          <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] text-[#C49A6C]">
                  {filtered.length} 件のデザイン
                  {selectMode && checkedIds.size > 0 && (
                    <span className="ml-2 text-[#d97706] font-semibold">
                      ({checkedIds.size} 件選択中)
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {selectMode && (
                    <>
                      <button
                        onClick={toggleSelectAll}
                        className="px-3 py-1.5 rounded-lg text-[13px] font-semibold border border-[#E8D5B0]/50 text-[#8A7E6B] hover:bg-white/80 transition-all"
                      >
                        {checkedIds.size === filtered.length ? "全解除" : "全選択"}
                      </button>
                      <button
                        onClick={() => setBulkDeleteConfirm(true)}
                        disabled={checkedIds.size === 0}
                        className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {checkedIds.size} 件を削除
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectMode((v) => !v);
                      if (selectMode) setCheckedIds(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
                      selectMode
                        ? "bg-[#8A7E6B] text-white"
                        : "border border-[#E8D5B0]/50 text-[#8A7E6B] hover:bg-white/80"
                    }`}
                  >
                    {selectMode ? "選択を終了" : "選択"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((dna, i) => (
                    <motion.div
                      key={dna.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        if (selectMode) {
                          toggleCheck(dna.id);
                        } else {
                          setSelectedDna(dna);
                          setPreviewZoom(1);
                        }
                      }}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                        selectMode && checkedIds.has(dna.id)
                          ? "border-red-400 bg-red-50/50 shadow-sm"
                          : "border-[#E8D5B0]/50 bg-white/50 hover:border-[#f59e0b]/30"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        {selectMode && (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0 transition-all ${
                              checkedIds.has(dna.id)
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-[#C49A6C]/50"
                            }`}
                          >
                            {checkedIds.has(dna.id) && <span className="text-[12px]">✓</span>}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          {editingId === dna.id && selectedDna?.id !== dna.id ? (
                            <input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleRename(dna.id, editingName)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(dna.id, editingName);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-[15px] font-bold text-[#5A4E3A] bg-white/80 border border-[#f59e0b] rounded-lg px-2 py-0.5 outline-none"
                            />
                          ) : (
                            <h3
                              className="text-[15px] font-bold text-[#5A4E3A] truncate group/name"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingId(dna.id);
                                setEditingName(dna.name || "");
                              }}
                              title="ダブルクリックで名前変更"
                            >
                              {dna.name || "Unnamed"}
                            </h3>
                          )}
                          <p className="text-[13px] text-[#8A7E6B] mt-0.5">
                            {dna.elementCount} 要素 ・ {formatDate(dna.savedAt)}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0 ml-2">
                          {dna.type && (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              dna.type === "web" ? "bg-[#3aafc9]/10 text-[#3aafc9]" : "bg-[#f59e0b]/10 text-[#d97706]"
                            }`}>
                              {dna.type === "web" ? "Web" : "Graphic"}
                            </span>
                          )}
                          {dna._colorTone !== "other" && (
                            <span className="px-2 py-0.5 rounded text-[12px] font-bold bg-[#f59e0b]/10 text-[#d97706]">
                              {colorToneLabel(dna._colorTone)}
                            </span>
                          )}
                          {dna._fontType !== "other" && (
                            <span className="px-2 py-0.5 rounded text-[12px] font-bold bg-[#D4A76A]/10 text-[#B8944C]">
                              {fontTypeLabel(dna._fontType)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Color swatches */}
                      {dna._colors.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {dna._colors.map((c, idx) => (
                            <div
                              key={idx}
                              className="w-5 h-5 rounded-full border border-white/50 shadow-sm"
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      )}

                      {/* Fonts */}
                      {dna._fonts.length > 0 && (
                        <p className="text-[12px] text-[#8A7E6B] mt-2 truncate">
                          {dna._fonts.slice(0, 3).join(", ")}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/export", { state: { dnaId: dna.id } });
                          }}
                          className="flex-1 py-2 rounded-lg text-[13px] font-semibold bg-[#f59e0b]/10 text-[#d97706] hover:bg-[#f59e0b]/20 transition-all"
                        >
                          コードに変換
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(dna.id);
                          }}
                          className="px-3 py-2 rounded-lg text-[13px] font-semibold border border-red-200/50 text-red-400 hover:bg-red-50 transition-all"
                        >
                          削除
                        </button>
                      </div>
                    </motion.div>
                ))}
              </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedDna && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedDna(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1300px] flex flex-col overflow-hidden"
              style={{ height: "min(90vh, 900px)" }}
            >
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {editingId === selectedDna.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={(e) => {
                        // ボタンクリックによる一時的なフォーカスロスを無視
                        const related = e.relatedTarget;
                        if (related && e.currentTarget.parentElement?.contains(related)) return;
                        setTimeout(() => handleRename(selectedDna.id, editingName), 100);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(selectedDna.id, editingName);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="text-[17px] font-bold text-[#5A4E3A] bg-white/80 border border-[#f59e0b] rounded-lg px-3 py-1 outline-none max-w-sm"
                    />
                  ) : (
                    <h2
                      className="text-[17px] font-bold text-[#5A4E3A] truncate cursor-pointer hover:text-[#8B6914] transition-colors"
                      onClick={() => {
                        setEditingId(selectedDna.id);
                        setEditingName(selectedDna.name || "");
                      }}
                      title="クリックで名前変更"
                    >
                      {selectedDna.name || "Unnamed"}
                    </h2>
                  )}
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEditingId(selectedDna.id);
                      setEditingName(selectedDna.name || "");
                    }}
                    className="text-[12px] text-[#C49A6C] hover:text-[#8B6914] transition-colors flex-shrink-0 flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    名前変更
                  </button>
                  {selectedDna.type && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                      selectedDna.type === "web" ? "bg-[#3aafc9]/10 text-[#3aafc9]" : "bg-[#f59e0b]/10 text-[#d97706]"
                    }`}>
                      {selectedDna.type === "web" ? "Web" : "Graphic"}
                    </span>
                  )}
                  <span className="text-[13px] text-[#8A7E6B] flex-shrink-0">
                    {selectedDna.elementCount} 要素 ・ {formatDate(selectedDna.savedAt)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDna(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg flex-shrink-0 ml-3"
                >
                  ×
                </button>
              </div>

              {/* Modal body — preview + info */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Preview area */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="px-4 pt-3 pb-1 flex items-center gap-2 flex-shrink-0">
                    <p className="text-[13px] font-semibold text-[#8A7E6B]">プレビュー</p>
                    <div className="flex rounded-lg border border-[#E8D5B0]/50 overflow-hidden ml-auto">
                      <button
                        onClick={() => { setPreviewDevice("sp"); setPreviewZoom(1); }}
                        className={`px-3 py-1 text-[12px] font-semibold transition-all ${
                          previewDevice === "sp"
                            ? "bg-[#f59e0b] text-white"
                            : "text-[#8A7E6B] hover:bg-[#E8D5B0]/20"
                        }`}
                      >
                        SP
                      </button>
                      <button
                        onClick={() => { setPreviewDevice("pc"); setPreviewZoom(1); }}
                        className={`px-3 py-1 text-[12px] font-semibold transition-all ${
                          previewDevice === "pc"
                            ? "bg-[#f59e0b] text-white"
                            : "text-[#8A7E6B] hover:bg-[#E8D5B0]/20"
                        }`}
                      >
                        PC
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 mx-4 mb-4 relative bg-gray-100/50 rounded-xl overflow-auto">
                    {/* Master image with native scroll + button zoom */}
                    {selectedDna.masterImage?.filename ? (
                      <>
                        <div className="sticky top-2 z-10 flex gap-1 justify-end pr-2 pt-2 pointer-events-none">
                          <button onClick={() => setPreviewZoom(z => Math.min(z * 1.25, 5))} className="pointer-events-auto w-7 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-sm font-bold hover:bg-white shadow-sm transition-all" title="ズームイン">+</button>
                          <button onClick={() => setPreviewZoom(z => Math.max(z / 1.25, 0.1))} className="pointer-events-auto w-7 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-sm font-bold hover:bg-white shadow-sm transition-all" title="ズームアウト">-</button>
                          <button onClick={() => setPreviewZoom(1)} className="pointer-events-auto px-2 h-7 rounded-lg bg-white/90 border border-[#E8D5B0]/50 text-[#5C4A28] text-[11px] font-semibold hover:bg-white shadow-sm transition-all" title="リセット">Reset</button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16 }}>
                          <img
                            src={(() => {
                              if (selectedDna.type === "web" && selectedDna.deviceFrames) {
                                const df = selectedDna.deviceFrames[previewDevice];
                                if (df?.masterImage?.filename) return `/api/images/${df.masterImage.filename}`;
                              }
                              return `/api/images/${selectedDna.masterImage.filename}`;
                            })()}
                            alt="Design Master"
                            className="max-w-none"
                            style={{
                              width: (() => {
                                const baseW = previewDevice === "sp" ? 375 : (selectedDna.masterImage.width || 800);
                                return baseW * previewZoom;
                              })(),
                              height: "auto",
                            }}
                            draggable={false}
                            onDoubleClick={() => setPreviewZoom(1)}
                          />
                        </div>
                      </>
                    ) : (
                      /* DOM fallback (no master image) — use iframe */
                      <div
                        className="h-full flex justify-center overflow-auto"
                      >
                        <div
                          className="h-full rounded-xl overflow-hidden border border-[#E8D5B0]/50 bg-white transition-all duration-300"
                          style={{ width: previewDevice === "sp" ? 375 : "100%", flexShrink: 0 }}
                        >
                          {detailPreviewSrcDoc ? (
                            <iframe
                              srcDoc={detailPreviewSrcDoc}
                              className="w-full h-full border-0"
                              sandbox="allow-scripts allow-same-origin"
                              title="Design Preview"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-[#C49A6C] text-[14px]">
                              プレビューを生成中...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right sidebar info */}
                <div className="hidden md:block w-[280px] flex-shrink-0 border-l border-[#E8D5B0]/30 overflow-y-auto p-4 space-y-4">
                  {/* Colors */}
                  {selectedDna._colors?.length > 0 && (
                    <div>
                      <p className="text-[13px] font-semibold text-[#8A7E6B] mb-2">カラーパレット</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedDna._colors.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded-lg border border-[#E8D5B0]/50 shadow-sm"
                              style={{ backgroundColor: c }}
                            />
                            <span className="text-[11px] text-[#8A7E6B] font-mono">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fonts */}
                  {selectedDna._fonts?.length > 0 && (
                    <div>
                      <p className="text-[13px] font-semibold text-[#8A7E6B] mb-2">フォント</p>
                      <div className="space-y-1">
                        {selectedDna._fonts.map((f, idx) => {
                          const isAvailable = isGoogleFont(f);
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              <p className="text-[13px] text-[#5A4E3A]" style={{ fontFamily: f }}>
                                {f}
                              </p>
                              {!isAvailable && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold flex-shrink-0">
                                  要置換
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Element summary */}
                  <div>
                    <p className="text-[13px] font-semibold text-[#8A7E6B] mb-2">要素構成</p>
                    <div className="space-y-1">
                      {(() => {
                        const tagCounts = {};
                        for (const el of selectedDna.elements || []) {
                          const tag = el.tagName || "div";
                          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        }
                        return Object.entries(tagCounts).map(([tag, count]) => (
                          <div key={tag} className="flex items-center justify-between text-[13px]">
                            <span className="text-[#5A4E3A] font-mono">&lt;{tag}&gt;</span>
                            <span className="text-[#C49A6C]">{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Master Image Status */}
                  <div>
                    <p className="text-[13px] font-semibold text-[#8A7E6B] mb-2">マスター画像</p>
                    {selectedDna.masterImage?.filename ? (
                      <div className="flex items-center gap-1.5 text-[12px] text-green-700 bg-green-50 rounded-lg p-2">
                        <span>&#10003;</span>
                        <span>高解像度画像を保存済み (x{selectedDna.masterImage.scale || 1})</span>
                      </div>
                    ) : selectedDna.url?.startsWith("figma://") ? (
                      <button
                        onClick={handleCaptureMaster}
                        disabled={capturingMaster}
                        className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-[#3aafcc] to-[#2d8fa8] text-white text-[12px] font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        {capturingMaster ? "取得中..." : "Figma マスター画像を取得"}
                      </button>
                    ) : (
                      <p className="text-[11px] text-[#8A7E6B]">DOM ベースのプレビュー</p>
                    )}
                  </div>

                </div>
              </div>

              {/* Modal footer — actions */}
              <div className="px-6 py-4 border-t border-[#E8D5B0]/50 flex flex-wrap gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate("/export", { state: { dnaId: selectedDna.id } })}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  デザインをコードに生成
                </button>
                <button
                  onClick={handleFigmaExport}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  Figma に書き出し
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setDeleteConfirm(selectedDna.id);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-red-200/50 text-red-400 text-[13px] font-semibold hover:bg-red-50 transition-all"
                >
                  削除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>




      {/* ── Figma Sync Modal ── */}
      <AnimatePresence>
        {showFigmaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowFigmaModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E8D5B0]/50 bg-gradient-to-r from-[#a259ff]/5 to-[#7c3aed]/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-[#5A4E3A]">
                      Figma Plugin で同期
                    </h2>
                    <p className="text-[13px] text-[#8A7E6B] mt-0.5">
                      Local Styles（塗りスタイル・テキストスタイル）の作成には Figma Plugin API が必要です。以下の手順で同期してください:
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFigmaModal(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8D5B0]/30 text-[#8A7E6B] transition-colors text-lg"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Steps */}
                <ol className="space-y-3">
                  <li className="flex gap-3 text-[15px] text-[#5A4E3A]">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-[12px] font-bold flex-shrink-0 mt-0.5">1</span>
                    <span>Figma デスクトップアプリで対象ファイルを開く</span>
                  </li>
                  <li className="flex gap-3 text-[15px] text-[#5A4E3A]">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-[12px] font-bold flex-shrink-0 mt-0.5">2</span>
                    <span>
                      プラグイン &gt; 開発 &gt; マニフェストからプラグインをインポート &gt;{" "}
                      <code className="px-1.5 py-0.5 bg-[#F5E6C8]/60 rounded text-[13px]">apps/figma-sync/plugin/manifest.json</code> を選択
                    </span>
                  </li>
                  <li className="flex gap-3 text-[15px] text-[#5A4E3A]">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] text-white text-[12px] font-bold flex-shrink-0 mt-0.5">3</span>
                    <span>Plugin UI に下記トークンを貼り付けて「Figma に同期」を実行</span>
                  </li>
                </ol>

                {/* Token copy */}
                <div>
                  <label className="block text-[13px] font-semibold text-[#8A7E6B] mb-1.5">
                    Plugin用 認証トークン (JWT)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={token ? `${token.slice(0, 20)}...` : ""}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E8D5B0]/50 bg-white/60 text-[13px] text-[#5A4E3A] font-mono"
                    />
                    <button
                      onClick={handleCopyFigmaToken}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all flex-shrink-0"
                    >
                      {figmaTokenCopied ? "コピー済み" : "コピー"}
                    </button>
                  </div>
                  <p className="text-[12px] text-[#C49A6C] mt-1.5">
                    Figma Plugin の「認証トークン」フィールドにペーストしてください
                  </p>
                </div>

                {/* Notes */}
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/50">
                  <p className="text-[13px] text-amber-700 leading-relaxed">
                    <strong>スタイル名が重複する場合：</strong>既存のスタイルを自動で上書き更新します（新規作成されません）。
                    <br />
                    <strong>対応プラン：</strong>Figma Starter / Professional / Organization / Enterprise（全プラン対応）
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#E8D5B0]/50 flex gap-3">
                <button
                  onClick={() => setShowFigmaModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8D5B0]/50 text-[15px] text-[#8A7E6B] hover:bg-[#E8D5B0]/20 transition-all"
                >
                  閉じる
                </button>
                <button
                  onClick={() => navigate("/figma-guide")}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed] text-white text-[15px] font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  プラグイン導入ガイドへ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm modal (single) */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
            >
              <p className="text-[15px] font-bold text-[#5A4E3A] mb-2">本当に削除しますか？</p>
              <p className="text-[13px] text-[#8A7E6B] mb-4">この操作は元に戻せません。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold border border-[#E8D5B0]/50 text-[#8A7E6B] hover:bg-[#FAF3E6] transition-all"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
                >
                  削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk delete confirm modal */}
      <AnimatePresence>
        {bulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setBulkDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
            >
              <p className="text-[15px] font-bold text-[#5A4E3A] mb-2">
                {checkedIds.size} 件のデザインを削除しますか？
              </p>
              <p className="text-[13px] text-[#8A7E6B] mb-4">この操作は元に戻せません。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold border border-[#E8D5B0]/50 text-[#8A7E6B] hover:bg-[#FAF3E6] transition-all"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
                >
                  {checkedIds.size} 件を削除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
