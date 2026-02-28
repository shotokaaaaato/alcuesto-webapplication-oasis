const jwt = require("jsonwebtoken");
const { findById } = require("../models/userStore");

const JWT_SECRET = process.env.JWT_SECRET || "oasis-dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = findById(payload.id);
    if (!user) return res.status(401).json({ error: "ユーザーが見つかりません" });
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: "トークンが無効です" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "管理者権限が必要です" });
  }
  next();
}

module.exports = { signToken, verifyToken, requireAdmin, JWT_SECRET };
