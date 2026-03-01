import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const isRegister = searchParams.get("mode") === "register";
  const [mode, setMode] = useState(isRegister ? "register" : "login");

  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register(form.name, form.email, form.password);
      } else {
        await login(form.email, form.password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center bg-[#F0C878] relative overflow-hidden"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}
    >
      {/* 背景装飾 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#FFD700]/10 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#3aafc9]/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* カード */}
        <div className="bg-[#FFF8E7]/90 backdrop-blur-xl rounded-2xl border border-[#D4A76A]/30 shadow-2xl overflow-hidden">
          {/* ヘッダー */}
          <div className="px-8 pt-8 pb-4 text-center">
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-3xl font-bold text-[#8B6914] tracking-widest"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              OASIS
            </motion.h1>
            <p className="text-xs text-[#C49A6C] mt-1 tracking-wide">
              デザインのデジタルテラリウム
            </p>
          </div>

          {/* タブ切替 */}
          <div className="flex mx-8 mb-4 rounded-lg bg-[#E8D5B0]/50 p-1">
            {[
              { id: "login", label: "ログイン" },
              { id: "register", label: "新規登録" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setMode(tab.id); setError(""); }}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-all duration-300 ${
                  mode === tab.id
                    ? "bg-white text-[#8B6914] shadow-sm"
                    : "text-[#C49A6C] hover:text-[#8B6914]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mx-8 mb-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <label className="block text-xs font-medium text-[#8B6914] mb-1.5">
                  ユーザー名
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="your name"
                  className="w-full px-4 py-3 rounded-lg border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#C4B89A] focus:outline-none focus:border-[#D4A76A] focus:ring-2 focus:ring-[#D4A76A]/20 transition-all"
                />
              </motion.div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#8B6914] mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-lg border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#C4B89A] focus:outline-none focus:border-[#D4A76A] focus:ring-2 focus:ring-[#D4A76A]/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8B6914] mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="********"
                className="w-full px-4 py-3 rounded-lg border border-[#D4A76A]/30 bg-white/60 text-sm text-[#5A4E3A] placeholder-[#C4B89A] focus:outline-none focus:border-[#D4A76A] focus:ring-2 focus:ring-[#D4A76A]/20 transition-all"
              />
            </div>

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.02 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
              className={`w-full py-3 rounded-lg bg-gradient-to-r from-[#D4A76A] to-[#C49A5C] text-white font-semibold text-sm tracking-wider shadow-lg transition-shadow ${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:shadow-xl"
              }`}
            >
              {submitting
                ? "処理中..."
                : mode === "login"
                ? "ログイン"
                : "アカウント作成"}
            </motion.button>

            {/* 管理者ログインヒント */}
            {mode === "login" && (
              <p className="text-[12px] text-center text-[#C49A6C]/60 mt-2">
                管理者: admin@oasis.local / admin123
              </p>
            )}
          </form>
        </div>

        {/* 戻るリンク */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <button
            onClick={() => navigate("/")}
            className="text-xs text-[#8B6914]/60 hover:text-[#8B6914] transition-colors tracking-wide"
          >
            TOPに戻る
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
