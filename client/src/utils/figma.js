/** Figma URL regex — matches both /file/ and /design/ URL formats */
export const FIGMA_URL_REGEX =
  /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/;

/** Extract Figma file key from a URL. Returns null if not a valid Figma URL. */
export function extractFigmaFileKey(url) {
  const m = (url || "").match(FIGMA_URL_REGEX);
  return m ? m[1] : null;
}
