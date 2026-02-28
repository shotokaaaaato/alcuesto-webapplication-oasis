const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { findByEmail, createUser, getAllUsers } = require("../models/userStore");
const { signToken, verifyToken, requireAdmin } = require("../middleware/auth");

const router = Router();

/* POST /api/auth/register */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password は必須です" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "パスワードは6文字以上にしてください" });
    }
    if (findByEmail(email)) {
      return res.status(409).json({ error: "このメールアドレスは既に登録されています" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({ name, email, passwordHash });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

/* POST /api/auth/login */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email, password は必須です" });
    }
    const user = findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

/* GET /api/auth/me — 現在のユーザー情報 */
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

/* GET /api/auth/users — 管理者のみ:全ユーザー一覧 */
router.get("/users", verifyToken, requireAdmin, (_req, res) => {
  res.json({ users: getAllUsers() });
});

module.exports = router;
