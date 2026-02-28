import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const MENU_CARDS = [
  {
    id: "dna",
    title: "DNA採取",
    desc: "WebサイトのURLからデザインDNAを抽出",
    icon: "🧬",
    color: "from-[#3aafc9] to-[#2a8fa9]",
    span: "col-span-2",
  },
  {
    id: "canvas",
    title: "3Dキャンバス",
    desc: "DNAをテラリウム空間で可視化",
    icon: "🎨",
    color: "from-[#7ab83e] to-[#5a9828]",
    span: "col-span-1",
  },
  {
    id: "figma",
    title: "Figma連携",
    desc: "デザインをFigmaに直接エクスポート",
    icon: "🔗",
    color: "from-[#a259ff] to-[#7c3aed]",
    span: "col-span-1",
  },
  {
    id: "export",
    title: "コード出力",
    desc: "CSSコードとしてエクスポート",
    icon: "📋",
    color: "from-[#D4A76A] to-[#B8944C]",
    span: "col-span-1",
  },
  {
    id: "settings",
    title: "環境設定",
    desc: "バイオームやテーマのカスタマイズ",
    icon: "⚙️",
    color: "from-[#6B7280] to-[#4B5563]",
    span: "col-span-1",
  },
  {
    id: "library",
    title: "DNAライブラリ",
    desc: "保存したDNAコレクションを管理",
    icon: "📚",
    color: "from-[#f59e0b] to-[#d97706]",
    span: "col-span-2",
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [hoveredId, setHoveredId] = useState(null);

  const isAdmin = user?.role === "admin";
  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  function handleCardClick(id) {
    if (id === "canvas") {
      navigate("/canvas");
    }
    // TODO: 各サービスへの遷移
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}
    >
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="text-xl font-bold text-[#8B6914] tracking-widest"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              OASIS
            </h1>
            <span className="text-[10px] text-[#C49A6C] tracking-wide border-l border-[#D4A76A]/30 pl-3">
              Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FFD700]/20 text-[#8B6914] border border-[#FFD700]/40 tracking-wider">
                ADMIN
              </span>
            )}
            <span className="text-xs text-[#8A7E6B]">{user?.name || user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-[#8B6914]/60 hover:text-[#8B6914] transition-colors"
            >
              ログアウト
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${
              isAdmin
                ? "bg-gradient-to-br from-[#FFD700] to-[#D4A76A]"
                : "bg-gradient-to-br from-[#D4A76A] to-[#C49A5C]"
            }`}>
              {initial}
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ウェルカムセクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-[#5A4E3A]">
            おかえりなさい{user?.name ? `、${user.name}` : ""}
          </h2>
          <p className="text-sm text-[#8A7E6B] mt-1">
            {isAdmin
              ? "管理者としてログイン中 — すべての機能にアクセスできます"
              : "あなたのデジタルテラリウムを育てましょう"}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-4 gap-4 auto-rows-[180px]"
        >
          {MENU_CARDS.map((card) => (
            <motion.div
              key={card.id}
              variants={cardVariants}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.97 }}
              onHoverStart={() => setHoveredId(card.id)}
              onHoverEnd={() => setHoveredId(null)}
              onClick={() => handleCardClick(card.id)}
              className={`${card.span} relative rounded-2xl cursor-pointer overflow-hidden group`}
            >
              {/* グラデーション背景 */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-90 group-hover:opacity-100 transition-opacity duration-300`}
              />

              {/* ノイズテクスチャ風のオーバーレイ */}
              <div className="absolute inset-0 bg-white/5" />

              {/* コンテンツ */}
              <div className="relative z-10 h-full p-6 flex flex-col justify-between">
                <div>
                  <motion.span
                    className="text-3xl block mb-3"
                    animate={
                      hoveredId === card.id
                        ? { scale: 1.2, rotate: [0, -10, 10, 0] }
                        : { scale: 1, rotate: 0 }
                    }
                    transition={{ duration: 0.4 }}
                  >
                    {card.icon}
                  </motion.span>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {card.title}
                  </h3>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              {/* ホバー時の光沢エフェクト */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none"
                initial={{ x: "-100%" }}
                animate={hoveredId === card.id ? { x: "100%" } : { x: "-100%" }}
                transition={{ duration: 0.6 }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* 最近の活動（プレースホルダー） */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 p-6 rounded-2xl bg-white/50 border border-[#E8D5B0]/50"
        >
          <h3 className="text-sm font-semibold text-[#8B6914] mb-3">最近の活動</h3>
          <div className="space-y-3">
            {[
              { text: "example.com のDNAを採取しました", time: "2分前" },
              { text: "砂漠バイオームでテラリウムを更新", time: "1時間前" },
              { text: "CSSコードをエクスポートしました", time: "昨日" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-[#E8D5B0]/30 last:border-b-0"
              >
                <span className="text-sm text-[#5A4E3A]">{item.text}</span>
                <span className="text-xs text-[#C49A6C]">{item.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
