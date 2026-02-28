import { env } from './env';
import { Position } from './types';

/** Percentage stop-loss threshold (e.g. 0.05 = 5 %). */
export const STOP_LOSS_THRESHOLD = 0.05;

/**
 * Returns true when the position has fallen below the configured hard stop-loss.
 * @param currentPrice  - Current market price
 * @param purchasePrice - Entry price
 */
export function manageStopLoss(currentPrice: number, purchasePrice: number): boolean {
  const lossPercentage = (purchasePrice - currentPrice) / purchasePrice;
  return lossPercentage >= STOP_LOSS_THRESHOLD;
}

/**
 * Returns true when the current condition (e.g. price) has fallen to or below
 * the fallback trigger level.
 */
export function monitorFallback(currentCondition: number, fallbackCondition: number): boolean {
  return currentCondition <= fallbackCondition;
}

/**
 * Returns true when the trailing stop has been breached for a position.
 * The stop fires when price drops TRAILING_STOP_PCT % from the high-watermark.
 */
export function isTrailingStopBreached(position: Position, currentPriceUsd: number): boolean {
  const drawdownPct =
    ((position.highWatermarkUsd - currentPriceUsd) / position.highWatermarkUsd) * 100;
  return drawdownPct >= env.TRAILING_STOP_PCT;
}

/**
 * Returns true when the profit target has been reached.
 */
export function isProfitTargetReached(position: Position, currentPriceUsd: number): boolean {
  const gainPct =
    ((currentPriceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;
  return gainPct >= env.PROFIT_TARGET_PCT;
}