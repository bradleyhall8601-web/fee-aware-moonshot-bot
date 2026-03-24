// src/strategy.ts
// Candidate filtering, scoring, and paper-trade simulation.

import { config } from "./config";
import {
  calcBuySize,
  checkExit,
  scoreCandidate,
} from "./risk";
import {
  fetchDexScreenerPairs,
  fetchTokenPrice,
  fetchWhaleSignals,
  pairToCandidate,
} from "./providers";
import {
  addCash,
  closePosition,
  deductCash,
  getCash,
  getPositions,
  getWatchedWallets,
  loadState,
  markScanTime,
  openPosition,
  recordTrade,
  setBlockedReasons,
  updateLiquiditySnapshot,
  updatePositionPrice,
} from "./state";
import { Position, TokenCandidate, TradeRecord } from "./types";

// ── Candidate scanning ────────────────────────────────────────────────────────

/**
 * Scans DexScreener for Solana meme-coin candidates, applies filters,
 * scores each candidate, and returns them sorted by confidence descending.
 */
export async function scanCandidates(): Promise<TokenCandidate[]> {
  markScanTime();

  const rawPairs = await fetchDexScreenerPairs("solana meme");
  const solanaPairs = rawPairs.filter((p) => p.chainId === "solana");

  const blocked: string[] = [];
  const candidates: TokenCandidate[] = [];

  for (const pair of solanaPairs) {
    const c = pairToCandidate(pair);

    // Only allow configured DEXes
    if (
      config.allowedDexIds.length &&
      !config.allowedDexIds.includes(c.dexId)
    ) {
      continue;
    }

    // Liquidity filter
    if (c.liquidityUsd < config.MIN_LIQUIDITY_USD) {
      blocked.push(`${c.symbol}: low liquidity ${c.liquidityUsd.toFixed(0)}`);
      continue;
    }

    // Volume filter
    if (c.volumeUsd24h < config.MIN_VOLUME_USD) {
      blocked.push(`${c.symbol}: low volume ${c.volumeUsd24h.toFixed(0)}`);
      continue;
    }

    // Buy/sell ratio filter
    if (c.buySellRatio < config.MIN_BUY_SELL_RATIO) {
      blocked.push(
        `${c.symbol}: ratio ${c.buySellRatio.toFixed(2)} < ${config.MIN_BUY_SELL_RATIO}`
      );
      continue;
    }

    // Track liquidity snapshot
    updateLiquiditySnapshot(c.pairAddress, c.liquidityUsd);

    c.confidence = scoreCandidate(c);
    candidates.push(c);
  }

  // Surface whale signals and boost confidence
  const watchedWallets = getWatchedWallets().map((w) => w.address);
  if (watchedWallets.length > 0) {
    const signals = await fetchWhaleSignals(watchedWallets);
    for (const sig of signals) {
      const match = candidates.find((c) => c.address === sig.tokenAddress);
      if (match && sig.action === "buy") {
        match.confidence = Math.min(100, match.confidence + sig.confidence * 10);
      }
    }
  }

  setBlockedReasons(blocked.slice(0, 20));

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

// ── Paper buy simulation ──────────────────────────────────────────────────────

export interface BuyResult {
  ok: boolean;
  reason: string;
  trade?: TradeRecord;
}

export async function simulateBuy(candidate: TokenCandidate): Promise<BuyResult> {
  if (config.enableLiveTrading) {
    return { ok: false, reason: "Live trading is disabled in this bot" };
  }

  const cash = getCash();
  if (cash < 10) {
    return { ok: false, reason: `Insufficient cash: $${cash.toFixed(2)}` };
  }

  const state = loadState();
  if (state.positions[candidate.address]) {
    return { ok: false, reason: `Already in position: ${candidate.symbol}` };
  }

  const posCount = Object.keys(state.positions).length;
  const maxPositionUsd = Math.max(config.MAX_POSITION_USD, 1);
  const maxPositions = Math.floor(
    config.SIM_START_BALANCE_USD / maxPositionUsd
  );
  if (posCount >= maxPositions) {
    return {
      ok: false,
      reason: `Max positions (${maxPositions}) reached`,
    };
  }

  const spendUsd = calcBuySize(cash);
  if (spendUsd < 10) {
    return { ok: false, reason: "Buy size too small" };
  }

  const price = candidate.priceUsd || (await fetchTokenPrice(candidate.address)) || 0;
  if (price <= 0) {
    return { ok: false, reason: "Could not determine token price" };
  }

  const units = spendUsd / price;

  const pos: Position = {
    symbol: candidate.symbol,
    address: candidate.address,
    entryPriceUsd: price,
    currentPriceUsd: price,
    units,
    costUsd: spendUsd,
    currentValueUsd: spendUsd,
    unrealizedPnlUsd: 0,
    unrealizedPnlPct: 0,
    highWaterMarkUsd: spendUsd,
    openedAt: Date.now(),
  };

  deductCash(spendUsd);
  openPosition(pos);

  const trade: TradeRecord = {
    id: `buy-${Date.now()}-${candidate.symbol}`,
    type: "buy",
    symbol: candidate.symbol,
    address: candidate.address,
    priceUsd: price,
    units,
    valueUsd: spendUsd,
    timestamp: Date.now(),
    reason: "auto-scan",
  };
  recordTrade(trade);

  return { ok: true, reason: "ok", trade };
}

// ── Paper sell simulation ─────────────────────────────────────────────────────

export interface SellResult {
  ok: boolean;
  reason: string;
  trade?: TradeRecord;
  pnlUsd?: number;
}

export async function simulateSell(
  tokenAddress: string,
  reason = "manual"
): Promise<SellResult> {
  const state = loadState();
  const pos = state.positions[tokenAddress];
  if (!pos) {
    return { ok: false, reason: `No open position for ${tokenAddress}` };
  }

  const price =
    (await fetchTokenPrice(tokenAddress)) ?? pos.currentPriceUsd;

  updatePositionPrice(tokenAddress, price);

  const closedPos = closePosition(tokenAddress);
  if (!closedPos) {
    return { ok: false, reason: "Failed to close position" };
  }

  const saleUsd = closedPos.units * price;
  const pnlUsd = saleUsd - closedPos.costUsd;

  addCash(saleUsd);

  const trade: TradeRecord = {
    id: `sell-${Date.now()}-${closedPos.symbol}`,
    type: "sell",
    symbol: closedPos.symbol,
    address: tokenAddress,
    priceUsd: price,
    units: closedPos.units,
    valueUsd: saleUsd,
    timestamp: Date.now(),
    reason,
    pnlUsd,
  };
  recordTrade(trade);

  return { ok: true, reason: "ok", trade, pnlUsd };
}

// ── Auto-trade tick ───────────────────────────────────────────────────────────

/**
 * Called on each poll interval:
 * 1. Refresh existing positions and check exits.
 * 2. Scan for new candidates and buy the best one if conditions allow.
 */
export async function autoTradeTick(
  log: (msg: string) => void
): Promise<void> {
  // 1. Refresh positions & check exits
  const positions = getPositions();
  for (const pos of positions) {
    const newPrice = await fetchTokenPrice(pos.address);
    if (newPrice !== null) {
      updatePositionPrice(pos.address, newPrice);
    }
    const exitReason = checkExit(pos);
    if (exitReason) {
      const result = await simulateSell(pos.address, exitReason);
      if (result.ok) {
        log(
          `[strategy] Sold ${pos.symbol} (${exitReason}) ` +
            `PnL: $${result.pnlUsd?.toFixed(2) ?? "?"}`
        );
      }
    }
  }

  // 2. Scan for new candidates
  const candidates = await scanCandidates();
  log(`[strategy] Scanned ${candidates.length} candidates`);

  if (candidates.length === 0) return;

  const best = candidates[0];
  log(
    `[strategy] Best: ${best.symbol} liq=$${best.liquidityUsd.toFixed(0)} ` +
      `vol=$${best.volumeUsd24h.toFixed(0)} conf=${best.confidence}`
  );

  const result = await simulateBuy(best);
  if (result.ok && result.trade) {
    log(
      `[strategy] Paper BUY ${best.symbol} @ $${result.trade.priceUsd.toFixed(6)} ` +
        `($${result.trade.valueUsd.toFixed(2)})`
    );
  } else if (!result.ok) {
    log(`[strategy] Buy blocked: ${result.reason}`);
  }
}
