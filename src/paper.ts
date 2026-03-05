import { BotState, DexPair, ExitReason, Position, Trade } from "./types";

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

  getOpenCount(): number {
    return this.state.positions.length;
  }

  getExposureUsd(): number {
    return this.state.positions.reduce((sum, position) => sum + position.remainingSizeUsd, 0);
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
    this.state.exposureUsd = this.getExposureUsd();
    return this.state.positions.length;
  }

  openPosition(pair: DexPair, buyUsd: number, feeUsd = 0, txSig?: string, amountRaw?: string): Position | null {
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
      pairAddress: pair.pairAddress,
      mint: pair.mint,
      symbol: pair.symbol,
      entryPriceUsd: pair.priceUsd,
      lastPriceUsd: pair.priceUsd,
      highWatermarkUsd: pair.priceUsd,
      sizeUsd: cappedBuyUsd,
      remainingSizeUsd: cappedBuyUsd,
      amountTokens: cappedBuyUsd / pair.priceUsd,
      remainingTokens: cappedBuyUsd / pair.priceUsd,
      amountRaw,
      momentumFailCount: 0,
      hasTakenProfit: false,
      realizedPartialPnlUsd: 0,
      entryTxSig: txSig,
      openedAtMs: Date.now()
    };

    this.state.positions.push(position);
    this.state.exposureUsd = this.getExposureUsd();
    return position;
  }

  applyPartialSell(mint: string, currentPriceUsd: number, feeUsd = 0, txSig?: string): Position | null {
    const position = this.state.positions.find((entry) => entry.mint === mint);
    if (!position || position.hasTakenProfit || currentPriceUsd <= 0) {
      return null;
    }

    const soldSizeUsd = position.remainingSizeUsd * 0.5;
    const soldAmountTokens = position.remainingTokens * 0.5;
    const proceedsUsd = soldAmountTokens * currentPriceUsd;
    const realizedPnlUsd = proceedsUsd - soldSizeUsd - Math.max(0, feeUsd);

    position.remainingSizeUsd -= soldSizeUsd;
    position.remainingTokens -= soldAmountTokens;
    position.hasTakenProfit = true;
    position.realizedPartialPnlUsd += realizedPnlUsd;
    position.partialExitTime = Date.now();
    position.lastPartialTxSig = txSig;
    position.lastPriceUsd = currentPriceUsd;
    position.highWatermarkUsd = Math.max(position.highWatermarkUsd, currentPriceUsd);
    position.momentumFailCount = 0;

    this.state.stats.totalPnlUsd += realizedPnlUsd;
    this.state.paperBalanceUsd += proceedsUsd;
    this.state.exposureUsd = this.getExposureUsd();

    if (position.amountRaw) {
      const raw = BigInt(position.amountRaw);
      position.amountRaw = (raw / 2n).toString();
    }

    this.state.closedTrades.push({
      mint: position.mint,
      symbol: position.symbol,
      pairAddress: position.pairAddress,
      entryPriceUsd: position.entryPriceUsd,
      exitPriceUsd: currentPriceUsd,
      sizeUsd: soldSizeUsd,
      isPartial: true,
      realizedPnlUsd,
      realizedPartialPnlUsd: realizedPnlUsd,
      partialExitTime: position.partialExitTime,
      openedAtMs: position.openedAtMs,
      closedAtMs: Date.now(),
      reason: "profit_target",
      entryTxSig: position.entryTxSig,
      exitTxSig: txSig
    });
    this.state.stats.tradeCount += 1;

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
    const proceedsUsd = position.remainingTokens * currentPriceUsd;
    const realizedPnlUsd = proceedsUsd - position.remainingSizeUsd - Math.max(0, feeUsd);

    this.state.positions.splice(index, 1);
    this.state.stats.totalPnlUsd += realizedPnlUsd;
    this.state.paperBalanceUsd += proceedsUsd;
    this.state.exposureUsd = this.getExposureUsd();

    const trade: Trade = {
      mint: position.mint,
      symbol: position.symbol,
      pairAddress: position.pairAddress,
      entryPriceUsd: position.entryPriceUsd,
      exitPriceUsd: currentPriceUsd,
      sizeUsd: position.remainingSizeUsd,
      isPartial: false,
      realizedPnlUsd,
      realizedPartialPnlUsd: position.realizedPartialPnlUsd || undefined,
      partialExitTime: position.partialExitTime,
      openedAtMs: position.openedAtMs,
      closedAtMs: Date.now(),
      reason,
      entryTxSig: position.entryTxSig,
      exitTxSig: txSig
    };

    this.state.closedTrades.push(trade);
    this.state.stats.tradeCount += 1;
    return trade;
  }

  summary(): { openCount: number; tradeCount: number; totalPnlUsd: number } {
    return {
      openCount: this.state.positions.length,
      tradeCount: this.state.stats.tradeCount,
      totalPnlUsd: this.state.stats.totalPnlUsd
    };
  }
}
