const express = require("express");
const cors = require("cors");
const dnaRoutes = require("./routes/dna");
const { closeBrowser } = require("./services/dnaExtractor");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

// ヘルスチェック
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "oasis-server" });
});

// DNA 抽出 API
app.use("/api/dna", dnaRoutes);

const server = app.listen(PORT, () => {
  console.log(`🌿 Oasis Server listening on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down...");
  await closeBrowser();
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
