// src/index.ts
// Main entry point for the fee-aware moonshot bot (MULTI-USER PRODUCTION SYSTEM).

import * as dotenv from "dotenv";
dotenv.config();

import botOrchestrator from "./bot-orchestrator.js";
import telemetryLogger from "./telemetry.js";
import database from "./database.js";

// ── Paper Trading Mode Safety Guard ──────────────────────────────────────────
// This bot runs in PAPER TRADING mode by default (no real funds at risk).
const LIVE_TRADING_ENABLED = process.env.ENABLE_LIVE_TRADING === "true";

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// ── Health check mode ────────────────────────────────────────────────────────
async function runHealthCheck(): Promise<void> {
  try {
    const users = database.getAllActiveUsers();
    const sessions = users.flatMap(u => database.getUserTradingSessions(u.id));

    const health = {
      ok: true,
      mode: "multi-user-production",
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
      },
      bot: {
        activeUsers: users.length,
        activeTrades: sessions.filter(s => s.status === 'open').length,
        totalProfit: sessions
          .filter(s => s.status === 'closed')
          .reduce((sum, s) => sum + (s.profit || 0), 0),
      },
    };

    console.log(JSON.stringify(health, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Health check failed:', err);
    process.exit(1);
  }
}

// ── Main entry point ────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "health") {
    await runHealthCheck();
    return;
  }

  telemetryLogger.info("🚀 Fee-Aware Moonshot Bot - Multi-User Production System", "main");
  telemetryLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`, "main");
  telemetryLogger.info(`Live Trading: ${process.env.ENABLE_LIVE_TRADING === 'true' ? '🟢 ENABLED' : '🔴 DISABLED (Paper Mode)'}`, "main");

  // Graceful shutdown handler
  const shutdown = async (): Promise<void> => {
    telemetryLogger.info("Shutting down gracefully...", "main");
    await botOrchestrator.shutdown();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", (err) => {
    telemetryLogger.error("Uncaught exception", "main", err);
  });

  // Start the bot
  await botOrchestrator.start();
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
