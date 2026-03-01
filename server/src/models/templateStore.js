const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "../../data");
const TEMPLATE_FILE = path.join(DATA_DIR, "templates.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readTemplates() {
  ensureDataDir();
  if (!fs.existsSync(TEMPLATE_FILE)) return [];
  return JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf-8"));
}

function writeTemplates(templates) {
  ensureDataDir();
  fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(templates, null, 2), "utf-8");
}

/**
 * design ハッシュでキャッシュを検索
 * @param {string} dnaHash - SHA-256 ハッシュ
 * @returns {object|null}
 */
function findByHash(dnaHash) {
  return readTemplates().find((t) => t.dnaHash === dnaHash) || null;
}

/**
 * AI 生成結果を保存
 */
function saveGeneratedCode({ dnaHash, dnaId, componentCode, previewHtml, colorMap, createdBy }) {
  const templates = readTemplates();
  const record = {
    id: crypto.randomUUID(),
    dnaHash,
    dnaId,
    componentCode,
    previewHtml,
    colorMap,
    isTemplate: false,
    templateMeta: null,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  templates.push(record);
  writeTemplates(templates);
  return record;
}

/**
 * マスターテンプレートとして登録 (admin のみ)
 */
function registerAsTemplate(id, { name, description, category, registeredBy }) {
  const templates = readTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  templates[idx].isTemplate = true;
  templates[idx].templateMeta = {
    name,
    description: description || "",
    category: category || "other",
    registeredBy,
    registeredAt: new Date().toISOString(),
  };
  writeTemplates(templates);
  return templates[idx];
}

/**
 * テンプレート登録を解除
 */
function unregisterTemplate(id) {
  const templates = readTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  templates[idx].isTemplate = false;
  templates[idx].templateMeta = null;
  writeTemplates(templates);
  return templates[idx];
}

/**
 * 登録済みマスターテンプレート一覧（コード本体省略で軽量化）
 */
function getAllTemplates() {
  return readTemplates()
    .filter((t) => t.isTemplate)
    .map(({ componentCode, previewHtml, ...summary }) => ({
      ...summary,
      codePreview: componentCode?.slice(0, 200) || "",
    }));
}

/**
 * ID でテンプレートを取得（全フィールド）
 */
function getTemplateById(id) {
  return readTemplates().find((t) => t.id === id) || null;
}

/**
 * 登録済みマスターテンプレート一覧（コード本体含む）
 */
function getAllTemplatesFull() {
  return readTemplates().filter((t) => t.isTemplate);
}

/**
 * テンプレートの名前を更新
 */
function updateTemplateName(id, name) {
  const templates = readTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  if (templates[idx].templateMeta) {
    templates[idx].templateMeta.name = name;
  }
  writeTemplates(templates);
  return templates[idx];
}

module.exports = {
  readTemplates,
  findByHash,
  saveGeneratedCode,
  registerAsTemplate,
  unregisterTemplate,
  getAllTemplates,
  getAllTemplatesFull,
  getTemplateById,
  updateTemplateName,
};
