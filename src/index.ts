/**
 * fee-aware-moonshot-bot
 *
 * ⚠️  DISCLAIMER: This software is for educational purposes only.
 *     Trading cryptocurrencies carries significant financial risk.
 *     There are NO profit guarantees. You may lose all invested funds.
 *     Use at your own risk. The authors accept no liability for losses.
 */

import "dotenv/config";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { discoverCandidates, fetchTokenPairs } from "./dexscreener.js";
import { applyMoonshotFilter, rankByMomentum } from "./strategy/filters.js";
import { enterPosition } from "./strategy/entry.js";
import { processExit, calcPnlPct } from "./strategy/exit.js";
import { getOpenPositions, hasOpenPositionForMint } from "./positions/store.js";
import { DexPair } from "./positions/types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runLoop(): Promise<void> {
  logger.info(
    {
      paperMode: !config.ENABLE_LIVE_TRADING,
      pollIntervalSeconds: config.POLL_INTERVAL_SECONDS,
      maxOpenPositions: config.MAX_OPEN_POSITIONS,
    },
    "🚀 fee-aware-moonshot-bot starting"
  );

  if (!config.ENABLE_LIVE_TRADING) {
    logger.warn("⚠️  PAPER TRADING MODE — no real funds will be used");
  }

  while (true) {
    if (config.ENABLE_KILL_SWITCH) {
      logger.warn("🛑 KILL SWITCH enabled — pausing all trading");
      await sleep(config.POLL_INTERVAL_SECONDS * 1000);
      continue;
    }

    try {
      await tick();
    } catch (err) {
      logger.error({ err }, "Unhandled error in main loop");
    }

    await sleep(config.POLL_INTERVAL_SECONDS * 1000);
  }
}

async function tick(): Promise<void> {
  // ── 1. Update open positions ────────────────────────────────────
  const openPositions = getOpenPositions();
  logger.info({ openCount: openPositions.length }, "Updating open positions");

  for (const pos of openPositions) {
    try {
      const pairs = await fetchTokenPairs(pos.tokenMint);
      const pair = pairs.find((p) => p.pairAddress === pos.pairAddress) ?? pairs[0];
      if (!pair) {
        logger.warn({ tokenMint: pos.tokenMint }, "No pair data for open position");
        continue;
      }
      await processExit(pos, pair);
    } catch (err) {
      logger.error({ err, positionId: pos.id }, "Error processing exit for position");
    }
  }

  // ── 2. Discover new candidates ──────────────────────────────────
  const stillOpen = getOpenPositions();
  if (stillOpen.length >= config.MAX_OPEN_POSITIONS) {
    logger.info(
      { openCount: stillOpen.length, max: config.MAX_OPEN_POSITIONS },
      "Max open positions reached — skipping discovery"
    );
    printSummary(stillOpen, []);
    return;
  }

  let candidates: DexPair[] = [];
  try {
    candidates = await discoverCandidates();
  } catch (err) {
    logger.error({ err }, "Discovery failed");
  }

  // ── 3. Filter candidates ─────────────────────────────────────────
  const passed: DexPair[] = [];
  for (const pair of candidates) {
    const result = applyMoonshotFilter(pair);
    if (result.pass) {
      passed.push(pair);
    } else {
      logger.debug(
        { pair: pair.pairAddress, token: pair.baseToken.symbol, reasons: result.reasons },
        "Pair filtered out"
      );
    }
  }

  const ranked = rankByMomentum(passed);
  logger.info(
    { candidates: candidates.length, passed: passed.length },
    "Filter results"
  );

  // DRY_RUN summary
  if (!config.ENABLE_LIVE_TRADING) {
    logger.info(
      { topCandidates: ranked.slice(0, 5).map((p) => p.baseToken.symbol) },
      "[DRY_RUN] Would consider entering these tokens"
    );
  }

  // ── 4. Enter positions ───────────────────────────────────────────
  for (const pair of ranked) {
    if (getOpenPositions().length >= config.MAX_OPEN_POSITIONS) break;
    if (hasOpenPositionForMint(pair.baseToken.address)) continue;

    try {
      await enterPosition(pair);
    } catch (err) {
      logger.error({ err, pair: pair.pairAddress }, "Entry failed");
    }
  }

  printSummary(getOpenPositions(), ranked);
}

function printSummary(openPositions: ReturnType<typeof getOpenPositions>, candidates: DexPair[]): void {
  if (openPositions.length === 0 && candidates.length === 0) return;

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  fee-aware-moonshot-bot — ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════");

  if (openPositions.length > 0) {
    console.log("\nOpen Positions:");
    console.table(
      openPositions.map((p) => ({
        symbol: p.tokenSymbol,
        entry: `$${p.entryPrice.toFixed(8)}`,
        current: `$${p.currentPrice.toFixed(8)}`,
        "pnl%": `${calcPnlPct(p).toFixed(2)}%`,
        "half sold": p.halfSold ? "✓" : "–",
        paper: p.paper ? "✓" : "✗",
      }))
    );
  }

  if (candidates.length > 0) {
    console.log("\nTop Candidates:");
    console.table(
      candidates.slice(0, 5).map((p) => ({
        symbol: p.baseToken.symbol,
        "liq $": Math.round(p.liquidity?.usd ?? 0),
        "vol h1": Math.round(p.volume?.h1 ?? 0),
        "5m%": (p.priceChange?.m5 ?? 0).toFixed(2),
        pair: p.pairAddress.slice(0, 8) + "…",
      }))
    );
  }
  console.log("");
}

runLoop().catch((err) => {
  logger.fatal({ err }, "Fatal error — bot stopped");
  process.exit(1);
});
