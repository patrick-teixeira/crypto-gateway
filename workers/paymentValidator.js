import pkg from "pg";
const { Pool, types } = pkg;
types.setTypeParser(types.builtins.INT8, parseInt);
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  arbitrum: process.env.ARBITRUM_RPC_URL,
};

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isContractAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address ?? "").trim());
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
    const result = await pool.query(
      `SELECT id, user_id, wallet_id, address, private_key, amount, token, chain, status, created_at, webhook_url, balance_before
       FROM payments
       WHERE status = $1`,
      ["waiting-payment"],
    );

    return result.rows.map((row) => {
      try {
        return { ...row, private_key: decrypt(row.private_key) };
      } catch {
        return row;
      }
    });
  }

  async updatePaymentStatus(id, newStatus, message = null) {
    await pool.query(
      "UPDATE payments SET status = $1, message = $2 WHERE id = $3",
      [newStatus, message, id],
    );
  }

  async createNotification({ userId, type, entityId, title, message }) {
    if (!userId) return;
    await pool.query(
      `INSERT INTO notifications (
        user_id, type, entity_id, title, message, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, type, entity_id) DO NOTHING`,
      [userId, type, entityId, title, message, "unread", Math.floor(Date.now() / 1000)],
    );
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
    await pool.query(
      `INSERT INTO balances (user_id, token, chain, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, token, chain)
       DO UPDATE SET amount = balances.amount + $4`,
      [userId, token, chain, amount],
    );
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

  const shutdown = () => {
    clearInterval(intervalId);
    console.log("Payment validator finalizado");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  runValidation();
  const intervalId = setInterval(runValidation, POLL_INTERVAL_MS);
}

main();
