const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "../../data");
const DNA_FILE = path.join(DATA_DIR, "dna-library.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDnaLibrary() {
  ensureDataDir();
  if (!fs.existsSync(DNA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DNA_FILE, "utf-8"));
}

function writeDnaLibrary(library) {
  ensureDataDir();
  fs.writeFileSync(DNA_FILE, JSON.stringify(library, null, 2), "utf-8");
}

/**
 * 抽出したデザインデータを永続化する
 * @param {{ url: string, userId: string, elements: object[], name?: string }} params
 * @returns {object} 保存されたレコード
 */
function saveDna({ url, userId, elements, name, masterImage, type, deviceFrames }) {
  const library = readDnaLibrary();
  const record = {
    id: crypto.randomUUID(),
    url,
    userId,
    name: name || "",
    elements,
    elementCount: elements.length,
    masterImage: masterImage || null,
    type: type || "graphic",
    deviceFrames: deviceFrames || null,
    pageStructure: null,
    savedAt: new Date().toISOString(),
  };
  library.push(record);
  writeDnaLibrary(library);
  return record;
}

/**
 * 最新の保存済みデザインレコードを取得
 * @returns {object|null}
 */
function getLatestDna() {
  const library = readDnaLibrary();
  if (library.length === 0) return null;
  return library[library.length - 1];
}

/**
 * 保存済みデザイン一覧を取得（elements省略で軽量化）
 * @returns {object[]}
 */
function getAllDna() {
  return readDnaLibrary().map(({ elements, ...summary }) => summary);
}

/**
 * 保存済みデザイン一覧を取得（elements含む完全版）
 * @returns {object[]}
 */
function getAllDnaFull() {
  return readDnaLibrary();
}

/**
 * IDで特定のデザインレコードを取得
 * @param {string} id
 * @returns {object|null}
 */
function getDnaById(id) {
  return readDnaLibrary().find((d) => d.id === id) || null;
}

/**
 * IDで特定のデザインレコードを削除
 * @param {string} id
 * @returns {boolean} 削除成功なら true
 */
function deleteDnaById(id) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  cleanupMasterImage(library[idx]);
  library.splice(idx, 1);
  writeDnaLibrary(library);
  return true;
}

/**
 * IDでデザインレコードの名前を更新
 * @param {string} id
 * @param {string} name
 * @returns {object|null} 更新後のレコード
 */
function updateDnaName(id, name) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  library[idx].name = name;
  writeDnaLibrary(library);
  return library[idx];
}

/**
 * IDでデザインレコードのマスター画像を更新
 * @param {string} id
 * @param {{ filename: string, width: number, height: number, scale: number }} masterImage
 * @returns {object|null} 更新後のレコード
 */
function updateDnaMasterImage(id, masterImage) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  library[idx].masterImage = masterImage;
  writeDnaLibrary(library);
  return library[idx];
}

/**
 * マスター画像ファイルを削除するヘルパー
 */
function cleanupMasterImage(record) {
  if (record.masterImage?.filename) {
    const imgPath = path.join(DATA_DIR, "images", record.masterImage.filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  if (record.deviceFrames) {
    for (const device of ["pc", "sp"]) {
      const frame = record.deviceFrames[device];
      if (frame?.masterImage?.filename) {
        const imgPath = path.join(DATA_DIR, "images", frame.masterImage.filename);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
    }
  }
}

/**
 * IDでデザインレコードのロック済みパーツを更新
 * @param {string} id
 * @param {Array<{elementIndex: number, role: string, label: string}>} lockedParts
 * @returns {object|null} 更新後のレコード
 */
function updateDnaLockedParts(id, lockedParts) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  library[idx].lockedParts = lockedParts;
  writeDnaLibrary(library);
  return library[idx];
}

/**
 * IDでデザインレコードのtype(web/graphic)を更新
 * @param {string} id
 * @param {"web"|"graphic"} type
 * @returns {object|null}
 */
function updateDnaType(id, type) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  library[idx].type = type;
  writeDnaLibrary(library);
  return library[idx];
}

/**
 * IDでデザインレコードのデバイスフレーム情報を更新
 * @param {string} id
 * @param {{ pc?: { nodeId, name, elements, masterImage }, sp?: { nodeId, name, elements, masterImage } }} deviceFrames
 * @returns {object|null}
 */
function updateDnaDeviceFrames(id, deviceFrames) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  library[idx].deviceFrames = deviceFrames;
  writeDnaLibrary(library);
  return library[idx];
}

/**
 * IDでデザインレコードのページ構成情報を更新
 * @param {string} id
 * @param {{ parts: Array<{ id, role, label, region, elementIndices, mode, order }>, savedAt?: string }} pageStructure
 * @returns {object|null}
 */
function updateDnaPageStructure(id, pageStructure) {
  const library = readDnaLibrary();
  const idx = library.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  library[idx].pageStructure = pageStructure;
  writeDnaLibrary(library);
  return library[idx];
}

/**
 * 複数IDのデザインレコードを一括削除
 * @param {string[]} ids
 * @returns {number} 削除件数
 */
function deleteDnaByIds(ids) {
  const idSet = new Set(ids);
  const library = readDnaLibrary();
  const before = library.length;
  library.filter((d) => idSet.has(d.id)).forEach(cleanupMasterImage);
  const filtered = library.filter((d) => !idSet.has(d.id));
  writeDnaLibrary(filtered);
  return before - filtered.length;
}

module.exports = { readDnaLibrary, saveDna, getLatestDna, getAllDna, getAllDnaFull, getDnaById, updateDnaName, updateDnaLockedParts, updateDnaMasterImage, updateDnaType, updateDnaDeviceFrames, updateDnaPageStructure, deleteDnaById, deleteDnaByIds };
