// src/signal-aggregator.ts
// Aggregates signals from all market data sources with deduplication

import telemetryLogger from './telemetry';
import dexMarketData from './dex-market-data';
import geckoTerminal from './gecko-terminal';
import axiomMarketData from './axiom-market-data';
import raydiumMarketData from './raydium-market-data';
import birdeyeMarketData from './birdeye-market-data';
import newPoolsMonitor from './new-pools-monitor';

export interface AggregatedSignal {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  liquidity: number;
  volume1h: number;
  volume24h: number;
  priceChange5m: number;
  priceChange1h: number;
  buys1h: number;
  sells1h: number;
  buyPressure: number; // 0-100
  ageHours: number;
  sources: string[];
  sourceCount: number;
  sourceBonus: number; // +3 per extra source
  fdvUsd: number;
  isNewPool: boolean;
  isPumpFun: boolean;
  rugRisk: boolean;
  fetchedAt: number;
}

class SignalAggregator {
  private cache = new Map<string, AggregatedSignal>();
  private lastFetchAt = 0;
  private cacheTtlMs = 15000;

  async aggregate(): Promise<AggregatedSignal[]> {
    const now = Date.now();
    if (now - this.lastFetchAt < this.cacheTtlMs && this.cache.size > 0) {
      return Array.from(this.cache.values());
    }

    const signalMap = new Map<string, Partial<AggregatedSignal> & { sources: string[] }>();

    const merge = (mint: string, data: Partial<AggregatedSignal>, source: string) => {
      if (!mint) return;
      const existing = signalMap.get(mint) || { sources: [] };
      if (!existing.sources.includes(source)) existing.sources.push(source);
      signalMap.set(mint, {
        ...existing,
        ...data,
        mint,
        sources: existing.sources,
      });
    };

    // DexScreener
    try {
      const dexCandidates = await dexMarketData.getMoonshotCandidates();
      for (const c of dexCandidates) {
        merge(c.mint, {
          symbol: c.symbol,
          name: c.name,
          price: c.price,
          liquidity: c.liquidity,
          volume24h: c.volume24h,
          volume1h: c.volume24h / 24,
          priceChange5m: c.priceChange5m,
          priceChange1h: 0,
          buys1h: c.buys,
          sells1h: c.sells,
          buyPressure: c.buyPressure,
          ageHours: c.age,
          fdvUsd: 0,
          isNewPool: c.age < 2,
          isPumpFun: false,
          rugRisk: false,
        }, 'dexscreener');
      }
    } catch (err) {
      telemetryLogger.warn('DexScreener aggregation failed', 'aggregator');
    }

    // GeckoTerminal trending
    try {
      const geckoPools = await geckoTerminal.getTrendingPools(20);
      for (const p of geckoPools) {
        if (!p.baseTokenAddress) continue;
        const ageHours = p.poolCreatedAt
          ? (Date.now() - new Date(p.poolCreatedAt).getTime()) / 3600000
          : 48;
        merge(p.baseTokenAddress, {
          symbol: p.baseTokenSymbol || p.name.split('/')[0],
          name: p.name,
          price: p.priceUsd,
          liquidity: p.liquidityUsd,
          volume1h: p.volumeUsd1h,
          volume24h: p.volumeUsd24h,
          priceChange5m: p.priceChange5m,
          priceChange1h: p.priceChange1h,
          buys1h: p.buys1h,
          sells1h: p.sells1h,
          buyPressure: p.buys1h + p.sells1h > 0
            ? (p.buys1h / (p.buys1h + p.sells1h)) * 100
            : 50,
          ageHours,
          fdvUsd: p.fdvUsd,
          isNewPool: ageHours < 2,
          isPumpFun: false,
          rugRisk: false,
        }, 'gecko');
      }
    } catch (err) {
      telemetryLogger.warn('GeckoTerminal aggregation failed', 'aggregator');
    }

    // PumpFun trending
    try {
      const pumpTokens = await axiomMarketData.getTrendingTokens(20);
      for (const t of pumpTokens) {
        if (!t.mint) continue;
        const ageHours = axiomMarketData.getAgeHours(t);
        merge(t.mint, {
          symbol: t.symbol,
          name: t.name,
          price: t.price,
          liquidity: t.liquidity,
          volume1h: t.volume24h / 24,
          volume24h: t.volume24h,
          priceChange5m: 0,
          priceChange1h: 0,
          buys1h: 0,
          sells1h: 0,
          buyPressure: 55,
          ageHours,
          fdvUsd: t.usdMarketCap,
          isNewPool: ageHours < 1,
          isPumpFun: true,
          rugRisk: false,
        }, 'pumpfun');
      }
    } catch (err) {
      telemetryLogger.warn('PumpFun aggregation failed', 'aggregator');
    }

    // New pools
    try {
      const newPools = await newPoolsMonitor.detectNewPools();
      for (const p of newPools) {
        merge(p.mint, {
          symbol: p.symbol,
          name: p.name,
          price: p.price,
          liquidity: p.liquidity,
          volume1h: p.volume1h,
          volume24h: p.volume1h * 24,
          priceChange5m: p.priceChange5m,
          priceChange1h: 0,
          buys1h: p.buys1h,
          sells1h: p.sells1h,
          buyPressure: p.buys1h + p.sells1h > 0
            ? (p.buys1h / (p.buys1h + p.sells1h)) * 100
            : 50,
          ageHours: p.ageHours,
          fdvUsd: 0,
          isNewPool: true,
          isPumpFun: p.source === 'pumpfun',
          rugRisk: false,
        }, p.source);
      }
    } catch (err) {
      telemetryLogger.warn('New pools aggregation failed', 'aggregator');
    }

    // Build final signals
    const signals: AggregatedSignal[] = [];
    for (const [mint, data] of signalMap) {
      const sourceCount = data.sources.length;
      const sourceBonus = Math.min(9, (sourceCount - 1) * 3);
      signals.push({
        mint,
        symbol: data.symbol || 'UNKNOWN',
        name: data.name || 'Unknown',
        price: data.price || 0,
        liquidity: data.liquidity || 0,
        volume1h: data.volume1h || 0,
        volume24h: data.volume24h || 0,
        priceChange5m: data.priceChange5m || 0,
        priceChange1h: data.priceChange1h || 0,
        buys1h: data.buys1h || 0,
        sells1h: data.sells1h || 0,
        buyPressure: data.buyPressure || 50,
        ageHours: data.ageHours || 48,
        sources: data.sources,
        sourceCount,
        sourceBonus,
        fdvUsd: data.fdvUsd || 0,
        isNewPool: data.isNewPool || false,
        isPumpFun: data.isPumpFun || false,
        rugRisk: data.rugRisk || false,
        fetchedAt: Date.now(),
      });
    }

    // Update cache
    this.cache.clear();
    for (const s of signals) this.cache.set(s.mint, s);
    this.lastFetchAt = now;

    telemetryLogger.info(`Aggregated ${signals.length} signals from ${new Set(signals.flatMap(s => s.sources)).size} sources`, 'aggregator');
    return signals;
  }

  getCached(): AggregatedSignal[] {
    return Array.from(this.cache.values());
  }
}

export default new SignalAggregator();
