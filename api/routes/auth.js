import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import pool from "../db.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(BASE_DIR, ".env") });

async function initAuthDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
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

  const result = await pool.query(
    "SELECT user_id FROM auth_tokens WHERE token = $1",
    [token],
  );

  return result.rows[0]?.user_id ?? null;
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

  try {
    await pool.query(
      "INSERT INTO users (email, password_hash, password_salt, created_at) VALUES ($1, $2, $3, $4)",
      [email, passwordHash, salt, Math.floor(Date.now() / 1000)],
    );
  } catch (error) {
    if (String(error).includes("unique") || String(error).includes("duplicate")) {
      return res.status(409).json({ error: "email already registered" });
    }
    return res.status(500).json({ error: "internal error" });
  }

  return res.status(201).json({ message: "registration successful" });
});

router.post("/auth/login", async (req, res) => {
  const data = req.body ?? {};
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const result = await pool.query(
    "SELECT id, email, password_hash, password_salt FROM users WHERE email = $1",
    [email],
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const expectedHash = hashPassword(password, user.password_salt);
  if (!crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(user.password_hash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = crypto.randomBytes(24).toString("hex");
  await pool.query(
    "INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (token) DO UPDATE SET user_id = $2, created_at = $3",
    [token, user.id, Math.floor(Date.now() / 1000)],
  );

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

  const userResult = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: "user not found" });
  }

  const apiKey = crypto.randomBytes(24).toString("hex");
  await pool.query(
    "INSERT INTO api_keys (user_id, name, api_key, created_at) VALUES ($1, $2, $3, $4)",
    [userId, name, apiKey, Math.floor(Date.now() / 1000)],
  );

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

  const result = await pool.query(
    "SELECT id, name, api_key, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );

  return res.status(200).json({ api_keys: result.rows });
});

export { router as authRouter };
