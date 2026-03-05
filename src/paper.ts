import { BotState, ExitReason, Pair, Position, Trade } from "./types";

export class PaperTrader {
  private state: BotState;

  constructor(initialState: BotState) {
    this.state = initialState;
  }

  resume(state: BotState): void {
    this.state = state;
  }

  getState(): BotState {
    return this.state;
  }

  getPositions(): Position[] {
    return this.state.positions;
  }

  monitorOpenPositions(): number {
    for (const position of this.state.positions) {
      const previous = position.lastPriceUsd;
      const swing = (Math.random() - 0.5) * 0.04;
      position.lastPriceUsd = Math.max(0.0000001, position.lastPriceUsd * (1 + swing));
      position.highWatermarkUsd = Math.max(position.highWatermarkUsd, position.lastPriceUsd);
      if (position.lastPriceUsd < previous) {
        position.momentumFailCount += 1;
      } else {
        position.momentumFailCount = 0;
      }
    }
    return this.state.positions.length;
  }

  openPaperPosition(
    pair: Pair,
    buyUsd: number,
    feeUsd = 0,
    txSig?: string,
    amountRaw?: string
  ): Position | null {
    if (pair.priceUsd <= 0) {
      return null;
    }

    const totalCost = buyUsd + Math.max(0, feeUsd);
    if (this.state.paperBalanceUsd <= 0 || totalCost <= 0) {
      return null;
    }

    const cappedBuyUsd = Math.min(buyUsd, this.state.paperBalanceUsd);
    const effectiveFee = Math.min(feeUsd, Math.max(0, this.state.paperBalanceUsd - cappedBuyUsd));

    if (this.state.positions.some((position) => position.mint === pair.mint)) {
      return null;
    }

    this.state.paperBalanceUsd -= cappedBuyUsd + effectiveFee;

    const position: Position = {
      mint: pair.mint,
      symbol: pair.symbol,
      entryPriceUsd: pair.priceUsd,
      lastPriceUsd: pair.priceUsd,
      highWatermarkUsd: pair.priceUsd,
      sizeUsd: cappedBuyUsd,
      amountTokens: cappedBuyUsd / pair.priceUsd,
      amountRaw,
      momentumFailCount: 0,
      partialTaken: false,
      realizedPartialPnlUsd: 0,
      entryTxSig: txSig,
      openedAtMs: Date.now()
    };

    this.state.positions.push(position);
    return position;
  }

  applyPartialSell(mint: string, currentPriceUsd: number, feeUsd = 0, txSig?: string): Position | null {
    const position = this.state.positions.find((entry) => entry.mint === mint);
    if (!position || position.partialTaken || currentPriceUsd <= 0) {
      return null;
    }

    const soldSizeUsd = position.sizeUsd * 0.5;
    const soldAmountTokens = position.amountTokens * 0.5;
    const proceedsUsd = soldAmountTokens * currentPriceUsd;
    const realizedPnlUsd = proceedsUsd - soldSizeUsd - Math.max(0, feeUsd);

    position.sizeUsd -= soldSizeUsd;
    position.amountTokens -= soldAmountTokens;
    position.partialTaken = true;
    position.realizedPartialPnlUsd += realizedPnlUsd;
    position.lastPartialTxSig = txSig;
    position.lastPriceUsd = currentPriceUsd;
    position.highWatermarkUsd = Math.max(position.highWatermarkUsd, currentPriceUsd);
    position.momentumFailCount = 0;

    this.state.realizedPnlUsd += realizedPnlUsd;
    this.state.paperBalanceUsd += proceedsUsd;

    if (position.amountRaw) {
      const raw = BigInt(position.amountRaw);
      position.amountRaw = (raw / 2n).toString();
    }

    return position;
  }

  closePosition(
    mint: string,
    currentPriceUsd: number,
    reason: ExitReason,
    feeUsd = 0,
    txSig?: string
  ): Trade | null {
    const index = this.state.positions.findIndex((entry) => entry.mint === mint);
    if (index < 0 || currentPriceUsd <= 0) {
      return null;
    }

    const position = this.state.positions[index];
    const proceedsUsd = position.amountTokens * currentPriceUsd;
    const realizedPnlUsd = proceedsUsd - position.sizeUsd - Math.max(0, feeUsd);

    this.state.positions.splice(index, 1);
    this.state.closedPositions += 1;
    this.state.realizedPnlUsd += realizedPnlUsd;
    this.state.paperBalanceUsd += proceedsUsd;

    const trade: Trade = {
      mint: position.mint,
      symbol: position.symbol,
      entryPriceUsd: position.entryPriceUsd,
      exitPriceUsd: currentPriceUsd,
      sizeUsd: position.sizeUsd,
      realizedPnlUsd,
      openedAtMs: position.openedAtMs,
      closedAtMs: Date.now(),
      reason,
      entryTxSig: position.entryTxSig,
      exitTxSig: txSig
    };

    this.state.closedTrades.push(trade);
    return trade;
  }

  summary(): { openCount: number; tradeCount: number; totalPnlUsd: number } {
    return {
      openCount: this.state.positions.length,
      tradeCount: this.state.closedTrades.length,
      totalPnlUsd: this.state.realizedPnlUsd
    };
  }
}
