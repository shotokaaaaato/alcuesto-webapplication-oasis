import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const MENU_CARDS = [
  // ── 第0グループ（ページ制作） ──
  {
    id: "compose",
    title: "ページ制作",
    desc: "構成先行型ワークフローで AI × Figma デザインから 1 枚のページを構築",
    icon: "📐",
    color: "from-[#7c3aed] to-[#6d28d9]",
    span: "col-span-2",
  },
  // ── 第1グループ（インポート系） ──
  {
    id: "dna",
    title: "Figma インポート",
    desc: "全ページを一覧化。既存デザインを元に下層ページを AI 生成",
    icon: "🎨",
    color: "from-[#3aafc9] to-[#2a8fa9]",
    span: "col-span-2",
  },
  {
    id: "url-import",
    title: "URL インポート",
    desc: "Web ページを 3 ビューポートで解析し完全再現データとして保存",
    icon: "🌐",
    color: "from-[#3b82f6] to-[#2563eb]",
    span: "col-span-1",
    adminOnly: true,
  },
  // ── 第2グループ（資産・分析系） ──
  {
    id: "parts",
    title: "パーツ一覧",
    desc: "テンプレートパーツを管理。Figma データ・コード Zip エクスポート",
    icon: "🧩",
    color: "from-[#ef4444] to-[#dc2626]",
    span: "col-span-1",
  },
  {
    id: "code-library",
    title: "コードライブラリ",
    desc: "AI 生成コードの一覧管理・Zip エクスポート",
    icon: "📋",
    color: "from-[#D4A76A] to-[#B8944C]",
    span: "col-span-1",
  },
  {
    id: "library",
    title: "デザインライブラリ",
    desc: "抽出した Figma デザインとアセットの管理・閲覧",
    icon: "📚",
    color: "from-[#f59e0b] to-[#d97706]",
    span: "col-span-1",
  },
  {
    id: "analytics",
    title: "OASIS アナリティクス",
    desc: "制作傾向を 3D 空間で可視化。デザインの自己分析",
    icon: "📊",
    color: "from-[#7ab83e] to-[#5a9828]",
    span: "col-span-1",
  },
  // ── 第3グループ（設定・ガイド系） ──
  {
    id: "figma-guide",
    title: "Figmaプラグインについて",
    desc: "プラグインのダウンロード・インストール手順と JWT 認証",
    icon: "🔌",
    color: "from-[#a259ff] to-[#7c3aed]",
    span: "col-span-1",
  },
  {
    id: "settings",
    title: "環境設定",
    desc: "AI プロバイダー API キー・Figma トークンの管理",
    icon: "⚙️",
    color: "from-[#6B7280] to-[#4B5563]",
    span: "col-span-1",
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

  const isAdmin = user?.role === "admin";
  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  function handleCardClick(id) {
    if (id === "compose") navigate("/compose");
    if (id === "dna") navigate("/figma-import");
    if (id === "analytics") navigate("/analytics");
    if (id === "figma-guide") navigate("/figma-guide");
    if (id === "code-library") navigate("/code-library");
    if (id === "parts") navigate("/parts");
    if (id === "library") navigate("/library");
    if (id === "settings") navigate("/settings");
    if (id === "url-import") navigate("/url-import");
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div
      className="min-h-screen w-screen bg-[#FAF3E6]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
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
            <span className="text-[12px] text-[#C49A6C] tracking-wide border-l border-[#D4A76A]/30 pl-3">
              Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <span className="px-2 py-0.5 text-[12px] font-bold rounded-full bg-[#FFD700]/20 text-[#8B6914] border border-[#FFD700]/40 tracking-wider">
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
          {MENU_CARDS.filter(card => !card.adminOnly || isAdmin).map((card) => (
            <motion.div
              key={card.id}
              variants={cardVariants}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.97 }}
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
                  <span className="text-3xl block mb-3">
                    {card.icon}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {card.title}
                  </h3>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </main>
    </div>
  );
}
