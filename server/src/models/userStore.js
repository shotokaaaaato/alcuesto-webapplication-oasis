const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

function writeUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function findByEmail(email) {
  return readUsers().find((u) => u.email === email) || null;
}

function findById(id) {
  return readUsers().find((u) => u.id === id) || null;
}

function createUser({ name, email, passwordHash, role = "user" }) {
  const users = readUsers();
  if (users.some((u) => u.email === email)) return null;
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function getAllUsers() {
  return readUsers().map(({ passwordHash, ...rest }) => rest);
}

module.exports = { findByEmail, findById, createUser, getAllUsers };
