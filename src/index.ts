import 'dotenv/config';
import { config } from "./config";
import { assertLiveWalletEnv, hasMonitorOnly, hasWallet, isDryRun, isLiveEnabled, isMonitorOnlyLiveMode } from "./env";
import { MoonshotBot } from "./bot";
import { logger } from "./logger";
import { PaperTrader } from "./paper";
import { loadPersistedState, savePersistedState } from "./persistence";
import { getWalletPubkey } from "./wallet";

async function main(): Promise<void> {
  logger.info("Fee-aware moonshot bot starting");

  const persistedState = await loadPersistedState();
  logger.info("Loaded persisted state");

  if (isLiveEnabled()) {
    try {
      assertLiveWalletEnv();
    } catch (error) {
      logger.error({ err: error }, "Live trading wallet configuration error");
      process.exit(1);
    }

    if (!isDryRun() && !hasWallet && !hasMonitorOnly) {
      logger.error("Live trading requires WALLET_PRIVATE_KEY or WALLET_KEYPAIR_PATH when DRY_RUN=false");
      process.exit(1);
    }

    if (isMonitorOnlyLiveMode()) {
      logger.warn("Monitor-only wallet mode: live trading enabled but no signer, swaps will not be submitted");
    }
  }

  let walletPubkey = "unavailable";
  if (hasWallet) {
    walletPubkey = getWalletPubkey().toBase58();
  } else if (hasMonitorOnly) {
    walletPubkey = "monitor-only";
  } else {
    try {
      walletPubkey = getWalletPubkey().toBase58();
    } catch {
    // pubkey remains unavailable in fully anonymous paper mode
    }
  }

  logger.info({ walletPubkey, liveTrading: isLiveEnabled(), dryRun: isDryRun() }, "Runtime mode");

  const trader = new PaperTrader(persistedState, async () => {
    await savePersistedState(trader.getState());
  });
  trader.resumeFromPersistedState(persistedState);

  const bot = new MoonshotBot(trader, {
    persistState: async () => {
      await savePersistedState(trader.getState());
    }
  });

  await bot.scanAndEnterTick();

  let shuttingDown = false;
  let positionRunning = false;
  let scanRunning = false;
  let healthRunning = false;

  const runSafely = async (guard: "position" | "scan" | "health", fn: () => Promise<void>): Promise<void> => {
    if (shuttingDown) return;

    if (guard === "position" && positionRunning) return;
    if (guard === "scan" && scanRunning) return;
    if (guard === "health" && healthRunning) return;

    if (guard === "position") positionRunning = true;
    if (guard === "scan") scanRunning = true;
    if (guard === "health") healthRunning = true;

    try {
      await fn();
    } catch (error) {
      logger.error({ err: error }, `${guard} tick failure`);
    } finally {
      if (guard === "position") positionRunning = false;
      if (guard === "scan") scanRunning = false;
      if (guard === "health") healthRunning = false;
    }
  };

  const positionsTimer = setInterval(() => {
    void runSafely("position", () => bot.managePositionsTick());
  }, 2_000);

  const scannerTimer = setInterval(() => {
    void runSafely("scan", () => bot.scanAndEnterTick());
  }, 5_000);

  const healthTimer = setInterval(() => {
    void runSafely("health", () => bot.healthTick());
  }, 10_000);

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    clearInterval(positionsTimer);
    clearInterval(scannerTimer);
    clearInterval(healthTimer);

    await savePersistedState(trader.getState());
    logger.info({ signal }, "Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((error) => {
  logger.error({ err: error }, "Fatal startup error");
  process.exit(1);
});
