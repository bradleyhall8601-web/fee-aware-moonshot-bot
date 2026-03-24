// src/risk.ts
// Risk management: position sizing, stop-loss, take-profit, confidence scoring.

import { config } from "./config";
import { Position, TokenCandidate } from "./types";

// ── Stop-loss / take-profit checks ────────────────────────────────────────────

/**
 * Returns true if a position has hit its take-profit target.
 */
export function shouldTakeProfit(pos: Position): boolean {
  return pos.unrealizedPnlPct >= config.TAKE_PROFIT_PCT;
}

/**
 * Returns true if a position's trailing stop has been triggered.
 * The trailing stop fires when price drops more than TRAILING_STOP_PCT
 * below the high-water mark.
 */
export function shouldTrailingStop(pos: Position): boolean {
  if (pos.highWaterMarkUsd <= 0) return false;
  const drawdownPct =
    ((pos.highWaterMarkUsd - pos.currentValueUsd) / pos.highWaterMarkUsd) *
    100;
  return drawdownPct >= config.TRAILING_STOP_PCT;
}

/**
 * Legacy helper: returns true if stop-loss threshold is breached.
 */
export function manageStopLoss(
  currentPrice: number,
  purchasePrice: number
): boolean {
  if (purchasePrice <= 0) return false;
  const lossPercentage = (purchasePrice - currentPrice) / purchasePrice;
  return lossPercentage >= 0.05;
}

/**
 * Legacy helper: returns true if a fallback condition is met.
 */
export function monitorFallback(
  currentCondition: number,
  fallbackCondition: number
): boolean {
  return currentCondition <= fallbackCondition;
}

// ── Position sizing ───────────────────────────────────────────────────────────

/**
 * Calculates how many USD to deploy for a new paper trade.
 * Respects MAX_BUY_USD and MAX_POSITION_USD limits.
 */
export function calcBuySize(cashUsd: number): number {
  const maxBuy = Math.min(config.MAX_BUY_USD, config.MAX_POSITION_USD);
  return Math.min(cashUsd, maxBuy);
}

// ── Confidence scoring ────────────────────────────────────────────────────────

/**
 * Scores a token candidate 0–100 based on liquidity, volume and buy/sell ratio.
 * Higher is better.
 */
export function scoreCandidate(c: TokenCandidate): number {
  let score = 0;

  // Liquidity component (0-40 points)
  const liqScore = Math.min(
    40,
    (c.liquidityUsd / config.MIN_LIQUIDITY_USD) * 10
  );
  score += liqScore;

  // Volume component (0-30 points)
  const volScore = Math.min(30, (c.volumeUsd24h / config.MIN_VOLUME_USD) * 5);
  score += volScore;

  // Buy/sell ratio component (0-20 points)
  if (c.buySellRatio > 1) {
    const ratioScore = Math.min(20, (c.buySellRatio - 1) * 40);
    score += ratioScore;
  }

  // Whale signal boost (0-10 points) – placeholder for future whale signals
  score += 0;

  return Math.round(Math.min(100, score));
}

/**
 * Returns exit reason string, or null if the position should stay open.
 */
export function checkExit(pos: Position): string | null {
  if (shouldTakeProfit(pos)) return "take-profit";
  if (shouldTrailingStop(pos)) return "trailing-stop";
  return null;
}