import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { decrypt } from "../api/crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.join(__dirname, "..");

dotenv.config({ path: path.join(BASE_DIR, ".env") });

const DB_PATH = path.join(BASE_DIR, "data", "payments.db");
const POLL_INTERVAL_MS = 20_000;
const GAS_BUFFER_MULTIPLIER = 2n;
const MIN_GAS_LIMIT = 100_000n;
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

async function getDb() {
  return open({ filename: DB_PATH, driver: sqlite3.Database });
}

async function ensureNotificationsTable() {
  const db = await getDb();
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

class WithdrawalWorker {
  constructor(rpcUrls) {
    this.rpcUrls = rpcUrls;
    this.providers = new Map();
  }

  getProvider(chain) {
    const normalizedChain = normalize(chain);
    const rpcUrl = this.rpcUrls[normalizedChain];
    if (!rpcUrl) throw new Error(`unsupported chain: ${chain}`);
    if (!this.providers.has(normalizedChain)) {
      this.providers.set(normalizedChain, new ethers.JsonRpcProvider(rpcUrl));
    }
    return this.providers.get(normalizedChain);
  }

  async getTasks() {
    const db = await getDb();
    const rows = await db.all(
      `SELECT
         withdrawal_tasks.*,
         deposit_wallets.address AS source_address,
         deposit_wallets.private_key AS source_private_key,
         main_wallets.address AS main_address,
         main_wallets.private_key AS main_private_key
       FROM withdrawal_tasks
       JOIN deposit_wallets ON deposit_wallets.id = withdrawal_tasks.source_wallet_id
       JOIN main_wallets ON main_wallets.user_id = withdrawal_tasks.user_id
       WHERE withdrawal_tasks.status IN ('pending', 'checking', 'funding_gas', 'gas_sent', 'withdrawing', 'withdraw_tx_sent')
       ORDER BY withdrawal_tasks.created_at ASC
       LIMIT 10`,
    );
    await db.close();
    return rows;
  }

  async updateTask(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const now = Math.floor(Date.now() / 1000);
    const assignments = [...keys.map((key) => `${key} = ?`), "updated_at = ?"].join(", ");
    const values = [...keys.map((key) => fields[key]), now, id];
    const db = await getDb();
    await db.run(`UPDATE withdrawal_tasks SET ${assignments} WHERE id = ?`, values);
    await db.close();
  }

  async createNotification({ userId, type, entityId, title, message }) {
    if (!userId) return;
    const db = await getDb();
    await db.run(
      `INSERT OR IGNORE INTO notifications (
        user_id, type, entity_id, title, message, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, entityId, title, message, "unread", Math.floor(Date.now() / 1000)],
    );
    await db.close();
  }

  async failTask(task, message) {
    await this.updateTask(task.id, { status: "failed", message });
    await this.createNotification({
      userId: task.user_id,
      type: "withdrawal_failed",
      entityId: task.id,
      title: "Saque falhou",
      message,
    });
  }

  async processTasks() {
    const tasks = await this.getTasks();
    for (const task of tasks) {
      try {
        await this.processTask(task);
      } catch (error) {
        await this.failTask(task, error instanceof Error ? error.message : String(error));
      }
    }
  }

  async processTask(task) {
    const provider = this.getProvider(task.chain);
    const sourceWallet = new ethers.Wallet(this.decryptKey(task.source_private_key), provider);
    const mainWallet = new ethers.Wallet(this.decryptKey(task.main_private_key), provider);
    const token = new ethers.Contract(task.token, [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function transfer(address to, uint256 value) returns (bool)",
    ], sourceWallet);

    if (task.withdraw_tx_hash) {
      await this.checkWithdrawReceipt(task, provider);
      return;
    }

    if (task.gas_tx_hash) {
      const receipt = await provider.getTransactionReceipt(task.gas_tx_hash);
      if (!receipt) {
        await this.updateTask(task.id, { status: "gas_sent", message: "waiting gas confirmation" });
        return;
      }
      if (receipt.status !== 1) {
        await this.failTask(task, "gas funding transaction failed");
        return;
      }
    }

    await this.updateTask(task.id, { status: "checking", message: null });

    const decimals = await token.decimals();
    const amountRaw = ethers.parseUnits(String(task.amount), decimals);
    const tokenBalance = await token.balanceOf(task.source_address);
    if (tokenBalance < amountRaw) {
      await this.failTask(task, "source wallet has insufficient token balance");
      return;
    }

    const requiredGas = await this.estimateRequiredGas(provider, token, task.destination_address, amountRaw);
    const sourceGasBalance = await provider.getBalance(task.source_address);
    if (sourceGasBalance < requiredGas) {
      await this.fundGas(task, provider, mainWallet, requiredGas - sourceGasBalance);
      return;
    }

    await this.sendWithdrawal(task, token, task.destination_address, amountRaw);
  }

  decryptKey(encryptedKey) {
    try {
      return decrypt(encryptedKey);
    } catch {
      return encryptedKey;
    }
  }

  async estimateRequiredGas(provider, token, destinationAddress, amountRaw) {
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (!gasPrice) throw new Error("could not load gas price");

    let gasLimit = MIN_GAS_LIMIT;
    try {
      const estimated = await token.transfer.estimateGas(destinationAddress, amountRaw);
      gasLimit = estimated > MIN_GAS_LIMIT ? estimated : MIN_GAS_LIMIT;
    } catch {
      gasLimit = MIN_GAS_LIMIT;
    }

    return gasLimit * gasPrice * GAS_BUFFER_MULTIPLIER;
  }

  async fundGas(task, provider, mainWallet, missingGas) {
    const mainBalance = await provider.getBalance(mainWallet.address);
    if (mainBalance < missingGas) {
      await this.failTask(task, "main wallet has insufficient gas");
      return;
    }

    await this.updateTask(task.id, { status: "funding_gas", message: "funding source wallet gas" });
    const tx = await mainWallet.sendTransaction({
      to: task.source_address,
      value: missingGas,
    });
    await this.updateTask(task.id, {
      status: "gas_sent",
      gas_tx_hash: tx.hash,
      message: "gas transaction sent",
    });
  }

  async sendWithdrawal(task, token, destinationAddress, amountRaw) {
    await this.updateTask(task.id, { status: "withdrawing", message: "sending token transfer" });
    const tx = await token.transfer(destinationAddress, amountRaw);
    await this.updateTask(task.id, {
      status: "withdraw_tx_sent",
      withdraw_tx_hash: tx.hash,
      message: "withdraw transaction sent",
    });
  }

  async checkWithdrawReceipt(task, provider) {
    const receipt = await provider.getTransactionReceipt(task.withdraw_tx_hash);
    if (!receipt) {
      await this.updateTask(task.id, { status: "withdraw_tx_sent", message: "waiting withdraw confirmation" });
      return;
    }

    const completed = receipt.status === 1;
    const message = completed ? "withdraw completed" : "withdraw transaction failed";
    await this.updateTask(task.id, {
      status: completed ? "completed" : "failed",
      message,
    });
    await this.createNotification({
      userId: task.user_id,
      type: completed ? "withdrawal_completed" : "withdrawal_failed",
      entityId: task.id,
      title: completed ? "Saque concluído" : "Saque falhou",
      message,
    });
  }
}

async function main() {
  await ensureNotificationsTable();
  const worker = new WithdrawalWorker(CHAIN_RPC_URLS);
  const configuredChains = Object.entries(CHAIN_RPC_URLS)
    .filter(([, rpcUrl]) => Boolean(rpcUrl))
    .map(([chain]) => chain);

  console.log(`Withdrawal worker iniciado para redes: ${configuredChains.join(", ") || "nenhuma"}`);

  const run = async () => {
    try {
      await worker.processTasks();
    } catch (error) {
      console.error(`Erro no withdrawal worker: ${String(error)}`);
    }
  };

  await run();
  const intervalId = setInterval(run, POLL_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(intervalId);
    console.log("Withdrawal worker finalizado");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(`Falha fatal no withdrawal worker: ${String(error)}`);
  process.exit(1);
});
