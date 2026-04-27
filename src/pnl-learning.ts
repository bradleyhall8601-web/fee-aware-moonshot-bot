// src/pnl-learning.ts
// P&L tracking and learning

import telemetryLogger from './telemetry';

export interface TradeRecord {
  id: string;
  mint: string;
  symbol: string;
  mode: string;
  entryPrice: number;
  exitPrice: number;
  profitPct: number;
  profitUsd: number;
  holdTimeMs: number;
  confidence: number;
  sources: string[];
  closeReason: string;
  timestamp: number;
}

class PnLLearning {
  private records: TradeRecord[] = [];
  private ewma = 0; // Exponentially weighted moving average of profit
  private readonly EWMA_ALPHA = 0.1;

  record(trade: TradeRecord): void {
    this.records.push(trade);
    if (this.records.length > 1000) this.records.shift();
    this.ewma = this.EWMA_ALPHA * trade.profitPct + (1 - this.EWMA_ALPHA) * this.ewma;
    telemetryLogger.info(
      `[PNL] ${trade.symbol}: ${trade.profitPct >= 0 ? '+' : ''}${trade.profitPct.toFixed(2)}% EWMA=${this.ewma.toFixed(2)}`,
      'pnl-learning'
    );
  }

  getEWMA(): number { return this.ewma; }

  getStats(limit = 50) {
    const recent = this.records.slice(-limit);
    const wins = recent.filter(r => r.profitPct > 0);
    const losses = recent.filter(r => r.profitPct <= 0);
    const totalProfit = recent.reduce((s, r) => s + r.profitUsd, 0);
    const winRate = recent.length > 0 ? (wins.length / recent.length) * 100 : 0;
    const avgHoldMs = recent.length > 0 ? recent.reduce((s, r) => s + r.holdTimeMs, 0) / recent.length : 0;
    return {
      totalTrades: recent.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalProfit,
      avgWin: wins.length > 0 ? wins.reduce((s, r) => s + r.profitPct, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((s, r) => s + r.profitPct, 0) / losses.length : 0,
      avgHoldMinutes: avgHoldMs / 60000,
      ewma: this.ewma,
    };
  }

  getByMode(mode: string) {
    return this.records.filter(r => r.mode === mode);
  }

  getRecentRecords(limit = 20): TradeRecord[] {
    return this.records.slice(-limit);
  }
}

export default new PnLLearning();
