import JSZip from "jszip";

/**
 * 複数ファイルを Zip にまとめてダウンロード
 * @param {{ name: string, content: string }[]} files
 * @param {string} zipName — 出力 Zip ファイル名
 */
export async function downloadAsZip(files, zipName = "oasis-export.zip") {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}
