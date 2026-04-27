// src/win-streak-learner.ts
// Win streak analysis and golden lock system

import telemetryLogger from './telemetry';
import database from './database';
import confidenceScorer from './confidence-scorer';

export interface GoldenParams {
  l1Threshold: number;
  feeOverheadAvg: number;
  signalThreshold: number;
  lockedAt: number;
  streakCount: number;
}

class WinStreakLearner {
  private currentStreak = 0;
  private maxStreak = 0;
  private goldenParams: GoldenParams | null = null;
  private readonly GOLDEN_LOCK_WINS = 10;
  private onGoldenLock?: (params: GoldenParams) => void;

  recordWin(): void {
    this.currentStreak++;
    if (this.currentStreak > this.maxStreak) this.maxStreak = this.currentStreak;

    if (this.currentStreak >= this.GOLDEN_LOCK_WINS && !this.goldenParams) {
      this.triggerGoldenLock();
    }
  }

  recordLoss(): void {
    this.currentStreak = 0;
  }

  private triggerGoldenLock(): void {
    const params: GoldenParams = {
      l1Threshold: Math.max(6, 6),
      feeOverheadAvg: 0.5,
      signalThreshold: confidenceScorer.getThreshold(),
      lockedAt: Date.now(),
      streakCount: this.currentStreak,
    };

    this.goldenParams = params;
    this.saveGoldenParams(params);

    telemetryLogger.info(
      `🏆 GOLDEN LOCK ACHIEVED! ${this.currentStreak} consecutive wins. Params locked: threshold=${params.signalThreshold}`,
      'win-streak'
    );

    if (this.onGoldenLock) this.onGoldenLock(params);
  }

  private saveGoldenParams(params: GoldenParams): void {
    try {
      (database as any).setSetting?.('golden_params', JSON.stringify(params));
    } catch {
      // Ignore
    }
  }

  loadGoldenParams(): void {
    try {
      const raw = (database as any).getSetting?.('golden_params');
      if (raw) {
        this.goldenParams = JSON.parse(raw);
        telemetryLogger.info(`Golden params loaded: threshold=${this.goldenParams?.signalThreshold}`, 'win-streak');
      }
    } catch {
      // No saved params
    }
  }

  setGoldenLockCallback(cb: (params: GoldenParams) => void): void {
    this.onGoldenLock = cb;
  }

  getGoldenParams(): GoldenParams | null { return this.goldenParams; }
  getCurrentStreak(): number { return this.currentStreak; }
  getMaxStreak(): number { return this.maxStreak; }

  getStats() {
    return {
      currentStreak: this.currentStreak,
      maxStreak: this.maxStreak,
      goldenLocked: !!this.goldenParams,
      goldenParams: this.goldenParams,
    };
  }
}

export default new WinStreakLearner();
