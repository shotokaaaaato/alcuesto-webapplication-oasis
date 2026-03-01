import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import JSZip from "jszip";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function FigmaGuidePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API}/api/figma/plugin-files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const zip = new JSZip();
      const folder = zip.folder("oasis-sync-tool");
      for (const file of data.files) {
        folder.file(file.name, file.content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "oasis-sync-tool.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("ダウンロードに失敗しました: " + err.message);
    } finally {
      setDownloading(false);
    }
  }, [token]);

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: "15px" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-3xl mx-auto px-8 py-5 flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[15px] text-[#C49A6C] hover:text-[#8B6914] transition-colors"
          >
            ← ダッシュボード
          </button>
          <h1
            className="text-xl font-bold text-[#8B6914] tracking-wider"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Figma 書き出しツール
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-10 space-y-10">
        {/* 概要 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="p-8 rounded-2xl bg-gradient-to-r from-[#a259ff]/5 to-[#7c3aed]/5 border border-[#a259ff]/20"
        >
          <h2
            className="text-lg font-bold text-[#7c3aed] mb-3"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            OASIS Sync Tool
          </h2>
          <p className="text-[15px] text-[#5A4E3A] leading-[1.9]">
            デザイン・パーツを Figma へ書き出すためのツールです。
            OASIS で作成したカラーパレットやタイポグラフィを Figma の Local Styles として自動登録できます。
            すべての Figma プラン（無料含む）で利用可能です。
          </p>
        </motion.section>

        {/* ダウンロード */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="p-8 rounded-2xl bg-white/60 border border-[#E8D5B0]/50 text-center"
        >
          <p className="text-[15px] text-[#5A4E3A] mb-5">
            まずはプラグインをダウンロードしてください。
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed]
                       text-white font-bold text-base shadow-lg
                       hover:shadow-xl transition-all active:scale-95
                       disabled:opacity-50 disabled:cursor-wait"
          >
            {downloading ? "準備中..." : "プラグインをダウンロード (.zip)"}
          </button>
          <p className="text-[13px] text-[#8A7E6B] mt-3">
            manifest.json / code.js / ui.html の 3 ファイルが含まれます
          </p>
        </motion.section>

        {/* セットアップ手順 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="p-8 rounded-2xl bg-white/60 border border-[#E8D5B0]/50"
        >
          <h2
            className="text-lg font-bold text-[#5A4E3A] mb-8"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            セットアップ手順
          </h2>

          <div className="space-y-10">
            {/* Step 1 */}
            <div className="flex gap-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] flex items-center justify-center text-white text-lg font-bold shadow-sm">
                1
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-[15px] font-bold text-[#5A4E3A] mb-2">
                  ダウンロード & 解凍
                </h3>
                <p className="text-[15px] text-[#6B5E4F] leading-[1.9]">
                  上のボタンから <strong>oasis-sync-tool.zip</strong> をダウンロードし、
                  お好きな場所に解凍してください。
                  フォルダ内に <code className="px-1.5 py-0.5 bg-[#F5E6C8]/60 rounded text-[13px]">manifest.json</code> が入っていることを確認します。
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] flex items-center justify-center text-white text-lg font-bold shadow-sm">
                2
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-[15px] font-bold text-[#5A4E3A] mb-2">
                  Figma に追加
                </h3>
                <p className="text-[15px] text-[#6B5E4F] leading-[1.9]">
                  Figma デスクトップアプリを開き、メニューから
                </p>
                <div className="mt-3 px-4 py-3 rounded-xl bg-[#FAF3E6] border border-[#E8D5B0]/50 text-[13px] text-[#5A4E3A]">
                  プラグイン → 開発 → マニフェストからプラグインをインポート...
                </div>
                <p className="text-[15px] text-[#6B5E4F] leading-[1.9] mt-3">
                  を選び、解凍したフォルダ内の <code className="px-1.5 py-0.5 bg-[#F5E6C8]/60 rounded text-[13px]">manifest.json</code> を指定してください。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#a259ff] to-[#7c3aed] flex items-center justify-center text-white text-lg font-bold shadow-sm">
                3
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-[15px] font-bold text-[#5A4E3A] mb-2">
                  同期を実行
                </h3>
                <p className="text-[15px] text-[#6B5E4F] leading-[1.9]">
                  Figma 上で <strong>プラグイン → OASIS Sync Tool</strong> を起動し、
                  認証トークンを貼り付けて同期を実行してください。
                </p>
                <button
                  onClick={() => navigate("/settings")}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#a259ff] to-[#7c3aed]
                             text-white text-[15px] font-bold shadow-sm
                             hover:shadow-md transition-all active:scale-95"
                >
                  環境設定でトークンを設定 →
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
