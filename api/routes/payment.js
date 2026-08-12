import { Router } from "express";
import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits } from "ethers";
import crypto from "node:crypto";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encrypt } from "../crypto.js";
import pool from "../db.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(BASE_DIR, ".env") });

const SUPPORTED_TOKENS_PATH = path.join(BASE_DIR, "config", "supported-tokens.json");
const CHECKOUT_EXPIRATION_SECONDS = 600;
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL ?? "http://localhost:3000";
const CHAIN_RPC_URLS = {
  ronin: process.env.RONIN_RPC_URL,
  ethereum: process.env.ETHEREUM_RPC_URL,
  polygon: process.env.POLYGON_RPC_URL,
  bsc: process.env.BSC_RPC_URL,
  avalanche: process.env.AVALANCHE_RPC_URL,
  base: process.env.BASE_RPC_URL,
  arbitrum: process.env.ARBITRUM_RPC_URL,
};

const SUPPORTED_TOKENS = JSON.parse(fs.readFileSync(SUPPORTED_TOKENS_PATH, "utf8"));

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getRpcUrl(chain) {
  return CHAIN_RPC_URLS[normalize(chain)];
}

function isContractAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address ?? "").trim());
}

async function getTokenBalance(chain, tokenAddress, walletAddress) {
  const rpcUrl = getRpcUrl(chain);
  if (!rpcUrl || !isContractAddress(tokenAddress)) {
    return 0;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const token = new Contract(tokenAddress, [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ], provider);
 
  const [rawBalance, decimals] = await Promise.all([
    token.balanceOf(walletAddress),
    token.decimals(),
  ]);
  return Number(formatUnits(rawBalance, decimals));
}

async function getNativeBalance(chain, walletAddress) {
  const rpcUrl = getRpcUrl(chain);
  if (!rpcUrl) {
    return 0;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const rawBalance = await provider.getBalance(walletAddress);
  return Number(formatEther(rawBalance));
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      checkout_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      amount NUMERIC NOT NULL,
      status TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      webhook_url TEXT,
      selected_payment_id INTEGER DEFAULT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      address TEXT NOT NULL,
      private_key TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      status TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      webhook_url TEXT,
      message TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      chain TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      UNIQUE(user_id, token, chain)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposit_wallets (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      chain TEXT NOT NULL,
      address TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE(user_id, token, chain, address)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS main_wallets (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      address TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS withdrawal_tasks (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL,
      source_wallet_id INTEGER NOT NULL,
      chain TEXT NOT NULL,
      token TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      destination_address TEXT NOT NULL,
      status TEXT NOT NULL,
      gas_tx_hash TEXT DEFAULT NULL,
      withdraw_tx_hash TEXT DEFAULT NULL,
      message TEXT DEFAULT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      created_at BIGINT NOT NULL,
      UNIQUE(user_id, type, entity_id)
    )
  `);
}

async function ensurePaymentColumns() {
  const result = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'payments'",
  );
  const columnNames = result.rows.map((r) => r.column_name);

  const addIfMissing = async (name, def) => {
    if (!columnNames.includes(name)) {
      await pool.query(`ALTER TABLE payments ADD COLUMN ${name} ${def}`);
    }
  };

  await addIfMissing("user_id", "INTEGER DEFAULT NULL");
  await addIfMissing("message", "TEXT DEFAULT NULL");
  await addIfMissing("checkout_id", "TEXT DEFAULT NULL");
  await addIfMissing("chain", "TEXT DEFAULT NULL");
  await addIfMissing("token", "TEXT DEFAULT NULL");
  await addIfMissing("wallet_id", "INTEGER DEFAULT NULL");
  await addIfMissing("balance_before", "NUMERIC NOT NULL DEFAULT 0");
}

await initDb();
await ensurePaymentColumns();
await backfillMainWallets();
await backfillDepositWallets();
await backfillBalances();

async function backfillBalances() {
  await pool.query(`
    INSERT INTO balances (user_id, token, chain, amount)
    SELECT user_id, token, chain, SUM(amount)
    FROM payments
    WHERE status = 'paid'
      AND user_id IS NOT NULL
      AND token IS NOT NULL
      AND chain IS NOT NULL
    GROUP BY user_id, token, chain
    ON CONFLICT (user_id, token, chain) DO NOTHING
  `);
}

async function backfillDepositWallets() {
  await pool.query(`
    INSERT INTO deposit_wallets (user_id, token, chain, address, private_key, created_at)
    SELECT DISTINCT ON (user_id, token, chain, address)
      user_id, token, chain, address, private_key, created_at
    FROM payments
    WHERE user_id IS NOT NULL
      AND token IS NOT NULL
      AND chain IS NOT NULL
      AND address IS NOT NULL
      AND private_key IS NOT NULL
    ORDER BY user_id, token, chain, address, created_at ASC
    ON CONFLICT (user_id, token, chain, address) DO NOTHING
  `);
  await pool.query(`
    UPDATE payments
    SET wallet_id = (
      SELECT deposit_wallets.id
      FROM deposit_wallets
      WHERE deposit_wallets.user_id = payments.user_id
        AND lower(deposit_wallets.token) = lower(payments.token)
        AND lower(deposit_wallets.chain) = lower(payments.chain)
        AND lower(deposit_wallets.address) = lower(payments.address)
      LIMIT 1
    )
    WHERE wallet_id IS NULL
      AND user_id IS NOT NULL
      AND token IS NOT NULL
      AND chain IS NOT NULL
  `);
}

async function backfillMainWallets() {
  const result = await pool.query("SELECT id FROM users");
  for (const user of result.rows) {
    await getOrCreateMainWallet(user.id);
  }
}

async function getUserIdFromApiKey(apiKey) {
  const result = await pool.query(
    "SELECT user_id FROM api_keys WHERE api_key = $1",
    [apiKey],
  );
  return result.rows[0]?.user_id ?? null;
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

  const result = await pool.query("SELECT user_id FROM auth_tokens WHERE token = $1", [token]);
  return result.rows[0]?.user_id ?? null;
}

async function getOrCreateMainWallet(userId) {
  const existingResult = await pool.query(
    "SELECT id, address, created_at FROM main_wallets WHERE user_id = $1",
    [userId],
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0];
  }

  const wallet = Wallet.createRandom();
  const result = await pool.query(
    "INSERT INTO main_wallets (user_id, address, private_key, created_at) VALUES ($1, $2, $3, $4) RETURNING id",
    [userId, wallet.address, encrypt(wallet.privateKey), Math.floor(Date.now() / 1000)],
  );

  return {
    id: result.rows[0].id,
    address: wallet.address,
    created_at: Math.floor(Date.now() / 1000),
  };
}

async function getOrCreateDepositWallet({ userId, chain, token, now }) {
  const reusableResult = await pool.query(
    `SELECT id, address, private_key
     FROM deposit_wallets
     WHERE user_id = $1
       AND lower(chain) = lower($2)
       AND lower(token) = lower($3)
       AND NOT EXISTS (
         SELECT 1
         FROM payments
         WHERE payments.wallet_id = deposit_wallets.id
           AND payments.status = 'waiting-payment'
           AND payments.created_at + $4 >= $5
       )
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId, chain, token, CHECKOUT_EXPIRATION_SECONDS, now],
  );

  if (reusableResult.rows.length > 0) {
    return reusableResult.rows[0];
  }

  const wallet = Wallet.createRandom();
  const encryptedKey = encrypt(wallet.privateKey);
  const result = await pool.query(
    `INSERT INTO deposit_wallets (user_id, token, chain, address, private_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, token, chain, wallet.address, encryptedKey, now],
  );

  return {
    id: result.rows[0].id,
    address: wallet.address,
    private_key: encryptedKey,
  };
}

async function createPaymentRecord({ userId, amount, chain, token, webhookUrl, now }) {
  const checkoutId = crypto.randomUUID();
  const depositWallet = await getOrCreateDepositWallet({
    userId,
    chain,
    token,
    now,
  });
  const balanceBefore = await getTokenBalance(chain, token, depositWallet.address);
  const result = await pool.query(
    `INSERT INTO payments (
      user_id, checkout_id, wallet_id, address, private_key, amount, chain, token,
      balance_before, status, created_at, webhook_url
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      userId,
      checkoutId,
      depositWallet.id,
      depositWallet.address,
      depositWallet.private_key,
      amount,
      chain,
      token,
      balanceBefore,
      "waiting-payment",
      now,
      webhookUrl,
    ],
  );

  return {
    payment_id: result.rows[0].id,
    checkout_id: checkoutId,
    address: depositWallet.address,
    amount,
    chain,
    token,
    balance_before: balanceBefore,
    checkout_url: `${CHECKOUT_BASE_URL}/checkout/${checkoutId}`,
    expires_at: now + CHECKOUT_EXPIRATION_SECONDS,
  };
}

router.get("/supported-chains", (_req, res) => {
  return res.status(200).json(SUPPORTED_TOKENS);
});

router.post("/create_payment", async (req, res) => {
  const data = req.body ?? {};
  const amount = Number(data.amount);
  const webhookUrl = data.webhook_url ?? null;
  const apiKey = String(data.api_key ?? "").trim();
  const chain = String(data.chain ?? "").trim();
  const token = String(data.token ?? "").trim();

  if (!apiKey) {
    return res.status(401).json({ error: "api_key is required" });
  }

  const userId = await getUserIdFromApiKey(apiKey);
  if (!userId) {
    return res.status(401).json({ error: "invalid api_key" });
  }

  if (!Number.isFinite(amount)) {
    return res
      .status(400)
      .json({ error: "amount is required and must be a number" });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }

  if ((chain && !token) || (!chain && token)) {
    return res.status(400).json({ error: "chain and token must be provided together" });
  }

  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + CHECKOUT_EXPIRATION_SECONDS;

  if (!chain && !token) {
    const checkoutId = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO checkout_sessions (checkout_id, user_id, amount, status, created_at, webhook_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [checkoutId, userId, amount, "selecting-payment-method", createdAt, webhookUrl],
    );

    return res.status(200).json({
      message: "Checkout created",
      session_id: result.rows[0].id,
      checkout_id: checkoutId,
      amount,
      checkout_url: `${CHECKOUT_BASE_URL}/checkout/${checkoutId}`,
      expires_at: expiresAt,
      supported_chains: SUPPORTED_TOKENS,
    });
  }

  try {
    const payment = await createPaymentRecord({
      userId,
      amount,
      chain,
      token,
      webhookUrl,
      now: createdAt,
    });

    return res.status(200).json({
      message: "Payment created",
      ...payment,
    });
  } catch (error) {
    return res.status(502).json({
      error: `failed to prepare deposit wallet: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

router.get("/checkout/:paymentId", async (req, res) => {
  const checkoutId = String(req.params.paymentId ?? "").trim();
  if (!checkoutId) {
    return res.status(400).json({ error: "invalid checkout id" });
  }

  const paymentResult = await pool.query(
    `SELECT id, checkout_id, address, amount, chain, token, status, created_at
     FROM payments
     WHERE checkout_id = $1`,
    [checkoutId],
  );

  if (paymentResult.rows.length > 0) {
    const payment = paymentResult.rows[0];
    return res.status(200).json({
      type: "payment",
      payment_id: payment.id,
      checkout_id: payment.checkout_id,
      address: payment.address,
      amount: payment.amount,
      chain: payment.chain,
      token: payment.token,
      status: payment.status,
      created_at: payment.created_at,
      expires_at: payment.created_at + CHECKOUT_EXPIRATION_SECONDS,
      supported_chains: SUPPORTED_TOKENS,
    });
  }

  const sessionResult = await pool.query(
    `SELECT id, checkout_id, amount, status, created_at, selected_payment_id
     FROM checkout_sessions
     WHERE checkout_id = $1`,
    [checkoutId],
  );

  const session = sessionResult.rows[0];

  let selectedPayment = null;
  if (session?.selected_payment_id) {
    const spResult = await pool.query(
      "SELECT id, checkout_id, status FROM payments WHERE id = $1",
      [session.selected_payment_id],
    );
    selectedPayment = spResult.rows[0] ?? null;
  }

  if (!session) {
    return res.status(404).json({ error: "payment not found" });
  }

  const now = Math.floor(Date.now() / 1000);
  const isSessionExpired = session.created_at + CHECKOUT_EXPIRATION_SECONDS < now;
  if (isSessionExpired && session.status !== "expired") {
    await pool.query("UPDATE checkout_sessions SET status = $1 WHERE id = $2", ["expired", session.id]);
  }

  return res.status(200).json({
    type: "selection",
    session_id: session.id,
    checkout_id: session.checkout_id,
    amount: session.amount,
    status: selectedPayment?.status === "paid" ? "paid" : isSessionExpired ? "expired" : session.status,
    selected_payment_id: session.selected_payment_id,
    selected_payment_checkout_id: selectedPayment?.checkout_id ?? null,
    created_at: session.created_at,
    expires_at: session.created_at + CHECKOUT_EXPIRATION_SECONDS,
    supported_chains: SUPPORTED_TOKENS,
  });
});

router.post("/checkout/:paymentId/select", async (req, res) => {
  const checkoutId = String(req.params.paymentId ?? "").trim();
  const chain = String(req.body?.chain ?? "").trim();
  const symbol = normalize(req.body?.token ?? req.body?.symbol);

  if (!checkoutId) {
    return res.status(400).json({ error: "invalid checkout id" });
  }

  if (!chain || !symbol) {
    return res.status(400).json({ error: "chain and token are required" });
  }

  const token = SUPPORTED_TOKENS[normalize(chain)]?.[symbol];
  if (!token) {
    return res.status(400).json({ error: "unsupported chain or token" });
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionResult = await pool.query(
    `SELECT id, user_id, amount, status, created_at, webhook_url, selected_payment_id
     FROM checkout_sessions
     WHERE checkout_id = $1`,
    [checkoutId],
  );

  const session = sessionResult.rows[0];

  if (!session) {
    return res.status(404).json({ error: "checkout not found" });
  }

  if (session.created_at + CHECKOUT_EXPIRATION_SECONDS < now) {
    await pool.query("UPDATE checkout_sessions SET status = $1 WHERE id = $2", ["expired", session.id]);
    return res.status(410).json({ error: "checkout expired" });
  }

  if (session.selected_payment_id) {
    const spResult = await pool.query(
      "SELECT id, status, chain, token FROM payments WHERE id = $1",
      [session.selected_payment_id],
    );
    const selectedPayment = spResult.rows[0];

    if (selectedPayment?.status === "paid") {
      return res.status(409).json({ error: "checkout already paid" });
    }

    if (
      selectedPayment?.status === "waiting-payment" &&
      (normalize(selectedPayment.chain) !== normalize(chain) || normalize(selectedPayment.token) !== normalize(token))
    ) {
      await pool.query(
        "UPDATE payments SET status = $1, message = $2 WHERE id = $3",
        ["superseded", "payment method changed", selectedPayment.id],
      );
    }

    if (
      selectedPayment?.status === "waiting-payment" &&
      normalize(selectedPayment.chain) === normalize(chain) &&
      normalize(selectedPayment.token) === normalize(token)
    ) {
      const existingResult = await pool.query(
        "SELECT checkout_id, address, amount, chain, token, balance_before, created_at FROM payments WHERE id = $1",
        [selectedPayment.id],
      );
      const existingPayment = existingResult.rows[0];
      return res.status(200).json({
        payment_id: selectedPayment.id,
        checkout_id: existingPayment.checkout_id,
        address: existingPayment.address,
        amount: existingPayment.amount,
        chain: existingPayment.chain,
        token: existingPayment.token,
        balance_before: existingPayment.balance_before,
        checkout_url: `${CHECKOUT_BASE_URL}/checkout/${existingPayment.checkout_id}`,
        expires_at: existingPayment.created_at + CHECKOUT_EXPIRATION_SECONDS,
      });
    }
  }

  try {
    const payment = await createPaymentRecord({
      userId: session.user_id,
      amount: Number(session.amount),
      chain,
      token,
      webhookUrl: session.webhook_url,
      now,
    });
    await pool.query(
      "UPDATE checkout_sessions SET status = $1, selected_payment_id = $2 WHERE id = $3",
      ["payment-created", payment.payment_id, session.id],
    );

    return res.status(200).json(payment);
  } catch (error) {
    return res.status(502).json({
      error: `failed to prepare deposit wallet: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

router.get("/payments", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const result = await pool.query(
    `SELECT id, address, amount, chain, token, status, created_at, webhook_url, message
     FROM payments
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  return res.status(200).json({ payments: result.rows });
});

router.get("/balance", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const result = await pool.query(
    `SELECT token, chain, SUM(amount) AS amount
     FROM payments
     WHERE user_id = $1
       AND status = 'paid'
       AND token IS NOT NULL
       AND chain IS NOT NULL
     GROUP BY token, chain
     ORDER BY SUM(amount) DESC`,
    [userId],
  );

  return res.status(200).json({ balances: result.rows });
});

router.get("/wallets", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const now = Math.floor(Date.now() / 1000);
  const mainWallet = await getOrCreateMainWallet(userId);
  const walletsResult = await pool.query(
    `SELECT
       deposit_wallets.id,
       deposit_wallets.address,
       deposit_wallets.chain,
       deposit_wallets.token,
       deposit_wallets.created_at,
       COUNT(payments.id) AS active_payments
     FROM deposit_wallets
     LEFT JOIN payments
       ON payments.wallet_id = deposit_wallets.id
      AND payments.status = 'waiting-payment'
      AND payments.created_at + $1 >= $2
     WHERE deposit_wallets.user_id = $3
     GROUP BY deposit_wallets.id
     ORDER BY deposit_wallets.created_at DESC`,
    [CHECKOUT_EXPIRATION_SECONDS, now, userId],
  );
  const wallets = walletsResult.rows;

  const mainWalletBalances = await Promise.all(
    Object.keys(CHAIN_RPC_URLS)
      .filter((chain) => Boolean(CHAIN_RPC_URLS[chain]))
      .map(async (chain) => ({
        chain,
        native_balance: await getNativeBalance(chain, mainWallet.address).catch(() => null),
      })),
  );

  const walletsWithBalances = await Promise.all(
    wallets.map(async (wallet) => {
      const [tokenBalance, nativeBalance] = await Promise.all([
        getTokenBalance(wallet.chain, wallet.token, wallet.address).catch(() => null),
        getNativeBalance(wallet.chain, wallet.address).catch(() => null),
      ]);

      return {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        token: wallet.token,
        token_balance: tokenBalance,
        native_balance: nativeBalance,
        active_payments: Number(wallet.active_payments ?? 0),
        created_at: wallet.created_at,
      };
    }),
  );

  walletsWithBalances.sort((a, b) => {
    const balanceDiff = Number(b.token_balance ?? -1) - Number(a.token_balance ?? -1);
    if (balanceDiff !== 0) return balanceDiff;
    return Number(b.created_at ?? 0) - Number(a.created_at ?? 0);
  });

  return res.status(200).json({
    main_wallet: {
      id: mainWallet.id,
      address: mainWallet.address,
      type: "main",
      native_balances: mainWalletBalances,
      created_at: mainWallet.created_at,
    },
    wallets: walletsWithBalances,
  });
});

router.post("/withdrawals", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const sourceWalletId = Number(req.body?.source_wallet_id);
  const amount = Number(req.body?.amount);
  const destinationAddress = String(req.body?.destination_address ?? "").trim();

  if (!Number.isInteger(sourceWalletId) || sourceWalletId <= 0) {
    return res.status(400).json({ error: "source_wallet_id is required" });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
    return res.status(400).json({ error: "destination_address must be a valid EVM address" });
  }

  const now = Math.floor(Date.now() / 1000);
  const walletResult = await pool.query(
    `SELECT id, chain, token
     FROM deposit_wallets
     WHERE id = $1 AND user_id = $2`,
    [sourceWalletId, userId],
  );

  const sourceWallet = walletResult.rows[0];

  if (!sourceWallet) {
    return res.status(404).json({ error: "source wallet not found" });
  }

  const activeResult = await pool.query(
    `SELECT id
     FROM withdrawal_tasks
     WHERE user_id = $1
       AND source_wallet_id = $2
       AND status IN ('pending', 'checking', 'funding_gas', 'gas_sent', 'withdrawing', 'withdraw_tx_sent')
     LIMIT 1`,
    [userId, sourceWalletId],
  );

  if (activeResult.rows.length > 0) {
    return res.status(409).json({ error: "source wallet already has an active withdrawal" });
  }

  const insertResult = await pool.query(
    `INSERT INTO withdrawal_tasks (
      user_id, source_wallet_id, chain, token, amount, destination_address,
      status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      userId,
      sourceWallet.id,
      sourceWallet.chain,
      sourceWallet.token,
      amount,
      destinationAddress,
      "pending",
      now,
      now,
    ],
  );

  return res.status(201).json({
    withdrawal: {
      id: insertResult.rows[0].id,
      source_wallet_id: sourceWallet.id,
      chain: sourceWallet.chain,
      token: sourceWallet.token,
      amount,
      destination_address: destinationAddress,
      status: "pending",
      created_at: now,
      updated_at: now,
    },
  });
});

router.get("/withdrawals", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const result = await pool.query(
    `SELECT id, source_wallet_id, chain, token, amount, destination_address,
            status, gas_tx_hash, withdraw_tx_hash, message, created_at, updated_at
     FROM withdrawal_tasks
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );

  return res.status(200).json({ withdrawals: result.rows });
});

router.get("/notifications", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const rowsResult = await pool.query(
    `SELECT id, type, entity_id, title, message, status, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId],
  );
  const unreadResult = await pool.query(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1 AND status = 'unread'",
    [userId],
  );

  return res.status(200).json({
    notifications: rowsResult.rows,
    unread_count: Number(unreadResult.rows[0]?.total ?? 0),
  });
});

router.post("/notifications/read", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const notificationId = Number(req.body?.id);
  if (Number.isInteger(notificationId) && notificationId > 0) {
    await pool.query(
      "UPDATE notifications SET status = 'read' WHERE user_id = $1 AND id = $2",
      [userId, notificationId],
    );
  } else {
    await pool.query(
      "UPDATE notifications SET status = 'read' WHERE user_id = $1",
      [userId],
    );
  }

  return res.status(200).json({ ok: true });
});

router.get("/analytics", async (req, res) => {
  const userId = await getUserIdFromBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: "invalid or missing token" });
  }

  const requestedRange = String(req.query.range ?? "1A");
  const range = ["1S", "1M", "3M", "1A", "Todos"].includes(requestedRange)
    ? requestedRange
    : "1A";

  const analyticsConfig = {
    "1S": {
      bucket: "to_char(to_timestamp(created_at), 'YYYY-MM-DD')",
      label: "to_char(to_timestamp(created_at), 'DD/MM')",
      cutoff: "AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::BIGINT",
    },
    "1M": {
      bucket: "to_char(to_timestamp(created_at), 'YYYY-MM-DD')",
      label: "to_char(to_timestamp(created_at), 'DD/MM')",
      cutoff: "AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::BIGINT",
    },
    "3M": {
      bucket: "to_char(to_timestamp(created_at), 'IYYY-IW')",
      label: "'S' || to_char(to_timestamp(created_at), 'IW')",
      cutoff: "AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days')::BIGINT",
    },
    "1A": {
      bucket: "to_char(to_timestamp(created_at), 'YYYY-MM')",
      label: "to_char(to_timestamp(created_at), 'MM/YYYY')",
      cutoff: "AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '12 months')::BIGINT",
    },
    Todos: {
      bucket: "to_char(to_timestamp(created_at), 'YYYY-MM')",
      label: "to_char(to_timestamp(created_at), 'MM/YYYY')",
      cutoff: "",
    },
  }[range];

  const seriesResult = await pool.query(
    `SELECT
       ${analyticsConfig.bucket} AS period,
       ${analyticsConfig.label} AS label,
       SUM(amount) AS total,
       MIN(created_at) AS first_timestamp
     FROM payments
     WHERE user_id = $1 AND status = 'paid'
       ${analyticsConfig.cutoff}
     GROUP BY 1, 2
     ORDER BY 4 ASC`,
    [userId],
  );

  const monthlyResult = await pool.query(
    `SELECT
       to_char(to_timestamp(created_at), 'YYYY-MM') AS month,
       SUM(amount) AS total
     FROM payments
     WHERE user_id = $1 AND status = 'paid'
       AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '12 months')::BIGINT
     GROUP BY to_char(to_timestamp(created_at), 'YYYY-MM')
     ORDER BY to_char(to_timestamp(created_at), 'YYYY-MM') ASC`,
    [userId],
  );

  const dailyResult = await pool.query(
    `SELECT
       to_char(to_timestamp(created_at), 'DD/MM') AS day,
       SUM(amount) AS total
     FROM payments
     WHERE user_id = $1 AND status = 'paid'
       AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::BIGINT
     GROUP BY to_char(to_timestamp(created_at), 'DD/MM')
     ORDER BY MIN(created_at) ASC`,
    [userId],
  );

  return res.status(200).json({
    range,
    series: seriesResult.rows,
    monthly: monthlyResult.rows,
    daily: dailyResult.rows,
  });
});

export { router as paymentRouter };
