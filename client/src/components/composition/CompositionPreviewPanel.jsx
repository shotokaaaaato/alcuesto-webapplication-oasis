import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRoleColor } from "../../constants/roles";
import {
  renderDesignPreview,
  extractProjectStyles,
  buildPreviewDocument,
} from "../../utils/htmlRenderer";

export default function CompositionPreviewPanel({
  sections: initialSections,
  dnaLibrary,
  pageName,
  aiModel,
  apiKey,
  imageMode,
  headers,
  onComplete,
  onBack,
}) {
  // ── State ──
  const [sections, setSections] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState(null);
  const [previewDevice, setPreviewDevice] = useState("pc");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [loading, setLoading] = useState(true);

  const iframeRef = useRef(null);
  const initRef = useRef(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const sectionHtmlResolveRef = useRef(null);

  const current = sections[currentIndex];
  const approvedCount = sections.filter((s) => s.status === "done").length;
  const allDone =
    sections.length > 0 &&
    sections.every((s) => s.status === "done" || s.status === "skipped");

  // ── Resolve source elements + master image from DNA library ──
  const resolveSourceData = useCallback(
    (section) => {
      if (!section?.designRef?.dnaId) return null;
      const dna = dnaLibrary.find((d) => d.id === section.designRef.dnaId);
      if (!dna) return null;

      let allElements = null;
      let masterImage = null;
      const frame = section.designRef.deviceFrame;

      // 1. Try specified device frame
      if (frame && dna.deviceFrames?.[frame]?.elements?.length > 0) {
        allElements = dna.deviceFrames[frame].elements;
        masterImage = dna.deviceFrames[frame].masterImage;
      }
      // 2. Auto-select PC frame for web designs
      else if (dna.deviceFrames?.pc?.elements?.length > 0) {
        allElements = dna.deviceFrames.pc.elements;
        masterImage = dna.deviceFrames.pc.masterImage;
      }
      // 3. Try SP frame
      else if (dna.deviceFrames?.sp?.elements?.length > 0) {
        allElements = dna.deviceFrames.sp.elements;
        masterImage = dna.deviceFrames.sp.masterImage;
      }

      // 4. Fall back to top-level elements + masterImage
      if (!allElements || allElements.length === 0) {
        allElements = dna.elements;
        masterImage = dna.masterImage;
      }

      if (!allElements || allElements.length === 0) return null;

      const masterImageUrl = masterImage?.filename
        ? `/api/images/${masterImage.filename}`
        : null;

      // Filter by element indices if specified
      const indices = section.designRef.elementIndices;
      let elements = allElements;
      let cropRegion = null;

      if (indices && indices.length > 0) {
        const filtered = allElements.filter((_, i) => indices.includes(i));
        if (filtered.length > 0) {
          elements = filtered;

          // Compute crop region for CSS clipping of master image
          if (masterImageUrl) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const el of filtered) {
              const bb = el.boundingBox;
              if (!bb || bb.width <= 0 || bb.height <= 0) continue;
              minX = Math.min(minX, bb.x);
              minY = Math.min(minY, bb.y);
              maxX = Math.max(maxX, bb.x + bb.width);
              maxY = Math.max(maxY, bb.y + bb.height);
            }
            if (minX < Infinity) {
              // Find full-page root bounding box
              let pageRootBB = { x: 0, y: 0, width: 1440, height: 900 };
              let maxArea = 0;
              for (const el of allElements) {
                const bb = el.boundingBox;
                if (!bb || bb.width <= 0 || bb.height <= 0) continue;
                if (bb.width * bb.height > maxArea) {
                  maxArea = bb.width * bb.height;
                  pageRootBB = bb;
                }
              }
              // Small padding (2%) so the section doesn't look cut off
              const padX = (maxX - minX) * 0.02;
              const padY = (maxY - minY) * 0.02;
              cropRegion = {
                x: Math.max(pageRootBB.x, minX - padX),
                y: Math.max(pageRootBB.y, minY - padY),
                width: Math.min(maxX - minX + padX * 2, pageRootBB.x + pageRootBB.width - Math.max(pageRootBB.x, minX - padX)),
                height: Math.min(maxY - minY + padY * 2, pageRootBB.y + pageRootBB.height - Math.max(pageRootBB.y, minY - padY)),
                pageWidth: pageRootBB.width,
                pageHeight: pageRootBB.height,
                pageX: pageRootBB.x,
                pageY: pageRootBB.y,
              };
            }
          }
        }
      }

      return { elements, masterImageUrl, cropRegion };
    },
    [dnaLibrary]
  );

  // ── Initialize: render all referenced sections immediately ──
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const results = initialSections.map((s) => {
      // Already rendered from a previous visit
      if (s.html && s.status === "done") return { ...s };

      // Has design reference → render immediately (no AI)
      if (s.designRef?.dnaId && s.mode !== "none") {
        const data = resolveSourceData(s);
        if (data && data.elements.length > 0) {
          const html = renderDesignPreview(
            data.elements,
            s.role || "section",
            data.masterImageUrl,
            data.cropRegion
          );
          if (html && html.trim().length > 30) {
            return { ...s, html, code: html, status: "done" };
          }
        }
      }

      // No reference or rendering failed → pending
      return { ...s, status: "pending", html: "", code: "" };
    });

    setSections(results);
    setLoading(false);

    // Focus on first pending section
    const firstPending = results.findIndex((s) => s.status === "pending");
    if (firstPending !== -1) setCurrentIndex(firstPending);
  }, [initialSections, resolveSourceData]);

  // ── postMessage listener ──
  useEffect(() => {
    function handleMessage(e) {
      if (!e.data?.type) return;
      switch (e.data.type) {
        case "element-selected":
          setSelectedElement(e.data);
          setShowMenu(true);
          setEditingText(false);
          if (e.data.sectionIndex >= 0) setCurrentIndex(e.data.sectionIndex);
          break;
        case "element-deselected":
          setSelectedElement(null);
          setShowMenu(false);
          setEditingText(false);
          break;
        case "section-updated":
          if (e.data.sectionIndex >= 0) {
            setSections((prev) =>
              prev.map((s, i) =>
                i === e.data.sectionIndex
                  ? { ...s, html: e.data.html, code: e.data.html }
                  : s
              )
            );
          }
          break;
        case "edit-complete":
          setEditingText(false);
          break;
        case "section-html-response":
          if (sectionHtmlResolveRef.current && e.data?.sectionIndex >= 0) {
            sectionHtmlResolveRef.current(e.data.html ?? "");
            sectionHtmlResolveRef.current = null;
          }
          break;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ── DNS CSS block for variable injection ──
  const dnaCssBlock = useMemo(() => {
    const cssRules = [];
    const seenColors = new Set();
    for (const s of sections) {
      if (!s.designRef?.dnaId) continue;
      const dna = dnaLibrary.find((d) => d.id === s.designRef.dnaId);
      if (!dna) continue;

      let els;
      const frame = s.designRef.deviceFrame;
      if (frame && dna.deviceFrames?.[frame]?.elements) {
        els = dna.deviceFrames[frame].elements;
      } else if (dna.deviceFrames?.pc?.elements?.length > 0) {
        els = dna.deviceFrames.pc.elements;
      } else {
        els = dna.elements;
      }
      if (!els) continue;

      for (const el of els) {
        const bg = el.styles?.visual?.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && !seenColors.has(bg)) {
          seenColors.add(bg);
          cssRules.push(`  --dna-bg-${seenColors.size}: ${bg};`);
        }
        const color = el.styles?.typography?.color;
        if (color && color.startsWith("rgb") && !seenColors.has(color)) {
          seenColors.add(color);
          cssRules.push(`  --dna-text-${seenColors.size}: ${color};`);
        }
        const font = el.styles?.typography?.fontFamily;
        if (font && !seenColors.has(`font:${font}`)) {
          seenColors.add(`font:${font}`);
          cssRules.push(`  --dna-font: ${font}, sans-serif;`);
        }
      }
    }
    if (cssRules.length === 0) return "";
    return `:root {\n${cssRules.join("\n")}\n}\nsection { font-family: var(--dna-font, 'Noto Sans JP', sans-serif); }`;
  }, [sections, dnaLibrary]);

  // ── Build preview document ──
  const previewSrcDoc = useMemo(() => {
    if (loading) {
      return `<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:'Noto Sans JP',sans-serif;color:#8A7E6B;background:#FAF3E6;"><div style="text-align:center"><div style="width:40px;height:40px;border:3px solid #E8D5B0;border-top-color:#D4A76A;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div><p style="font-size:14px;">レンダリング中...</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`;
    }

    const partsHtml = sections
      .map((s, i) => {
        const isCurrent = i === currentIndex;
        if (s.status === "done" && s.html) {
          const highlight = isCurrent
            ? ' style="outline:3px dashed #7c3aed;outline-offset:-2px;position:relative;"'
            : "";
          return `<div data-section-wrapper data-section-idx="${i}"${highlight}>${s.html}</div>`;
        }
        if (s.status === "generating") {
          return `<div data-section-wrapper data-section-idx="${i}">
            <div class="oasis-no-ref-placeholder" style="background:linear-gradient(135deg,#f3e8ff,#ede9fe);border-color:#7c3aed;">
              <div style="width:32px;height:32px;border:3px solid #ddd6fe;border-top-color:#7c3aed;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:8px;"></div>
              <p style="color:#7c3aed;font-weight:600;">${s.label} — 生成中...</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          </div>`;
        }
        // Pending (no reference or failed render)
        return `<div data-section-wrapper data-section-idx="${i}">
          <div class="oasis-no-ref-placeholder">
            <p style="font-weight:600;margin-bottom:4px;">${s.label}</p>
            <p style="font-size:12px;color:#C49A6C;">参照デザインなし — 右パネルから「デザイン生成」をクリック</p>
          </div>
        </div>`;
      })
      .join("\n");

    return buildPreviewDocument(partsHtml, dnaCssBlock);
  }, [loading, sections, currentIndex, dnaCssBlock]);

  // ── Send message to iframe ──
  const sendToIframe = useCallback((msg) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  // ── Handlers ──

  // Enable inline text editing
  function handleDirectEdit() {
    setEditingText(true);
    sendToIframe({ type: "enable-edit" });
  }

  // AI rewrite selected text
  async function handleAiRewrite() {
    if (!selectedElement || aiRewriting) return;
    setAiRewriting(true);
    setError("");
    try {
      const key = apiKey;
      if (!key) throw new Error("API キーが設定されていません");
      const res = await fetch("/api/compose/rewrite-element", {
        method: "POST",
        headers: headersRef.current,
        body: JSON.stringify({
          text: selectedElement.text,
          elementType: selectedElement.elementType,
          tagName: selectedElement.tagName,
          sectionLabel: current?.label || "",
          pageName,
          model: aiModel,
          apiKey: key,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.newText) {
        sendToIframe({ type: "replace-text", text: data.newText });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAiRewriting(false);
    }
  }

  // Delete selected element
  function handleDelete() {
    sendToIframe({ type: "delete-element" });
    setSelectedElement(null);
    setShowMenu(false);
  }

  // AI suggest image
  async function handleAiImage() {
    if (!selectedElement || aiRewriting) return;
    setAiRewriting(true);
    setError("");
    try {
      const key = apiKey;
      if (!key) throw new Error("API キーが設定されていません");
      const res = await fetch("/api/compose/suggest-image", {
        method: "POST",
        headers: headersRef.current,
        body: JSON.stringify({
          currentAlt: selectedElement.alt || selectedElement.text || "",
          sectionLabel: current?.label || "",
          pageName,
          model: aiModel,
          apiKey: key,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.src) {
        sendToIframe({
          type: "replace-image",
          src: data.src,
          alt: data.alt || "",
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAiRewriting(false);
    }
  }

  // Manual image upload
  function handleImageUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(",")[1];
          const res = await fetch("/api/compose/upload-image", {
            method: "POST",
            headers: headersRef.current,
            body: JSON.stringify({
              imageData: base64,
              filename: file.name,
            }),
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          if (data.url) {
            sendToIframe({ type: "replace-image", src: data.url });
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError("画像のアップロードに失敗しました");
      }
    };
    input.click();
  }

  // Generate section for no-reference
  async function handleGenerateSection(idx) {
    const section = sectionsRef.current[idx];
    if (!section) return;
    setGeneratingIdx(idx);
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, status: "generating" } : s))
    );
    setError("");
    try {
      const key = apiKey;
      if (!key) throw new Error("API キーが設定されていません");
      const projectStyles = extractProjectStyles(
        sectionsRef.current,
        dnaLibrary
      );

      const res = await fetch("/api/compose/generate-fresh-section", {
        method: "POST",
        headers: headersRef.current,
        body: JSON.stringify({
          sectionLabel: section.label,
          role: section.role,
          pageName,
          baseColor: projectStyles.baseColor,
          mainFont: projectStyles.mainFont,
          imageMode,
          model: aiModel,
          apiKey: key,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSections((prev) =>
        prev.map((s, i) =>
          i === idx
            ? {
                ...s,
                status: "done",
                html: data.sectionHtml,
                code: data.sectionCode,
              }
            : s
        )
      );
    } catch (err) {
      setError(err.message);
      setSections((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, status: "pending" } : s))
      );
    } finally {
      setGeneratingIdx(null);
    }
  }

  // Save section to design library (fetches latest HTML from iframe if needed)
  async function handleSaveToLibrary(idx) {
    const section = sectionsRef.current[idx];
    if (!section) return;
    setSaving(true);
    setSaveSuccess(null);
    setError("");
    try {
      let htmlToSave = section.html;
      // Get latest HTML from iframe (e.g. when user edited without blurring)
      sendToIframe({ type: "get-section-html", sectionIndex: idx });
      const freshHtml = await new Promise((resolve) => {
        sectionHtmlResolveRef.current = resolve;
        setTimeout(() => {
          if (sectionHtmlResolveRef.current) {
            sectionHtmlResolveRef.current(null);
            sectionHtmlResolveRef.current = null;
          }
        }, 800);
      });
      if (freshHtml && freshHtml.trim().length > 0) htmlToSave = freshHtml;
      if (!htmlToSave || !htmlToSave.trim()) {
        setError("保存するコンテンツがありません");
        return;
      }
      const res = await fetch("/api/compose/save-section-to-library", {
        method: "POST",
        headers: headersRef.current,
        body: JSON.stringify({
          sectionHtml: htmlToSave,
          name: `${pageName} — ${section.label}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      if (htmlToSave !== section.html) {
        setSections((prev) =>
          prev.map((s, i) =>
            i === idx ? { ...s, html: htmlToSave, code: htmlToSave } : s
          )
        );
      }
      setSaveSuccess(idx);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Assembly → proceed to Step 6
  function handleAssemble() {
    const assembled = sections
      .filter((s) => s.status === "done")
      .map((s) => s.html)
      .join("\n");
    onComplete(sections, assembled);
  }

  // Deselect on section change
  function handleSectionClick(idx) {
    setCurrentIndex(idx);
    setSelectedElement(null);
    setShowMenu(false);
    sendToIframe({ type: "deselect" });
  }

  // ── Floating menu position ──
  const menuStyle = useMemo(() => {
    if (!selectedElement?.rect || !iframeRef.current) return {};
    const iframeRect = iframeRef.current.getBoundingClientRect();
    const parentRect =
      iframeRef.current.parentElement.getBoundingClientRect();
    const elRect = selectedElement.rect;
    return {
      position: "absolute",
      top: Math.max(
        0,
        elRect.top + iframeRect.top - parentRect.top
      ),
      left: Math.min(
        elRect.right + 8,
        iframeRef.current.parentElement.offsetWidth - 200
      ),
      zIndex: 100,
    };
  }, [selectedElement]);

  // ── Render ──
  return (
    <div className="flex gap-4" style={{ height: "75vh" }}>
      {/* ── Preview Area ── */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm overflow-hidden">
        {/* Preview header */}
        <div className="px-4 py-2.5 border-b border-[#E8D5B0]/30 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#7c3aed]/5 to-[#a259ff]/5">
          <div className="flex items-center gap-3">
            <h3 className="text-[14px] font-bold text-[#5A4E3A]">
              ライブエディタ
            </h3>
            <div className="flex items-center gap-1">
              {sections.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSectionClick(i)}
                  className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
                    i === currentIndex
                      ? "bg-[#7c3aed] text-white scale-110"
                      : s.status === "done"
                      ? "bg-green-500 text-white"
                      : s.status === "skipped"
                      ? "bg-gray-300 text-white"
                      : "bg-[#E8D5B0]/50 text-[#8A7E6B]"
                  }`}
                  title={s.label}
                >
                  {s.status === "done" ? "✓" : i + 1}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#8A7E6B]">
              {approvedCount}/{sections.length} 完了
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedElement && (
              <span className="text-[11px] px-2 py-1 rounded bg-[#7c3aed]/10 text-[#7c3aed] font-semibold">
                {selectedElement.elementType === "image"
                  ? "画像を選択中"
                  : selectedElement.elementType === "text"
                  ? "テキストを選択中"
                  : "要素を選択中"}
              </span>
            )}
            <div className="flex rounded-lg overflow-hidden border border-[#E8D5B0]/50">
              {["pc", "sp"].map((d) => (
                <button
                  key={d}
                  onClick={() => setPreviewDevice(d)}
                  className={`px-3 py-1 text-[11px] font-semibold transition-all ${
                    previewDevice === d
                      ? "bg-[#7c3aed] text-white"
                      : "bg-white text-[#8A7E6B] hover:bg-gray-50"
                  }`}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview iframe + floating menu */}
        <div className="flex-1 min-h-0 flex justify-center overflow-auto bg-gray-100/50 p-3 relative">
          <div
            className="h-full rounded-xl overflow-hidden border border-[#E8D5B0]/50 bg-white transition-all duration-300 relative"
            style={{
              width: previewDevice === "sp" ? 375 : "100%",
              flexShrink: 0,
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={previewSrcDoc}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Live Editor Preview"
            />
          </div>

          {/* ── Floating Edit Menu ── */}
          <AnimatePresence>
            {showMenu && selectedElement && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                style={menuStyle}
                className="bg-white rounded-xl shadow-xl border border-[#E8D5B0]/60 p-2 min-w-[160px]"
              >
                <p className="text-[10px] text-[#8A7E6B] px-2 py-1 border-b border-[#E8D5B0]/30 mb-1">
                  &lt;{selectedElement.tagName}&gt;
                  {selectedElement.elementType === "text" && (
                    <span className="ml-1 text-[#7c3aed]">テキスト</span>
                  )}
                  {selectedElement.elementType === "image" && (
                    <span className="ml-1 text-[#3b82f6]">画像</span>
                  )}
                </p>

                {selectedElement.elementType === "text" && (
                  <>
                    <button
                      onClick={handleAiRewrite}
                      disabled={aiRewriting}
                      className="w-full text-left px-3 py-1.5 text-[12px] rounded-lg hover:bg-[#7c3aed]/10 text-[#5A4E3A] transition-colors disabled:opacity-50"
                    >
                      {aiRewriting ? "AI 処理中..." : "AI で書き換え"}
                    </button>
                    <button
                      onClick={handleDirectEdit}
                      disabled={editingText}
                      className="w-full text-left px-3 py-1.5 text-[12px] rounded-lg hover:bg-[#f59e0b]/10 text-[#5A4E3A] transition-colors disabled:opacity-50"
                    >
                      {editingText ? "編集中..." : "直接編集"}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full text-left px-3 py-1.5 text-[12px] rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    >
                      削除
                    </button>
                  </>
                )}

                {selectedElement.elementType === "image" && (
                  <>
                    <button
                      onClick={handleAiImage}
                      disabled={aiRewriting}
                      className="w-full text-left px-3 py-1.5 text-[12px] rounded-lg hover:bg-[#3b82f6]/10 text-[#5A4E3A] transition-colors disabled:opacity-50"
                    >
                      {aiRewriting ? "AI 処理中..." : "AI で画像生成"}
                    </button>
                    <button
                      onClick={handleImageUpload}
                      className="w-full text-left px-3 py-1.5 text-[12px] rounded-lg hover:bg-green-50 text-[#5A4E3A] transition-colors"
                    >
                      手動アップロード
                    </button>
                  </>
                )}

                {selectedElement.elementType === "container" && (
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-1.5 text-[12px] rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                  >
                    削除
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="w-[300px] flex-shrink-0 rounded-2xl bg-white/50 border border-[#E8D5B0]/50 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* Current section info */}
          <div className="p-4 rounded-xl bg-[#7c3aed]/5 border border-[#7c3aed]/20">
            <p className="text-[14px] text-[#7c3aed] font-semibold mb-1.5">
              {currentIndex + 1}/{sections.length}
            </p>
            <p className="text-[16px] font-bold text-[#5A4E3A] leading-snug">
              {current?.label || "—"}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-[12px] font-bold px-2 py-1 rounded"
                style={{
                  backgroundColor: `${getRoleColor(current?.role)}20`,
                  color: getRoleColor(current?.role),
                }}
              >
                {current?.role}
              </span>
              <span className="text-[12px] text-[#8A7E6B]">
                {current?.designRef?.dnaId ? "参照あり" : "参照なし"}
              </span>
            </div>
          </div>

          {/* Usage guide */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/40">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              プレビュー内の要素をクリックして選択 → 編集メニューが表示されます。テキストの直接編集や AI 書き換えが可能です。
            </p>
          </div>

          {/* Section list */}
          <div>
            <p className="text-[14px] font-semibold text-[#8A7E6B] mb-2">
              セクション一覧
            </p>
            <div className="space-y-1.5">
              {sections.map((s, i) => {
                const hasRef = !!s.designRef?.dnaId;
                return (
                  <div key={s.id || i} className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSectionClick(i)}
                      className={`flex-1 text-left p-2 rounded-lg transition-all ${
                        i === currentIndex
                          ? "bg-[#7c3aed]/10 border border-[#7c3aed]/30"
                          : "hover:bg-[#f5f0e8] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block w-4 text-center flex-shrink-0 ${
                            s.status === "done"
                              ? "text-green-600"
                              : s.status === "skipped"
                              ? "text-gray-400"
                              : "text-[#C49A6C]"
                          }`}
                          style={{ fontSize: 12 }}
                        >
                          {s.status === "done"
                            ? "✓"
                            : s.status === "skipped"
                            ? "−"
                            : "○"}
                        </span>
                        <span className="text-[12px] font-medium text-[#5A4E3A] truncate flex-1">
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 ml-5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            hasRef
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {hasRef ? "参照あり" : "参照なし"}
                        </span>
                        {saveSuccess === i && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            保存済み
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200/60">
              <p className="text-[12px] text-red-600">{error}</p>
              <button
                onClick={() => setError("")}
                className="text-[10px] text-red-400 mt-1 hover:text-red-600"
              >
                閉じる
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#E8D5B0]/30 space-y-2">
          {/* Generate button for no-reference sections */}
          {current?.status === "pending" && !current?.designRef?.dnaId && (
            <>
              <button
                onClick={() => handleGenerateSection(currentIndex)}
                disabled={generatingIdx !== null}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-95"
              >
                {generatingIdx === currentIndex
                  ? "デザイン生成中..."
                  : `「${current.label}」のデザインを生成`}
              </button>
              <p className="text-[10px] text-[#C49A6C] text-center leading-relaxed">
                プロジェクトのベースカラー・フォントを継承して AI が生成します
              </p>
            </>
          )}

          {current?.status === "generating" && (
            <div className="flex flex-col items-center py-4">
              <div className="w-8 h-8 border-3 border-[#7c3aed]/20 border-t-[#7c3aed] rounded-full animate-spin" />
              <p className="text-[12px] text-[#7c3aed] mt-2 font-semibold">
                生成中...
              </p>
            </div>
          )}

          {/* Save to library */}
          {current?.status === "done" && current?.html && (
            <button
              onClick={() => handleSaveToLibrary(currentIndex)}
              disabled={saving}
              className="w-full py-2 rounded-xl border border-[#D4A76A]/40 text-[#8B6914] text-[12px] font-semibold hover:bg-[#D4A76A]/10 transition-all disabled:opacity-50"
            >
              {saving
                ? "保存中..."
                : saveSuccess === currentIndex
                ? "ライブラリに保存済み"
                : "このセクションをライブラリに保存"}
            </button>
          )}

          {/* Complete → Step 6 */}
          {allDone && approvedCount > 0 && (
            <button
              onClick={handleAssemble}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[14px] font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              最終最適化へ →
            </button>
          )}

          <button
            onClick={onBack}
            className="w-full py-2 rounded-xl border border-[#D4A76A]/30 bg-white/50 text-[#8A7E6B] text-[12px] font-semibold hover:bg-white/80 transition-all"
          >
            ← 戻る
          </button>
        </div>
      </div>
    </div>
  );
}
