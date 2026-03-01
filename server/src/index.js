const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const dnaRoutes = require("./routes/dna");
const authRoutes = require("./routes/auth");
const figmaRoutes = require("./routes/figma");
const exportRoutes = require("./routes/export");
const analyticsRoutes = require("./routes/analytics");
const composeRoutes = require("./routes/compose");
const { findByEmail, createUser } = require("./models/userStore");
const { closeBrowser } = require("./services/dnaExtractor");

const app = express();
const PORT = process.env.PORT || 4000;

// CORS: クライアント + Figma Plugin iframe (origin: null) を許可
app.use(
  cors({
    origin: function (origin, callback) {
      const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
      // Figma Plugin iframe は sandboxed (origin: null/undefined)
      if (!origin || origin === clientOrigin) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());

// マスター画像の静的配信
app.use("/api/images", express.static(path.join(__dirname, "../data/images")));

// ヘルスチェック
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "oasis-server" });
});

// 認証 API
app.use("/api/auth", authRoutes);

// デザイン抽出 API
app.use("/api/dna", dnaRoutes);

// Figma 連携 API
app.use("/api/figma", figmaRoutes);

// Semantic Exporter API
app.use("/api/export", exportRoutes);

// Analytics API
app.use("/api/analytics", analyticsRoutes);

// Composition Wizard API
app.use("/api/compose", composeRoutes);

// 管理者シード
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@oasis.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  if (!findByEmail(email)) {
    const passwordHash = await bcrypt.hash(password, 10);
    createUser({ name: "Admin", email, passwordHash, role: "admin" });
    console.log(`🔑 Admin account created: ${email}`);
  } else {
    console.log(`🔑 Admin account exists: ${email}`);
  }
}

const server = app.listen(PORT, async () => {
  console.log(`🌿 Oasis Server listening on port ${PORT}`);
  await seedAdmin();
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down...");
  await closeBrowser();
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
