// src/cascade-state.ts
// Pipeline state tracking for the trading cycle

export interface CascadeState {
  cycleId: string;
  startedAt: number;
  stage: 'idle' | 'fetching' | 'aggregating' | 'scoring' | 'ai_gate' | 'trading' | 'monitoring' | 'complete' | 'error';
  candidatesFound: number;
  candidatesScored: number;
  candidatesPassed: number;
  aiDecisions: { BUY: number; SKIP: number; WATCH: number };
  paperTradesOpened: number;
  liveTradesOpened: number;
  errors: string[];
  completedAt?: number;
  durationMs?: number;
}

class CascadeStateTracker {
  private current: CascadeState | null = null;
  private history: CascadeState[] = [];

  startCycle(): CascadeState {
    const state: CascadeState = {
      cycleId: `cycle_${Date.now()}`,
      startedAt: Date.now(),
      stage: 'idle',
      candidatesFound: 0,
      candidatesScored: 0,
      candidatesPassed: 0,
      aiDecisions: { BUY: 0, SKIP: 0, WATCH: 0 },
      paperTradesOpened: 0,
      liveTradesOpened: 0,
      errors: [],
    };
    this.current = state;
    return state;
  }

  update(updates: Partial<CascadeState>): void {
    if (this.current) {
      Object.assign(this.current, updates);
    }
  }

  completeCycle(): void {
    if (this.current) {
      this.current.stage = 'complete';
      this.current.completedAt = Date.now();
      this.current.durationMs = this.current.completedAt - this.current.startedAt;
      this.history.push({ ...this.current });
      if (this.history.length > 100) this.history.shift();
      this.current = null;
    }
  }

  errorCycle(error: string): void {
    if (this.current) {
      this.current.stage = 'error';
      this.current.errors.push(error);
      this.completeCycle();
    }
  }

  getCurrent(): CascadeState | null { return this.current; }
  getHistory(limit = 20): CascadeState[] { return this.history.slice(-limit); }

  getStats() {
    const recent = this.history.slice(-20);
    return {
      totalCycles: this.history.length,
      avgDurationMs: recent.length > 0
        ? recent.reduce((s, c) => s + (c.durationMs || 0), 0) / recent.length
        : 0,
      totalBuySignals: recent.reduce((s, c) => s + c.aiDecisions.BUY, 0),
      totalPaperTrades: recent.reduce((s, c) => s + c.paperTradesOpened, 0),
    };
  }
}

export default new CascadeStateTracker();
