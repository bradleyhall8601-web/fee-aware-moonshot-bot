// src/adaptive-strategy-engine.ts
// Trading mode selection: SNIPER, AGGRESSIVE_SCALP, HIGH_CONFIDENCE

import telemetryLogger from './telemetry';
import type { AggregatedSignal } from './signal-aggregator';
import type { ConfidenceResult } from './confidence-scorer';

export type TradingMode = 'SNIPER' | 'AGGRESSIVE_SCALP' | 'HIGH_CONFIDENCE' | 'SKIP';

export interface StrategyDecision {
  mode: TradingMode;
  positionSizePct: number;  // % of available capital
  takeProfitPct: number;
  stopLossPct: number;
  tpLadder?: number[];      // For HIGH_CONFIDENCE
  trailingStop?: boolean;
  reason: string;
}

class AdaptiveStrategyEngine {
  selectMode(signal: AggregatedSignal, confidence: ConfidenceResult): StrategyDecision {
    const { buyPressure, ageHours, priceChange5m } = signal;
    const conf = confidence.score;

    // SNIPER MODE: very new token, positive momentum
    if (
      ageHours < 5 &&
      buyPressure >= 50 &&
      priceChange5m > 0 &&
      confidence.sniperPasses
    ) {
      return {
        mode: 'SNIPER',
        positionSizePct: 25,
        takeProfitPct: 2,
        stopLossPct: 5,
        trailingStop: false,
        reason: `Sniper: age=${ageHours.toFixed(1)}h, bp=${buyPressure.toFixed(0)}%, 5m=${priceChange5m.toFixed(1)}%`,
      };
    }

    // AGGRESSIVE SCALP: moderate buy pressure, positive momentum
    if (
      buyPressure >= 50 && buyPressure < 60 &&
      priceChange5m > 0 &&
      confidence.passes
    ) {
      return {
        mode: 'AGGRESSIVE_SCALP',
        positionSizePct: 50,
        takeProfitPct: 3,
        stopLossPct: 7,
        trailingStop: false,
        reason: `Scalp: bp=${buyPressure.toFixed(0)}%, conf=${conf}`,
      };
    }

    // HIGH CONFIDENCE: strong buy pressure, passes threshold
    if (buyPressure >= 60 && confidence.passes) {
      return {
        mode: 'HIGH_CONFIDENCE',
        positionSizePct: 100,
        takeProfitPct: 30,
        stopLossPct: 12,
        tpLadder: [12, 30, 70],
        trailingStop: true,
        reason: `High conf: bp=${buyPressure.toFixed(0)}%, conf=${conf}`,
      };
    }

    return {
      mode: 'SKIP',
      positionSizePct: 0,
      takeProfitPct: 0,
      stopLossPct: 0,
      reason: `Skip: conf=${conf}, bp=${buyPressure.toFixed(0)}%`,
    };
  }

  computeMomentumScore(signal: AggregatedSignal): number {
    const { priceChange5m, priceChange1h, buyPressure } = signal;
    let score = 0;
    if (priceChange5m > 0) score += priceChange5m * 2;
    if (priceChange1h > 0) score += priceChange1h;
    if (buyPressure > 55) score += (buyPressure - 55) * 0.5;
    return Math.min(100, Math.max(-100, score));
  }

  hasDecelerationGuardBypass(signal: AggregatedSignal): boolean {
    return signal.priceChange5m > 2 || signal.ageHours < 60 / 60;
  }
}

export default new AdaptiveStrategyEngine();
