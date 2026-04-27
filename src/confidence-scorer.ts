// src/confidence-scorer.ts
// 8-component confidence scoring system (0-100)

import database from './database';
import telemetryLogger from './telemetry';
import type { AggregatedSignal } from './signal-aggregator';

export interface ConfidenceComponents {
  liquidity: number;       // 0-15
  volume: number;          // 0-15
  buyPressure: number;     // 0-15
  txVelocity: number;      // 0-10
  momentum: number;        // 0-15
  entryTiming: number;     // 0-10
  stability: number;       // 0-10
  rugRisk: number;         // 0-10 (inverted: 10 = safe)
  sourceBonus: number;     // 0-9
}

export interface ConfidenceResult {
  score: number;
  components: ConfidenceComponents;
  threshold: number;
  passes: boolean;
  sniperPasses: boolean;
  reasons: string[];
}

const DEFAULT_WEIGHTS = {
  liquidity: 1.0,
  volume: 1.0,
  buyPressure: 1.0,
  txVelocity: 1.0,
  momentum: 1.0,
  entryTiming: 1.0,
  stability: 1.0,
  rugRisk: 1.0,
};

class ConfidenceScorer {
  private weights = { ...DEFAULT_WEIGHTS };
  private threshold = parseInt(process.env.CONFIDENCE_THRESHOLD || '68', 10);

  loadWeightsFromDb(): void {
    try {
      const row = (database as any).getSetting?.('confidence_weights');
      if (row) {
        const parsed = JSON.parse(row);
        this.weights = { ...DEFAULT_WEIGHTS, ...parsed };
      }
    } catch {
      // Use defaults
    }
  }

  saveWeightsToDb(): void {
    try {
      (database as any).setSetting?.('confidence_weights', JSON.stringify(this.weights));
    } catch {
      // Ignore
    }
  }

  score(signal: AggregatedSignal): ConfidenceResult {
    const c: ConfidenceComponents = {
      liquidity: this.scoreLiquidity(signal.liquidity),
      volume: this.scoreVolume(signal.volume1h),
      buyPressure: this.scoreBuyPressure(signal.buyPressure, signal.buys1h, signal.sells1h),
      txVelocity: this.scoreTxVelocity(signal.buys1h + signal.sells1h),
      momentum: this.scoreMomentum(signal.priceChange5m, signal.priceChange1h),
      entryTiming: this.scoreEntryTiming(signal.ageHours, signal.isNewPool),
      stability: this.scoreStability(signal),
      rugRisk: this.scoreRugRisk(signal),
      sourceBonus: signal.sourceBonus,
    };

    // Apply weights
    const raw =
      c.liquidity * this.weights.liquidity +
      c.volume * this.weights.volume +
      c.buyPressure * this.weights.buyPressure +
      c.txVelocity * this.weights.txVelocity +
      c.momentum * this.weights.momentum +
      c.entryTiming * this.weights.entryTiming +
      c.stability * this.weights.stability +
      c.rugRisk * this.weights.rugRisk +
      c.sourceBonus;

    const score = Math.min(100, Math.max(0, Math.round(raw)));
    const reasons = this.buildReasons(c, signal);

    return {
      score,
      components: c,
      threshold: this.threshold,
      passes: score >= this.threshold,
      sniperPasses: score >= this.threshold - 10,
      reasons,
    };
  }

  private scoreLiquidity(liq: number): number {
    if (liq >= 100000) return 15;
    if (liq >= 50000) return 12;
    if (liq >= 20000) return 10;
    if (liq >= 10000) return 7;
    if (liq >= 5000) return 3;
    return 0;
  }

  private scoreVolume(vol1h: number): number {
    if (vol1h >= 50000) return 15;
    if (vol1h >= 20000) return 12;
    if (vol1h >= 10000) return 10;
    if (vol1h >= 5000) return 7;
    if (vol1h >= 1000) return 4;
    return 0;
  }

  private scoreBuyPressure(bp: number, buys: number, sells: number): number {
    const ratio = sells > 0 ? buys / sells : buys > 0 ? 10 : 1;
    let score = 0;
    if (bp >= 65) score += 10;
    else if (bp >= 55) score += 7;
    else if (bp >= 50) score += 4;
    if (ratio >= 2.0) score += 5;
    else if (ratio >= 1.5) score += 3;
    else if (ratio >= 1.2) score += 1;
    return Math.min(15, score);
  }

  private scoreTxVelocity(txCount: number): number {
    if (txCount >= 500) return 10;
    if (txCount >= 200) return 8;
    if (txCount >= 100) return 6;
    if (txCount >= 50) return 4;
    if (txCount >= 20) return 2;
    return 0;
  }

  private scoreMomentum(change5m: number, change1h: number): number {
    let score = 0;
    if (change5m > 5) score += 8;
    else if (change5m > 2) score += 6;
    else if (change5m > 0) score += 3;
    else if (change5m < -5) score -= 5;
    if (change1h > 10) score += 7;
    else if (change1h > 5) score += 4;
    else if (change1h > 0) score += 2;
    return Math.min(15, Math.max(0, score));
  }

  private scoreEntryTiming(ageHours: number, isNew: boolean): number {
    if (isNew || ageHours < 0.5) return 10;
    if (ageHours < 1) return 9;
    if (ageHours < 2) return 8;
    if (ageHours < 5) return 7;
    if (ageHours < 12) return 5;
    if (ageHours < 24) return 3;
    return 1;
  }

  private scoreStability(signal: AggregatedSignal): number {
    let score = 5;
    // Penalize extreme price swings
    if (Math.abs(signal.priceChange5m) > 30) score -= 3;
    if (signal.liquidity > 0 && signal.volume1h / signal.liquidity > 5) score -= 2;
    if (signal.fdvUsd > 0 && signal.fdvUsd < 250000) score += 3;
    if (signal.fdvUsd > 10000000) score -= 2;
    return Math.min(10, Math.max(0, score));
  }

  private scoreRugRisk(signal: AggregatedSignal): number {
    if (signal.rugRisk) return 0;
    let score = 8;
    if (signal.isPumpFun && signal.ageHours < 0.5) score -= 2;
    if (signal.liquidity < 5000) score -= 3;
    return Math.min(10, Math.max(0, score));
  }

  private buildReasons(c: ConfidenceComponents, signal: AggregatedSignal): string[] {
    const reasons: string[] = [];
    if (c.liquidity >= 10) reasons.push(`Strong liquidity ($${signal.liquidity.toLocaleString()})`);
    if (c.buyPressure >= 10) reasons.push(`High buy pressure (${signal.buyPressure.toFixed(0)}%)`);
    if (c.momentum >= 8) reasons.push(`Strong momentum (+${signal.priceChange5m.toFixed(1)}% 5m)`);
    if (c.sourceBonus >= 3) reasons.push(`Multi-source (${signal.sources.join(', ')})`);
    if (c.entryTiming >= 8) reasons.push(`Fresh token (${signal.ageHours.toFixed(1)}h old)`);
    if (c.rugRisk === 0) reasons.push('Rug risk detected');
    return reasons;
  }

  adjustWeights(component: keyof typeof DEFAULT_WEIGHTS, delta: number): void {
    const current = this.weights[component];
    const newVal = Math.max(0.5, Math.min(2.0, current + delta));
    this.weights[component] = Math.round(newVal * 100) / 100;
    this.saveWeightsToDb();
  }

  getWeights() { return { ...this.weights }; }
  getThreshold() { return this.threshold; }
  setThreshold(t: number) { this.threshold = Math.max(50, Math.min(95, t)); }
}

export default new ConfidenceScorer();
