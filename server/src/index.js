const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const dnaRoutes = require("./routes/dna");
const authRoutes = require("./routes/auth");
const { findByEmail, createUser } = require("./models/userStore");
const { closeBrowser } = require("./services/dnaExtractor");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

// ヘルスチェック
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "oasis-server" });
});

// 認証 API
app.use("/api/auth", authRoutes);

// DNA 抽出 API
app.use("/api/dna", dnaRoutes);

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
