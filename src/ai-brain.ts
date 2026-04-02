export interface TradeOutcome {
  mint: string;
  profitPct: number;
  durationMs: number;
  entryConfidence: number;
  timestamp: number;
}

class AIBrain {
  private history: TradeOutcome[] = [];

  record(outcome: TradeOutcome): void {
    this.history.push(outcome);
    if (this.history.length > 250) this.history.shift();
  }

  getWinRate(): number {
    if (this.history.length === 0) return 0;
    const wins = this.history.filter(t => t.profitPct > 0).length;
    return (wins / this.history.length) * 100;
  }

  getAverageProfit(): number {
    if (this.history.length === 0) return 0;
    return this.history.reduce((sum, t) => sum + t.profitPct, 0) / this.history.length;
  }

  adjustConfidence(baseConfidence: number): number {
    const winRate = this.getWinRate();
    const avgProfit = this.getAverageProfit();

    let adjusted = baseConfidence;
    if (winRate >= 65) adjusted += 5;
    if (winRate <= 40) adjusted -= 10;
    if (avgProfit >= 8) adjusted += 3;
    if (avgProfit <= -5) adjusted -= 6;

    return Math.max(0, Math.min(100, adjusted));
  }

  getSummary() {
    return {
      tradesObserved: this.history.length,
      winRate: this.getWinRate(),
      averageProfitPct: this.getAverageProfit(),
    };
  }
}

export default new AIBrain();
