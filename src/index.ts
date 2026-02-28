import { env } from './env';
import { logger } from './logger';
import { runCycle } from './bot';

async function main(): Promise<void> {
  logger.info(
    {
      liveTrading: env.ENABLE_LIVE_TRADING,
      pollIntervalMs: env.POLL_INTERVAL_MS,
      watchlistMints: env.WATCHLIST_MINTS.length,
    },
    'Fee-aware moonshot bot starting',
  );

  if (env.ENABLE_LIVE_TRADING) {
    logger.warn('LIVE TRADING IS ENABLED — real transactions will be submitted');
  } else {
    logger.info('Paper-trading mode active (ENABLE_LIVE_TRADING=false)');
  }

  // Run first cycle immediately, then on interval
  await runCycle();

  const interval = setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      logger.error({ err }, 'Unhandled error in cycle');
    }
  }, env.POLL_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = (): void => {
    logger.info('Shutting down bot');
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
