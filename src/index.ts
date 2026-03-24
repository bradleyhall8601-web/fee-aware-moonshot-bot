// src/index.ts
// Main entry point for the fee-aware moonshot bot (SAFE MODE – paper trading only).

import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./config";
import {
  addWatchedWallet,
  getCash,
  getPositions,
  loadState,
} from "./state";
import { heliusHealthCheck } from "./providers";
import { autoTradeTick } from "./strategy";
import { launchTelegramBot, stopTelegramBot } from "./telegram";
import { HealthStatus } from "./types";

// ── Safety guard ──────────────────────────────────────────────────────────────
// This bot NEVER executes real trades.  The flag below is permanently false.
if ((config as { enableLiveTrading: unknown }).enableLiveTrading === true) {
  console.error("FATAL: Live trading must never be enabled in this bot.");
  process.exit(1);
}

// ── Logging helper ────────────────────────────────────────────────────────────
function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// ── Seed watched wallets from env ─────────────────────────────────────────────
function seedWatchedWallets(): void {
  const raw = config.WATCH_WALLETS;
  if (!raw) return;
  const addresses = raw.split(",").map((a) => a.trim()).filter(Boolean);
  for (const address of addresses) {
    addWatchedWallet({ address, addedAt: Date.now() });
  }
  if (addresses.length > 0) {
    log(`[init] Watching ${addresses.length} wallet(s) from env.`);
  }
}

// ── Health check mode ─────────────────────────────────────────────────────────
async function runHealthCheck(): Promise<void> {
  const helius = await heliusHealthCheck();
  const state = loadState();

  // Quick DexScreener probe
  let dexscreener = false;
  try {
    const axios = (await import("axios")).default;
    const r = await axios.get(`${config.DEXSCREENER_BASE_URL}/latest/dex/search?q=sol`, {
      timeout: 6000,
    });
    dexscreener = r.status === 200;
  } catch {
    dexscreener = false;
  }

  // Optional Postgres probe
  let postgres = false;
  if (config.POSTGRES_URL) {
    try {
      const { Client } = await import("pg");
      const pg = new Client({ connectionString: config.POSTGRES_URL });
      await pg.connect();
      await pg.end();
      postgres = true;
    } catch {
      postgres = false;
    }
  }

  const health: HealthStatus = {
    ok: helius || dexscreener,
    helius,
    dexscreener,
    postgres,
    timestamp: new Date().toISOString(),
    cashUsd: getCash(),
    openPositions: getPositions().length,
    mode: "paper",
  };

  console.log(JSON.stringify(health, null, 2));
  process.exit(health.ok ? 0 : 1);
}

// ── Postgres logger (optional) ────────────────────────────────────────────────
async function initPostgres(): Promise<void> {
  if (!config.POSTGRES_URL) return;
  try {
    const { Client } = await import("pg");
    const pg = new Client({ connectionString: config.POSTGRES_URL });
    await pg.connect();

    await pg.query("BEGIN");
    await pg.query(`
      CREATE TABLE IF NOT EXISTS paper_trades (
        id TEXT PRIMARY KEY,
        type TEXT,
        symbol TEXT,
        address TEXT,
        price_usd NUMERIC,
        units NUMERIC,
        value_usd NUMERIC,
        pnl_usd NUMERIC,
        reason TEXT,
        ts TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS bot_runs (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        mode TEXT DEFAULT 'paper'
      );
    `);
    await pg.query(
      "INSERT INTO bot_runs (mode) VALUES ($1)",
      ["paper"]
    );
    await pg.query("COMMIT");

    await pg.end();
    log("[postgres] Tables ensured and run logged.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[postgres] Optional – unavailable: ${msg}`);
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "health") {
    await runHealthCheck();
    return;
  }

  log("=== Fee-Aware Moonshot Bot ===");
  log("Mode: PAPER TRADING (safe mode – no real funds at risk)");
  log(`Start balance: $${config.SIM_START_BALANCE_USD}`);
  log(`Poll interval: ${config.POLL_INTERVAL_MS}ms`);

  seedWatchedWallets();
  await initPostgres();

  // Helius health check
  const heliusOk = await heliusHealthCheck();
  log(`[helius] RPC health: ${heliusOk ? "✅ ok" : "⚠️  degraded/unavailable"}`);

  // Launch Telegram bot if token is set
  const tg = launchTelegramBot();
  if (tg) {
    log("[telegram] Bot running – send /start in Telegram to begin.");
  }

  // Initial scan on startup
  log("[init] Running initial auto-scan…");
  await autoTradeTick(log);

  // Periodic auto-trade loop
  const interval = setInterval(async () => {
    try {
      await autoTradeTick(log);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[loop] Error in auto-trade tick: ${msg}`);
    }
  }, config.POLL_INTERVAL_MS);

  // Status log every 5 minutes
  const statusInterval = setInterval(() => {
    const cash = getCash();
    const positions = getPositions();
    const totalValue = positions.reduce((s, p) => s + p.currentValueUsd, 0);
    log(
      `[status] Cash: $${cash.toFixed(2)}  Positions: ${positions.length}  ` +
        `Portfolio: $${totalValue.toFixed(2)}`
    );
  }, 5 * 60 * 1000);

  // Graceful shutdown
  const shutdown = (): void => {
    log("[shutdown] Stopping…");
    clearInterval(interval);
    clearInterval(statusInterval);
    stopTelegramBot();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
