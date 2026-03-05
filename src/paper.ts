import { BotState, Pair, Position } from "./types";

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

  monitorOpenPositions(): number {
    for (const position of this.state.positions) {
      const swing = (Math.random() - 0.5) * 0.04;
      position.lastPriceUsd = Math.max(0.0000001, position.lastPriceUsd * (1 + swing));
    }
    return this.state.positions.length;
  }

  evaluateExits(profitTargetPct: number, trailingStopPct: number): number {
    const kept: Position[] = [];
    let closed = 0;

    for (const position of this.state.positions) {
      const pnlPct = ((position.lastPriceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;
      if (pnlPct >= profitTargetPct || pnlPct <= -Math.abs(trailingStopPct)) {
        this.state.paperBalanceUsd += position.amount * position.lastPriceUsd;
        this.state.closedPositions += 1;
        closed += 1;
      } else {
        kept.push(position);
      }
    }

    this.state.positions = kept;
    return closed;
  }

  openPaperPosition(pair: Pair, buyUsd = 25): boolean {
    if (this.state.paperBalanceUsd < buyUsd || pair.priceUsd <= 0) {
      return false;
    }

    this.state.paperBalanceUsd -= buyUsd;
    this.state.positions.push({
      mint: pair.mint,
      symbol: pair.symbol,
      entryPriceUsd: pair.priceUsd,
      lastPriceUsd: pair.priceUsd,
      amount: buyUsd / pair.priceUsd,
      openedAtMs: Date.now()
    });
    return true;
  }
}
