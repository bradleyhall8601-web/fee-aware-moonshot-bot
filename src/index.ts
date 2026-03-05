import { config } from "./config";
import { MoonshotBot } from "./bot";
import { logger } from "./logger";
import { PaperTrader } from "./paper";
import { loadPersistedState, savePersistedState } from "./persistence";

async function main(): Promise<void> {
  logger.info("Fee-aware moonshot bot starting");

  const persistedState = await loadPersistedState();
  logger.info("Loaded persisted state");

  const paperTrader = new PaperTrader(persistedState);
  paperTrader.resume(persistedState);

  const bot = new MoonshotBot(paperTrader);

  const runCycle = async (): Promise<void> => {
    await bot.runCycle();
    await savePersistedState(paperTrader.getState());
  };

  await runCycle();
  const interval = setInterval(() => {
    runCycle().catch((error) => {
      logger.error({ err: error }, "Cycle failure");
    });
  }, config.pollIntervalMs);

  const shutdown = async (signal: string): Promise<void> => {
    clearInterval(interval);
    await savePersistedState(paperTrader.getState());
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
