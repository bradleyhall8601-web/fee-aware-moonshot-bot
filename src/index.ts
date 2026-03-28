// src/index.ts
// Main entry point for the fee-aware moonshot bot (PAPER TRADING MODE).

import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./config";
import State from "./state";
import { manageStopLoss, monitorFallback } from "./risk";

// ── Paper Trading Mode Safety Guard ──────────────────────────────────────────
// This bot runs in PAPER TRADING mode by default (no real funds at risk).
const LIVE_TRADING_ENABLED = process.env.ENABLE_LIVE_TRADING === "true";

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// ── Health check mode ────────────────────────────────────────────────────────
async function runHealthCheck(): Promise<void> {
  const health = {
    ok: true,
    mode: LIVE_TRADING_ENABLED ? "live" : "paper",
    timestamp: new Date().toISOString(),
    config: {
      minLiquidityUsd: config.minLiquidityUsd,
      maxPoolAgeMs: config.maxPoolAgeMs,
      preferWindow: config.preferWindow,
      minTxns: config.minTxns,
      maxTxns: config.maxTxns,
    },
    state: {
      balances: Object.keys(State.balances).length,
      orders: State.orders.length,
    },
  };

  console.log(JSON.stringify(health, null, 2));
  process.exit(health.ok ? 0 : 1);
}

// ── Main loop ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "health") {
    await runHealthCheck();
    return;
  }

  log("=== Fee-Aware Moonshot Bot ===");
  log(`Mode: ${LIVE_TRADING_ENABLED ? "LIVE TRADING" : "PAPER TRADING (safe mode – no real funds at risk)"}`);
  log(`Config: minLiquidity=${config.minLiquidityUsd}, minTxns=${config.minTxns}, maxTxns=${config.maxTxns}`);

  // Graceful shutdown
  const shutdown = (): void => {
    log("[shutdown] Stopping…");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Main trading loop (placeholder)
  let tickCount = 0;
  const pollInterval = 5000;

  const interval = setInterval(async () => {
    try {
      tickCount++;
      log(`[tick ${tickCount}] Bot running in ${LIVE_TRADING_ENABLED ? "LIVE" : "PAPER"} mode...`);

      // Periodic status output
      if (tickCount % 12 === 0) {
        log(`[status] State - Balances: ${Object.keys(State.balances).length}, Orders: ${State.orders.length}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[loop] Error: ${msg}`);
    }
  }, pollInterval);

  log(`[init] Bot started. Polling every ${pollInterval}ms...`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
