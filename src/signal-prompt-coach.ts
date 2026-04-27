// src/signal-prompt-coach.ts
// Signal prompt optimization

import telemetryLogger from './telemetry';
import type { AggregatedSignal } from './signal-aggregator';

interface PromptPerformance {
  promptVersion: number;
  wins: number;
  losses: number;
  avgConfidence: number;
}

class SignalPromptCoach {
  private performance: PromptPerformance = { promptVersion: 1, wins: 0, losses: 0, avgConfidence: 0 };
  private confidenceHistory: number[] = [];

  recordOutcome(confidence: number, win: boolean): void {
    this.confidenceHistory.push(confidence);
    if (this.confidenceHistory.length > 100) this.confidenceHistory.shift();
    if (win) this.performance.wins++;
    else this.performance.losses++;
    this.performance.avgConfidence = this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length;
  }

  getOptimalThreshold(): number {
    if (this.confidenceHistory.length < 10) return 68;
    // Find threshold that maximizes win rate
    const sorted = [...this.confidenceHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return Math.max(60, Math.min(85, Math.round(median)));
  }

  buildEnhancedPrompt(signal: AggregatedSignal): string {
    return `Analyze this Solana token for trading potential:
Symbol: ${signal.symbol}
Liquidity: $${signal.liquidity.toLocaleString()}
1h Volume: $${signal.volume1h.toLocaleString()}
Buy Pressure: ${signal.buyPressure.toFixed(1)}%
5m Change: ${signal.priceChange5m.toFixed(2)}%
Age: ${signal.ageHours.toFixed(1)}h
Sources: ${signal.sources.join(', ')}
Historical win rate at this confidence level: ${this.getWinRate().toFixed(1)}%`;
  }

  getWinRate(): number {
    const total = this.performance.wins + this.performance.losses;
    return total > 0 ? (this.performance.wins / total) * 100 : 0;
  }

  getStats() {
    return { ...this.performance, winRate: this.getWinRate() };
  }
}

export default new SignalPromptCoach();
