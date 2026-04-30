import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(BASE_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "payments.db");

async function getDb() {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
}

async function initAuthDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await db.close();
}

function hashPassword(password, saltHex) {
  return crypto
    .pbkdf2Sync(password, Buffer.from(saltHex, "hex"), 100_000, 32, "sha256")
    .toString("hex");
}

function isValidEmail(email) {
  return email.includes("@") && email.includes(".");
}

async function getUserIdFromBearerToken(req) {
  const authorization = String(req.headers.authorization ?? "");
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.replace("Bearer ", "").trim();
  if (!token) {
    return null;
  }

  const db = await getDb();
  const tokenRow = await db.get(
    "SELECT user_id FROM auth_tokens WHERE token = ?",
    [token],
  );
  await db.close();

  return tokenRow?.user_id ?? null;
}

await initAuthDb();

router.options("/auth/register", (_req, res) => res.sendStatus(204));
router.options("/auth/login", (_req, res) => res.sendStatus(204));
router.options("/auth/api-keys", (_req, res) => res.sendStatus(204));
router.options("/auth/api-keys/list", (_req, res) => res.sendStatus(204));

router.post("/auth/register", async (req, res) => {
  const data = req.body ?? {};
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "invalid email" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "password must be at least 6 characters" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  const db = await getDb();
  try {
    await db.run(
      "INSERT INTO users (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)",
      [email, passwordHash, salt, Math.floor(Date.now() / 1000)],
    );
  } catch (error) {
    await db.close();
    if (String(error).includes("UNIQUE")) {
      return res.status(409).json({ error: "email already registered" });
    }
    return res.status(500).json({ error: "internal error" });
  }
  await db.close();

  return res.status(201).json({ message: "registration successful" });
});

router.post("/auth/login", async (req, res) => {
  const data = req.body ?? {};
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const db = await getDb();
  const user = await db.get(
    "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?",
    [email],
  );
  await db.close();

  if (!user) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const expectedHash = hashPassword(password, user.password_salt);
  if (!crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(user.password_hash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const tokenDb = await getDb();
  await tokenDb.run(
    "INSERT OR REPLACE INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)",
    [token, user.id, Math.floor(Date.now() / 1000)],
  );
  await tokenDb.close();

  return res.status(200).json({
    message: "login successful",
    token,
    user: { id: user.id, email: user.email },
  });
});

router.post("/auth/api-keys", async (req, res) => {
  const data = req.body ?? {};
  const name = String(data.name ?? "").trim();

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const db = await getDb();
  const user = await db.get("SELECT id FROM users WHERE id = ?", [userId]);
  if (!user) {
    await db.close();
    return res.status(404).json({ error: "user not found" });
  }

  const apiKey = crypto.randomBytes(24).toString("hex");
  await db.run(
    "INSERT INTO api_keys (user_id, name, api_key, created_at) VALUES (?, ?, ?, ?)",
    [userId, name, apiKey, Math.floor(Date.now() / 1000)],
  );
  await db.close();

  return res.status(201).json({
    message: "api key created",
    name,
    api_key: apiKey,
  });
});

router.get("/auth/api-keys/list", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const db = await getDb();
  const rows = await db.all(
    "SELECT id, name, api_key, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  await db.close();

  return res.status(200).json({ api_keys: rows });
});

export { router as authRouter };
