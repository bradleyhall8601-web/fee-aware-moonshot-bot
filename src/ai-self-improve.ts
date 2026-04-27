// src/ai-self-improve.ts
// 30-minute learning cycle for AI self-improvement

import telemetryLogger from './telemetry';
import confidenceScorer from './confidence-scorer';
import database from './database';

interface LearningCycle {
  cycleAt: number;
  tradesAnalyzed: number;
  adjustments: string[];
  winRate: number;
  threshold: number;
}

class AISelfImprove {
  private cycleInterval: NodeJS.Timeout | null = null;
  private readonly CYCLE_MS = 30 * 60 * 1000; // 30 minutes
  private cycles: LearningCycle[] = [];
  private consecutiveLosses = 0;
  private consecutiveWins = 0;
  private recentResults: boolean[] = []; // true=win, false=loss

  start(): void {
    this.cycleInterval = setInterval(() => this.runCycle(), this.CYCLE_MS);
    telemetryLogger.info('AI self-improvement cycle started (30min)', 'ai-self-improve');
  }

  stop(): void {
    if (this.cycleInterval) clearInterval(this.cycleInterval);
  }

  recordResult(win: boolean): void {
    this.recentResults.push(win);
    if (this.recentResults.length > 50) this.recentResults.shift();

    if (win) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
    }

    // 5-minute streak engine
    this.applyStreakAdjustment();
  }

  private applyStreakAdjustment(): void {
    const threshold = confidenceScorer.getThreshold();

    // 3+ losses = tighten by 6
    if (this.consecutiveLosses >= 3) {
      const newT = Math.min(90, threshold + 6);
      confidenceScorer.setThreshold(newT);
      telemetryLogger.info(`[STREAK] 3+ losses: threshold tightened to ${newT}`, 'ai-self-improve');
      return;
    }

    // Any loss = tighten by 3
    if (this.consecutiveLosses === 1) {
      const newT = Math.min(90, threshold + 3);
      confidenceScorer.setThreshold(newT);
      return;
    }

    // 5+ wins = ease by 1
    if (this.consecutiveWins >= 5) {
      const newT = Math.max(68, threshold - 1);
      confidenceScorer.setThreshold(newT);
      telemetryLogger.info(`[STREAK] 5+ wins: threshold eased to ${newT}`, 'ai-self-improve');
      return;
    }

    // 10+ wins = tighten by 1 (maintain)
    if (this.consecutiveWins >= 10) {
      const newT = Math.min(90, threshold + 1);
      confidenceScorer.setThreshold(newT);
      telemetryLogger.info(`[STREAK] 10+ wins: threshold maintained at ${newT}`, 'ai-self-improve');
    }
  }

  private async runCycle(): Promise<void> {
    try {
      const recent = this.recentResults.slice(-20);
      if (recent.length < 5) return;

      const wins = recent.filter(r => r).length;
      const winRate = (wins / recent.length) * 100;
      const adjustments: string[] = [];

      // Boost weights of strong components based on win rate
      if (winRate >= 65) {
        confidenceScorer.adjustWeights('momentum', 0.05);
        confidenceScorer.adjustWeights('buyPressure', 0.05);
        adjustments.push('Boosted momentum+buyPressure weights (high win rate)');
      }

      // Reduce weights of weak components
      if (winRate < 45) {
        confidenceScorer.adjustWeights('entryTiming', -0.05);
        confidenceScorer.adjustWeights('stability', 0.05);
        adjustments.push('Reduced entryTiming, boosted stability (low win rate)');
      }

      const cycle: LearningCycle = {
        cycleAt: Date.now(),
        tradesAnalyzed: recent.length,
        adjustments,
        winRate,
        threshold: confidenceScorer.getThreshold(),
      };

      this.cycles.push(cycle);
      if (this.cycles.length > 100) this.cycles.shift();

      if (adjustments.length > 0) {
        telemetryLogger.info(
          `[AI-LEARN] Cycle complete: winRate=${winRate.toFixed(1)}%, adjustments: ${adjustments.join('; ')}`,
          'ai-self-improve'
        );
      }
    } catch (err) {
      telemetryLogger.warn('AI self-improve cycle failed', 'ai-self-improve');
    }
  }

  getCycles(): LearningCycle[] {
    return this.cycles.slice(-10);
  }

  getStats() {
    const recent = this.recentResults.slice(-20);
    const wins = recent.filter(r => r).length;
    return {
      recentWinRate: recent.length > 0 ? (wins / recent.length) * 100 : 0,
      consecutiveWins: this.consecutiveWins,
      consecutiveLosses: this.consecutiveLosses,
      currentThreshold: confidenceScorer.getThreshold(),
      cyclesRun: this.cycles.length,
    };
  }
}

export default new AISelfImprove();
