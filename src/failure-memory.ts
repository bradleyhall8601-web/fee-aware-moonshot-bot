// src/failure-memory.ts
// Failed signal tracking and pattern learning

import telemetryLogger from './telemetry';

export interface FailedSignal {
  mint: string;
  symbol: string;
  reason: string;
  confidence: number;
  liquidity: number;
  buyPressure: number;
  ageHours: number;
  timestamp: number;
  lossPercent?: number;
}

class FailureMemory {
  private failures: FailedSignal[] = [];
  private blockedMints = new Map<string, number>(); // mint -> unblock timestamp

  recordFailure(signal: FailedSignal): void {
    this.failures.push(signal);
    if (this.failures.length > 500) this.failures.shift();

    // Block mint for 2 hours after failure
    this.blockedMints.set(signal.mint, Date.now() + 2 * 60 * 60 * 1000);
    telemetryLogger.info(`[FAILURE] ${signal.symbol}: ${signal.reason} (conf=${signal.confidence})`, 'failure-memory');
  }

  isBlocked(mint: string): boolean {
    const unblockAt = this.blockedMints.get(mint);
    if (!unblockAt) return false;
    if (Date.now() > unblockAt) {
      this.blockedMints.delete(mint);
      return false;
    }
    return true;
  }

  getPatterns(): Record<string, number> {
    const patterns: Record<string, number> = {};
    for (const f of this.failures) {
      patterns[f.reason] = (patterns[f.reason] || 0) + 1;
    }
    return patterns;
  }

  getRecentFailures(limit = 20): FailedSignal[] {
    return this.failures.slice(-limit);
  }

  getStats() {
    return {
      totalFailures: this.failures.length,
      blockedMints: this.blockedMints.size,
      patterns: this.getPatterns(),
    };
  }
}

export default new FailureMemory();
