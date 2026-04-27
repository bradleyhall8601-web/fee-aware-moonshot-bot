// src/coin-learning.ts
// Token pattern learning

import telemetryLogger from './telemetry';

export interface CoinPattern {
  mint: string;
  symbol: string;
  wins: number;
  losses: number;
  avgProfitPct: number;
  avgHoldMs: number;
  bestMode: string;
  lastSeen: number;
}

class CoinLearning {
  private patterns = new Map<string, CoinPattern>();

  recordTrade(
    mint: string,
    symbol: string,
    profitPct: number,
    holdMs: number,
    mode: string,
    win: boolean
  ): void {
    const existing = this.patterns.get(mint) || {
      mint,
      symbol,
      wins: 0,
      losses: 0,
      avgProfitPct: 0,
      avgHoldMs: 0,
      bestMode: mode,
      lastSeen: Date.now(),
    };

    if (win) existing.wins++;
    else existing.losses++;

    const total = existing.wins + existing.losses;
    existing.avgProfitPct = (existing.avgProfitPct * (total - 1) + profitPct) / total;
    existing.avgHoldMs = (existing.avgHoldMs * (total - 1) + holdMs) / total;
    existing.lastSeen = Date.now();

    if (win) existing.bestMode = mode;
    this.patterns.set(mint, existing);
  }

  getPattern(mint: string): CoinPattern | null {
    return this.patterns.get(mint) || null;
  }

  getWinRate(mint: string): number {
    const p = this.patterns.get(mint);
    if (!p) return 0;
    const total = p.wins + p.losses;
    return total > 0 ? (p.wins / total) * 100 : 0;
  }

  getBestTokens(limit = 10): CoinPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.wins + p.losses >= 3)
      .sort((a, b) => {
        const aWr = a.wins / (a.wins + a.losses);
        const bWr = b.wins / (b.wins + b.losses);
        return bWr - aWr;
      })
      .slice(0, limit);
  }

  getStats() {
    return {
      trackedTokens: this.patterns.size,
      bestTokens: this.getBestTokens(5),
    };
  }
}

export default new CoinLearning();
