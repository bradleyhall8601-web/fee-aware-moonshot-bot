import { DexPair } from './types';
import { env } from './env';
import { logger } from './logger';
import { fetchPairsByMints, searchSolanaPairs } from './scanner';
import { passesFilter } from './filter';
import { getQuote, isPriceImpactAcceptable, estimateFeeCostUsd, WSOL_MINT } from './swapper';
import { paperTrader, evaluateExit } from './paper';

/** Amount in USD to invest per position */
const POSITION_SIZE_USD = 50;
/** Lamports per SOL (used to translate USD → lamports for quotes) */
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Run one full scan-filter-trade-monitor cycle.
 * In paper mode no real transactions are submitted.
 */
export async function runCycle(currentSolPriceUsd = 150): Promise<void> {
  // ── 1. Scan for candidate pairs ──────────────────────────────────────────
  let pairs: DexPair[] = [];

  if (env.WATCHLIST_MINTS.length > 0) {
    pairs = await fetchPairsByMints(env.WATCHLIST_MINTS);
  } else {
    pairs = await searchSolanaPairs('solana');
  }

  logger.debug({ count: pairs.length }, 'Scan: fetched pairs');

  // ── 2. Filter ────────────────────────────────────────────────────────────
  const candidates = pairs.filter(passesFilter);
  logger.debug({ count: candidates.length }, 'Scan: pairs passing filter');

  // ── 3. Open new positions ────────────────────────────────────────────────
  const alreadyOpen = new Set(paperTrader.openPositions.map((p) => p.mint));

  for (const pair of candidates) {
    const mint = pair.baseToken.address;

    if (alreadyOpen.has(mint)) continue;

    const priceUsd = parseFloat(pair.priceUsd);
    if (!isFinite(priceUsd) || priceUsd <= 0) continue;

    // Fee-awareness: check Jupiter price impact before committing
    if (env.ENABLE_LIVE_TRADING) {
      const amountLamports = Math.round((POSITION_SIZE_USD / currentSolPriceUsd) * LAMPORTS_PER_SOL);
      const quote = await getQuote(WSOL_MINT, mint, amountLamports);

      if (!quote) {
        logger.warn({ mint }, 'Skipping: no Jupiter quote');
        continue;
      }

      if (!isPriceImpactAcceptable(quote)) {
        logger.info({ mint, impact: quote.priceImpactPct }, 'Skipping: price impact too high');
        continue;
      }

      // TODO: submit real transaction via Jupiter /swap
      logger.info({ mint }, 'Live trading not yet wired — use ENABLE_LIVE_TRADING=false');
    } else {
      // Paper trade: simulate with a 0.3 % price-impact assumption
      const simImpactPct = 0.3;
      const entryFee = estimateFeeCostUsd(POSITION_SIZE_USD, simImpactPct);

      paperTrader.openPosition(
        mint,
        pair.baseToken.symbol,
        pair.pairAddress,
        priceUsd,
        POSITION_SIZE_USD,
        entryFee,
      );
    }
  }

  // ── 4. Monitor open positions ────────────────────────────────────────────
  for (const pos of paperTrader.openPositions) {
    // Re-fetch current price from DexScreener
    const [fresh] = await fetchPairsByMints([pos.mint]);
    if (!fresh) {
      paperTrader.incrementMomentumFail(pos.mint);
      logger.debug({ mint: pos.mint }, 'Monitor: no data, incrementing momentum fail');
      continue;
    }

    const currentPriceUsd = parseFloat(fresh.priceUsd);
    if (!isFinite(currentPriceUsd) || currentPriceUsd <= 0) {
      paperTrader.incrementMomentumFail(pos.mint);
      continue;
    }

    // Check momentum — price change in 5m window must remain positive
    if ((fresh.priceChange?.m5 ?? 0) < 0) {
      paperTrader.incrementMomentumFail(pos.mint);
    }

    paperTrader.updatePrice(pos.mint, currentPriceUsd);

    const exitReason = evaluateExit(pos, currentPriceUsd);
    if (exitReason) {
      const exitFee = estimateFeeCostUsd(pos.sizeUsd, 0.3);
      paperTrader.closePosition(pos.mint, currentPriceUsd, exitReason, exitFee);
    }
  }

  const summary = paperTrader.summary();
  logger.info(summary, 'Cycle complete');
}
