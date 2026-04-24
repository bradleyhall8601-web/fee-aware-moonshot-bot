import database from './database';
import telemetryLogger from './telemetry';

export interface TradeOutcome {
  mint: string;
  profitPct: number;
  durationMs: number;
  entryConfidence: number;
  timestamp: number;
}

class AIBrain {
  private history: TradeOutcome[] = [];
  private readonly maxHistory = 500;

  constructor() {
    this.history = database.getRecentAiTradeOutcomes(this.maxHistory).reverse();
  }

  record(outcome: TradeOutcome): void {
    if (!Number.isFinite(outcome.profitPct) || outcome.durationMs <= 0) {
      telemetryLogger.warn('Skipped invalid AI outcome record', 'ai-brain');
      return;
    }

    this.history.push(outcome);
    if (this.history.length > this.maxHistory) this.history.shift();

    database.saveAiTradeOutcome(outcome);
    telemetryLogger.info(`🧠 AI_LEARN mint=${outcome.mint} profit=${outcome.profitPct.toFixed(2)}% durationMs=${outcome.durationMs}`, 'ai-brain');
  }

  getWinRate(): number {
    if (this.history.length === 0) return 0;
    const wins = this.history.filter((t) => t.profitPct > 0).length;
    return (wins / this.history.length) * 100;
  }

  getAverageProfit(): number {
    if (this.history.length === 0) return 0;
    return this.history.reduce((sum, t) => sum + t.profitPct, 0) / this.history.length;
  }

  getStreak(): { wins: number; losses: number } {
    let wins = 0;
    let losses = 0;

    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const p = this.history[i].profitPct;
      if (p > 0 && losses === 0) {
        wins += 1;
      } else if (p <= 0 && wins === 0) {
        losses += 1;
      } else {
        break;
      }
    }

    return { wins, losses };
  }

  adjustConfidence(baseConfidence: number): number {
    const winRate = this.getWinRate();
    const avgProfit = this.getAverageProfit();
    const streak = this.getStreak();

    // Gradual adaptation; avoid overfitting.
    const winAdj = Math.max(-8, Math.min(8, (winRate - 50) * 0.12));
    const profitAdj = Math.max(-5, Math.min(5, avgProfit * 0.25));
    const streakAdj = Math.min(6, streak.wins * 1.2) - Math.min(6, streak.losses * 1.5);

    const adjusted = baseConfidence + winAdj + profitAdj + streakAdj;
    const finalConfidence = Math.max(0, Math.min(100, adjusted));

    telemetryLogger.debug(`🧠 AI_DECISION base=${baseConfidence.toFixed(2)} winAdj=${winAdj.toFixed(2)} profitAdj=${profitAdj.toFixed(2)} streakAdj=${streakAdj.toFixed(2)} final=${finalConfidence.toFixed(2)}`, 'ai-brain');
    return finalConfidence;
  }

  getSummary() {
    const streak = this.getStreak();
    return {
      tradesObserved: this.history.length,
      winRate: this.getWinRate(),
      averageProfitPct: this.getAverageProfit(),
      streak,
    };
  }
}

export default new AIBrain();
