import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendWebhookAsync } from "../api/webhook.js";
import { decrypt } from "../api/crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.join(__dirname, "..");

dotenv.config({ path: path.join(BASE_DIR, ".env") });

const DB_PATH = path.join(BASE_DIR, "data", "payments.db");
const CHECKOUT_EXPIRATION_SECONDS = 600;
const POLL_INTERVAL_MS = 20_000;
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const CHAIN_RPC_URLS = {
  ronin: process.env.RONIN_RPC_URL,
  ethereum: process.env.ETHEREUM_RPC_URL,
  polygon: process.env.POLYGON_RPC_URL,
  bsc: process.env.BSC_RPC_URL,
  avalanche: process.env.AVALANCHE_RPC_URL,
  base: process.env.BASE_RPC_URL,
};

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isContractAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address ?? "").trim());
}

async function ensureNotificationsTable() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, type, entity_id)
    )
  `);
  await db.close();
}

class Validator {
  constructor(rpcUrls) {
    this.rpcUrls = rpcUrls;
    this.providers = new Map();
  }

  getProvider(chain) {
    const normalizedChain = normalize(chain);
    const rpcUrl = this.rpcUrls[normalizedChain];
    if (!rpcUrl) {
      throw new Error(`unsupported chain: ${chain}`);
    }

    if (!this.providers.has(normalizedChain)) {
      this.providers.set(normalizedChain, new ethers.JsonRpcProvider(rpcUrl));
    }

    return this.providers.get(normalizedChain);
  }

  async getPendingPayments() {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    const rows = await db.all(
      `SELECT id, user_id, wallet_id, address, private_key, amount, token, chain, status, created_at, webhook_url, balance_before
       FROM payments
       WHERE status = ?`,
      ["waiting-payment"],
    );

    await db.close();
    // Decrypt private keys before returning
    return rows.map((row) => {
      try {
        return { ...row, private_key: decrypt(row.private_key) };
      } catch {
        // Key was stored unencrypted (legacy row) — return as-is
        return row;
      }
    });
  }

  async updatePaymentStatus(id, newStatus, message = null) {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    await db.run(
      "UPDATE payments SET status = ?, message = ? WHERE id = ?",
      [newStatus, message, id],
    );

    await db.close();
  }

  async createNotification({ userId, type, entityId, title, message }) {
    if (!userId) return;
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.run(
      `INSERT OR IGNORE INTO notifications (
        user_id, type, entity_id, title, message, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, entityId, title, message, "unread", Math.floor(Date.now() / 1000)],
    );
    await db.close();
  }

  async validatePayments() {
    const pendingPayments = await this.getPendingPayments();
    if (pendingPayments.length === 0) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const activePayments = pendingPayments.filter(
      (payment) => payment.created_at + CHECKOUT_EXPIRATION_SECONDS >= now,
    );
    const expiredPayments = pendingPayments.filter(
      (payment) => payment.created_at + CHECKOUT_EXPIRATION_SECONDS < now,
    );

    for (const payment of expiredPayments) {
      await this.updatePaymentStatus(payment.id, "expired", "checkout expired");
    }

    const paymentsByChainAndToken = new Map();
    for (const payment of activePayments) {
      if (!payment.token) {
        continue;
      }
      const chain = normalize(payment.chain);
      const token = normalize(payment.token);
      if (!this.rpcUrls[chain]) {
        console.error(`Rede nao suportada no validador: ${payment.chain} (payment ${payment.id})`);
        continue;
      }
      if (!isContractAddress(token)) {
        console.error(`Token invalido no validador: ${payment.token} (payment ${payment.id})`);
        continue;
      }

      const key = `${chain}:${token}`;
      if (!paymentsByChainAndToken.has(key)) {
        paymentsByChainAndToken.set(key, {
          chain,
          tokenAddress: payment.token,
          payments: [],
        });
      }
      paymentsByChainAndToken.get(key).payments.push(payment);
    }

    for (const { chain, tokenAddress, payments } of paymentsByChainAndToken.values()) {
      const wallets = payments.map((payment) => payment.address);
      let balances = {};
      try {
        balances = await this.getTokenBalance(chain, wallets, tokenAddress);
      } catch (error) {
        console.error(`Erro ao buscar saldos em ${chain} do token ${tokenAddress}: ${String(error)}`);
        continue;
      }

      for (const payment of payments) {
        const walletBalance = Number(balances[payment.address] ?? 0);
        const balanceBefore = Number(payment.balance_before ?? 0);
        const receivedAmount = Math.max(0, walletBalance - balanceBefore);
        const requiredAmount = Number(payment.amount);
        if (Number.isNaN(requiredAmount)) {
          continue;
        }

        console.log(`${chain}:${payment.address} balance: ${walletBalance} | before: ${balanceBefore} | received: ${receivedAmount}`);

        if (receivedAmount + Number.EPSILON >= requiredAmount) {
          await this.updatePaymentStatus(payment.id, "paid", null);
          await this.creditUserBalance(payment.user_id, payment.token, payment.chain, requiredAmount);
          await this.createNotification({
            userId: payment.user_id,
            type: "payment_paid",
            entityId: payment.id,
            title: "Pagamento concluído",
            message: `${requiredAmount} recebido em ${payment.chain}`,
          });
          const validatedAt = Math.floor(Date.now() / 1000);
          sendWebhookAsync(payment.webhook_url, {
            ...payment,
            status: "paid",
            validated_at: validatedAt,
          });
          console.log(`payment validated: ${payment.id}`);
        }
      }
    }
  }

  async creditUserBalance(userId, token, chain, amount) {
    if (!userId || !token || !chain) return;
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.run(
      `INSERT INTO balances (user_id, token, chain, amount)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, token, chain)
       DO UPDATE SET amount = amount + excluded.amount`,
      [userId, token, chain, amount],
    );
    await db.close();
  }

  async getTokenBalance(chain, wallets, tokenAddress) {
    const provider = this.getProvider(chain);
    const normalizedTokenAddress = String(tokenAddress ?? "").trim();
    const tokenCode = await provider.getCode(normalizedTokenAddress);
    if (tokenCode === "0x") {
      const network = await provider.getNetwork();
      throw new Error(`token contract not found on ${chain} (chainId ${network.chainId})`);
    }

    const erc20Iface = new ethers.Interface([
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ]);
    const token = new ethers.Contract(normalizedTokenAddress, erc20Iface, provider);

    const decimals = await token.decimals();
    const multicallCode = await provider.getCode(MULTICALL3);

    if (multicallCode === "0x") {
      return this.getTokenBalancesDirect(wallets, token, decimals);
    }

    const mc3 = new ethers.Contract(MULTICALL3, [
      "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])",
    ], provider);

    const calls = [
      ...wallets.map((addr) => ({
        target:       normalizedTokenAddress,
        allowFailure: true,
        callData:     erc20Iface.encodeFunctionData("balanceOf", [addr]),
      })),
    ];

    try {
      const results = await mc3.aggregate3(calls);
      const balances = {};
      results.forEach((result, i) => {
        if (!result.success) {
          console.log(`${chain}:${wallets[i]} erro ao buscar saldo`);
          return;
        }
        const raw = erc20Iface.decodeFunctionResult("balanceOf", result.returnData)[0];
        balances[wallets[i]] = Number(ethers.formatUnits(raw, decimals));
      });
      return balances;
    } catch (error) {
      console.error(`Multicall falhou em ${chain}; tentando chamadas diretas. ${String(error)}`);
      return this.getTokenBalancesDirect(wallets, token, decimals);
    }
  }

  async getTokenBalancesDirect(wallets, token, decimals) {
    const entries = await Promise.all(
      wallets.map(async (wallet) => {
        try {
          const raw = await token.balanceOf(wallet);
          return [wallet, Number(ethers.formatUnits(raw, decimals))];
        } catch (error) {
          console.error(`${wallet} erro ao buscar saldo direto: ${String(error)}`);
          return [wallet, 0];
        }
      }),
    );

    return Object.fromEntries(entries);
  }
}

async function main() {
  await ensureNotificationsTable();
  const validator = new Validator(CHAIN_RPC_URLS);
  const configuredChains = Object.entries(CHAIN_RPC_URLS)
    .filter(([, rpcUrl]) => Boolean(rpcUrl))
    .map(([chain]) => chain);
  const missingChains = Object.entries(CHAIN_RPC_URLS)
    .filter(([, rpcUrl]) => !rpcUrl)
    .map(([chain]) => chain);

  console.log(`Payment validator iniciado para redes: ${configuredChains.join(", ") || "nenhuma"}`);
  if (missingChains.length > 0) {
    console.warn(`RPC ausente no .env para redes: ${missingChains.join(", ")}`);
  }

  const runValidation = async () => {
    try {
      await validator.validatePayments();
    } catch (error) {
      console.error(`Erro durante validacao: ${String(error)}`);
    }
  };

  await runValidation();
  const intervalId = setInterval(runValidation, POLL_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(intervalId);
    console.log("Payment validator finalizado");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(`Falha fatal no validator: ${String(error)}`);
  process.exit(1);
});
