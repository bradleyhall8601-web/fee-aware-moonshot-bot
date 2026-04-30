// src/index.ts
// Main entry point — starts the Express API server + Telegram bot as a single
// unified Railway service (fee-aware-moonshot-bot).

import * as dotenv from "dotenv";
dotenv.config();

import botOrchestrator from "./bot-orchestrator.js";
import telemetryLogger from "./telemetry.js";

// ── Environment summary ───────────────────────────────────────────────────────
const PORT = process.env.PORT || "5000";
const NODE_ENV = process.env.NODE_ENV || "development";
const LIVE_TRADING = process.env.ENABLE_LIVE_TRADING === "true";

// ── Main entry point ─────────────────────────────────────────────────────────
async function main(): Promise<void> {
  telemetryLogger.info("🚀 Fee-Aware Moonshot Bot — Unified Service", "main");
  telemetryLogger.info(`Environment : ${NODE_ENV}`, "main");
  telemetryLogger.info(`Port        : ${PORT}`, "main");
  telemetryLogger.info(
    `Live Trading: ${LIVE_TRADING ? "🟢 ENABLED" : "🔴 DISABLED (Paper Mode)"}`,
    "main"
  );

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    telemetryLogger.info("Shutting down gracefully…", "main");
    await botOrchestrator.shutdown();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", (err) => {
    telemetryLogger.error("Uncaught exception", "main", err);
  });
  process.on("unhandledRejection", (reason) => {
    telemetryLogger.error("Unhandled rejection", "main", reason);
  });

  // Start everything: API server (port 5000) + Telegram bot + trading loops
  await botOrchestrator.start();
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
