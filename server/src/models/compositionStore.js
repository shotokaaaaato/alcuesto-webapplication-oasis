const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "../../data");
const COMP_FILE = path.join(DATA_DIR, "composition-projects.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readProjects() {
  ensureDataDir();
  if (!fs.existsSync(COMP_FILE)) return [];
  return JSON.parse(fs.readFileSync(COMP_FILE, "utf-8"));
}

function writeProjects(projects) {
  ensureDataDir();
  fs.writeFileSync(COMP_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

/**
 * 新規プロジェクトを保存
 */
function saveProject({ pageName, aiModel, imageMode, sections, finalHtml, finalCode, optimizedHtml, userId }) {
  const projects = readProjects();
  const record = {
    id: crypto.randomUUID(),
    pageName,
    aiModel: aiModel || "deepseek",
    imageMode: imageMode || "unsplash",
    sections: sections || [],
    finalHtml: finalHtml || "",
    finalCode: finalCode || "",
    optimizedHtml: optimizedHtml || null,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.push(record);
  writeProjects(projects);
  return record;
}

/**
 * IDでプロジェクトを取得
 */
function getProjectById(id) {
  return readProjects().find((p) => p.id === id) || null;
}

/**
 * 全プロジェクト一覧（sections省略で軽量化）
 */
function getAllProjects() {
  return readProjects().map(({ sections, finalHtml, finalCode, optimizedHtml, ...summary }) => summary);
}

/**
 * 全プロジェクト一覧（完全版）
 */
function getAllProjectsFull() {
  return readProjects();
}

/**
 * プロジェクト更新
 */
function updateProject(id, updates) {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  Object.assign(projects[idx], updates, { updatedAt: new Date().toISOString() });
  writeProjects(projects);
  return projects[idx];
}

/**
 * プロジェクト削除
 */
function deleteProject(id) {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  projects.splice(idx, 1);
  writeProjects(projects);
  return true;
}

module.exports = { saveProject, getProjectById, getAllProjects, getAllProjectsFull, updateProject, deleteProject };
