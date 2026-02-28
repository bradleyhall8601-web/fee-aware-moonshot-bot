import { Position, Trade } from './types';
import { env } from './env';
import { logger } from './logger';

/** In-memory paper-trading ledger */
export class PaperTrader {
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private _balanceUsd: number;

  constructor(initialBalanceUsd = 1_000) {
    this._balanceUsd = initialBalanceUsd;
  }

  get balanceUsd(): number {
    return this._balanceUsd;
  }

  get openPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  get closedTrades(): Trade[] {
    return [...this.trades];
  }

  /**
   * Open a paper position.
   * @param mint - Base token mint
   * @param symbol - Base token symbol
   * @param pairAddress - DexScreener pair address
   * @param priceUsd - Current price in USD
   * @param sizeUsd - Amount of USD to invest (capped by available balance)
   * @param entryFeeCostUsd - Estimated fee/impact cost on entry
   */
  openPosition(
    mint: string,
    symbol: string,
    pairAddress: string,
    priceUsd: number,
    sizeUsd: number,
    entryFeeCostUsd = 0,
  ): boolean {
    if (this.positions.has(mint)) {
      logger.debug({ mint }, 'Paper: position already open, skipping');
      return false;
    }

    const effectiveSize = Math.min(sizeUsd, this._balanceUsd);
    if (effectiveSize <= 0) {
      logger.warn({ mint }, 'Paper: insufficient balance to open position');
      return false;
    }

    this._balanceUsd -= effectiveSize + entryFeeCostUsd;

    const position: Position = {
      mint,
      symbol,
      pairAddress,
      entryPriceUsd: priceUsd,
      highWatermarkUsd: priceUsd,
      sizeUsd: effectiveSize,
      entryTime: Date.now(),
      momentumFailCount: 0,
    };

    this.positions.set(mint, position);
    logger.info({ mint, symbol, priceUsd, sizeUsd: effectiveSize }, 'Paper: opened position');
    return true;
  }

  /**
   * Update the current price for a position and bump high-watermark if needed.
   * Returns the updated position or undefined if not found.
   */
  updatePrice(mint: string, currentPriceUsd: number): Position | undefined {
    const pos = this.positions.get(mint);
    if (!pos) return undefined;

    if (currentPriceUsd > pos.highWatermarkUsd) {
      pos.highWatermarkUsd = currentPriceUsd;
    }
    return pos;
  }

  /** Increment momentum-fail counter for a position. */
  incrementMomentumFail(mint: string): void {
    const pos = this.positions.get(mint);
    if (pos) pos.momentumFailCount += 1;
  }

  /**
   * Close a paper position and record the trade.
   * @param mint - Token mint to close
   * @param exitPriceUsd - Current exit price
   * @param reason - Why the position is being closed
   * @param exitFeeCostUsd - Estimated fee/impact cost on exit
   */
  closePosition(
    mint: string,
    exitPriceUsd: number,
    reason: Trade['exitReason'],
    exitFeeCostUsd = 0,
  ): Trade | undefined {
    const pos = this.positions.get(mint);
    if (!pos) return undefined;

    const priceReturn = (exitPriceUsd - pos.entryPriceUsd) / pos.entryPriceUsd;
    const grossPnlUsd = pos.sizeUsd * priceReturn;
    const realizedPnlUsd = grossPnlUsd - exitFeeCostUsd;

    this._balanceUsd += pos.sizeUsd + realizedPnlUsd;

    const trade: Trade = {
      mint: pos.mint,
      symbol: pos.symbol,
      entryPriceUsd: pos.entryPriceUsd,
      exitPriceUsd,
      sizeUsd: pos.sizeUsd,
      realizedPnlUsd,
      entryTime: pos.entryTime,
      exitTime: Date.now(),
      exitReason: reason,
    };

    this.trades.push(trade);
    this.positions.delete(mint);

    logger.info(
      { mint: pos.symbol, exitPriceUsd, realizedPnlUsd: realizedPnlUsd.toFixed(4), reason },
      'Paper: closed position',
    );
    return trade;
  }

  /** Summary stats for logging */
  summary(): {
    balance: number;
    openCount: number;
    tradeCount: number;
    totalPnlUsd: number;
  } {
    const totalPnlUsd = this.trades.reduce((sum, t) => sum + t.realizedPnlUsd, 0);
    return {
      balance: this._balanceUsd,
      openCount: this.positions.size,
      tradeCount: this.trades.length,
      totalPnlUsd,
    };
  }
}

/** Singleton paper trader, exported for reuse across bot modules */
export const paperTrader = new PaperTrader(
  Number(process.env.PAPER_INITIAL_BALANCE_USD ?? 1_000),
);

/**
 * Evaluate an open position against profit-target and trailing-stop thresholds.
 * Returns the exit reason if the position should be closed, or null to keep holding.
 */
export function evaluateExit(
  position: Position,
  currentPriceUsd: number,
): Trade['exitReason'] | null {
  const gainPct =
    ((currentPriceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;

  // Profit target hit
  if (gainPct >= env.PROFIT_TARGET_PCT) return 'profit_target';

  // Trailing stop: price has dropped TRAILING_STOP_PCT % from the high-watermark
  const drawdownPct =
    ((position.highWatermarkUsd - currentPriceUsd) / position.highWatermarkUsd) * 100;
  if (drawdownPct >= env.TRAILING_STOP_PCT) return 'trailing_stop';

  // Too many momentum failures
  if (position.momentumFailCount >= env.MAX_MOMENTUM_FAIL_COUNT) return 'momentum_fail';

  return null;
}
