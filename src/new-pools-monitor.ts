// src/new-pools-monitor.ts
// New pool detection across DEXes

import telemetryLogger from './telemetry';
import geckoTerminal from './gecko-terminal';
import axiomMarketData from './axiom-market-data';
import raydiumMarketData from './raydium-market-data';

export interface NewPoolSignal {
  mint: string;
  symbol: string;
  name: string;
  source: string;
  ageHours: number;
  liquidity: number;
  volume1h: number;
  price: number;
  priceChange5m: number;
  buys1h: number;
  sells1h: number;
  detectedAt: number;
}

class NewPoolsMonitor {
  private seenMints = new Set<string>();
  private recentSignals: NewPoolSignal[] = [];

  async detectNewPools(): Promise<NewPoolSignal[]> {
    const signals: NewPoolSignal[] = [];

    try {
      // GeckoTerminal new pools
      const geckoPools = await geckoTerminal.getNewPools(20);
      for (const pool of geckoPools) {
        if (!pool.baseTokenAddress || this.seenMints.has(pool.baseTokenAddress)) continue;
        const ageHours = pool.poolCreatedAt
          ? (Date.now() - new Date(pool.poolCreatedAt).getTime()) / 3600000
          : 999;
        if (ageHours > 24) continue;
        signals.push({
          mint: pool.baseTokenAddress,
          symbol: pool.baseTokenSymbol || pool.name.split('/')[0],
          name: pool.name,
          source: 'gecko',
          ageHours,
          liquidity: pool.liquidityUsd,
          volume1h: pool.volumeUsd1h,
          price: pool.priceUsd,
          priceChange5m: pool.priceChange5m,
          buys1h: pool.buys1h,
          sells1h: pool.sells1h,
          detectedAt: Date.now(),
        });
        this.seenMints.add(pool.baseTokenAddress);
      }
    } catch (err) {
      telemetryLogger.warn('GeckoTerminal new pool detection failed', 'new-pools');
    }

    try {
      // PumpFun new tokens
      const pumpTokens = await axiomMarketData.getNewTokens(20);
      for (const token of pumpTokens) {
        if (!token.mint || this.seenMints.has(token.mint)) continue;
        const ageHours = axiomMarketData.getAgeHours(token);
        if (ageHours > 6) continue; // Only very new PumpFun tokens
        signals.push({
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          source: 'pumpfun',
          ageHours,
          liquidity: token.liquidity,
          volume1h: token.volume24h / 24,
          price: token.price,
          priceChange5m: 0,
          buys1h: 0,
          sells1h: 0,
          detectedAt: Date.now(),
        });
        this.seenMints.add(token.mint);
      }
    } catch (err) {
      telemetryLogger.warn('PumpFun new pool detection failed', 'new-pools');
    }

    // Keep seen mints from growing unbounded
    if (this.seenMints.size > 5000) {
      const arr = Array.from(this.seenMints);
      this.seenMints = new Set(arr.slice(-2500));
    }

    this.recentSignals = [...this.recentSignals, ...signals].slice(-200);
    telemetryLogger.info(`New pools detected: ${signals.length}`, 'new-pools');
    return signals;
  }

  getRecentSignals(limit = 50): NewPoolSignal[] {
    return this.recentSignals.slice(-limit);
  }
}

export default new NewPoolsMonitor();
