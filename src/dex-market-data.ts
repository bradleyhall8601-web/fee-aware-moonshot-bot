// src/dex-market-data.ts
// Real-time market data from DexScreener API (free, no API key required)

import axios from 'axios';
import telemetryLogger from './telemetry.js';

interface MoonshotCandidate {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  liquidity: number;
  volume24h: number;
  priceChange5m: number;
  holders: number;
  age: number; // hours
  buys: number;
  sells: number;
  buyPressure: number; // percentage
  confidence: number; // 0-100
  dexs: string[];
}

// DexScreener API response types
interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  txns: { m5: { buys: number; sells: number }; h1: { buys: number; sells: number }; h24: { buys: number; sells: number } };
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity?: { usd: number; base: number; quote: number };
  fdv?: number;
  pairCreatedAt?: number;
}

class DexMarketData {
  private readonly dexScreenerBase = 'https://api.dexscreener.com';

  // ── Public API ────────────────────────────────────────────────────────────

  async getMoonshotCandidates(): Promise<MoonshotCandidate[]> {
    try {
      // Fetch trending Solana pairs from DexScreener
      const pairs = await this.fetchTrendingSolanaPairs();
      const candidates: MoonshotCandidate[] = [];

      for (const pair of pairs) {
        const candidate = this.pairToCandidate(pair);
        if (candidate && candidate.confidence >= 60) {
          candidates.push(candidate);
        }
      }

      return candidates.sort((a, b) => b.confidence - a.confidence);
    } catch (err) {
      telemetryLogger.error('Failed to get moonshot candidates', 'dex-market', err);
      return [];
    }
  }

  async getPrice(mint: string): Promise<number> {
    try {
      const response = await axios.get<{ pairs: DexScreenerPair[] }>(
        `${this.dexScreenerBase}/latest/dex/tokens/${mint}`,
        { timeout: 8000 }
      );
      const pairs = response.data?.pairs ?? [];
      const solanaPair = pairs.find(p => p.chainId === 'solana');
      return solanaPair?.priceUsd ? parseFloat(solanaPair.priceUsd) : 0;
    } catch (err) {
      telemetryLogger.debug(`Failed to get price for ${mint}`, 'dex-market', err);
      return 0;
    }
  }

  async getPrices(mints: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    // DexScreener supports up to 30 addresses per request
    const chunks = this.chunkArray(mints, 30);
    for (const chunk of chunks) {
      try {
        const response = await axios.get<{ pairs: DexScreenerPair[] }>(
          `${this.dexScreenerBase}/latest/dex/tokens/${chunk.join(',')}`,
          { timeout: 10000 }
        );
        for (const pair of response.data?.pairs ?? []) {
          if (pair.chainId === 'solana' && pair.priceUsd) {
            prices.set(pair.baseToken.address, parseFloat(pair.priceUsd));
          }
        }
      } catch (err) {
        telemetryLogger.warn('DexScreener batch price fetch failed', 'dex-market', err);
      }
    }
    return prices;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async fetchTrendingSolanaPairs(): Promise<DexScreenerPair[]> {
    try {
      // Use DexScreener's token profiles / latest boosted endpoint for trending tokens
      const response = await axios.get<{ pairs: DexScreenerPair[] }>(
        `${this.dexScreenerBase}/latest/dex/search?q=solana`,
        { timeout: 12000 }
      );
      const pairs: DexScreenerPair[] = response.data?.pairs ?? [];
      return pairs
        .filter(p => p.chainId === 'solana' && (p.liquidity?.usd ?? 0) >= 5000)
        .slice(0, 50);
    } catch (err) {
      telemetryLogger.warn('DexScreener trending fetch failed, trying fallback', 'dex-market', err);
      return this.fetchFallbackPairs();
    }
  }

  private async fetchFallbackPairs(): Promise<DexScreenerPair[]> {
    try {
      // Fallback: search for popular Solana meme tokens
      const response = await axios.get<{ pairs: DexScreenerPair[] }>(
        `${this.dexScreenerBase}/latest/dex/search?q=sol+meme`,
        { timeout: 10000 }
      );
      return (response.data?.pairs ?? []).filter(p => p.chainId === 'solana').slice(0, 30);
    } catch (err) {
      telemetryLogger.warn('DexScreener fallback fetch failed', 'dex-market', err);
      return [];
    }
  }

  private pairToCandidate(pair: DexScreenerPair): MoonshotCandidate | null {
    const liquidity = pair.liquidity?.usd ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;

    if (!priceUsd || liquidity < 5000) return null;

    const buys = (pair.txns?.h24?.buys ?? 0);
    const sells = (pair.txns?.h24?.sells ?? 0);
    const priceChange5m = pair.priceChange?.m5 ?? 0;

    const ageHours = pair.pairCreatedAt
      ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60)
      : 999;

    const buyPressure = (buys + sells) > 0
      ? Math.round((buys / (buys + sells)) * 100)
      : 50;

    const confidence = this.calculateConfidence({
      liquidity,
      volume24h,
      buys,
      sells,
      priceChange5m,
      ageHours,
    });

    return {
      mint: pair.baseToken.address,
      symbol: pair.baseToken.symbol || 'UNKNOWN',
      name: pair.baseToken.name || 'Unknown Token',
      price: priceUsd,
      liquidity,
      volume24h,
      priceChange5m,
      holders: 0, // DexScreener doesn't provide holder count
      age: Math.round(ageHours * 10) / 10,
      buys,
      sells,
      buyPressure,
      confidence,
      dexs: [pair.dexId],
    };
  }

  private calculateConfidence(data: {
    liquidity: number;
    volume24h: number;
    buys: number;
    sells: number;
    priceChange5m: number;
    ageHours: number;
  }): number {
    let score = 0;

    // Liquidity score (0–25 pts)
    if (data.liquidity >= 10000) score += 15;
    if (data.liquidity >= 50000) score += 10;

    // Volume score (0–20 pts)
    if (data.volume24h >= 10000) score += 10;
    if (data.volume24h >= 50000) score += 10;

    // Buy pressure (0–20 pts)
    const ratio = data.buys / Math.max(1, data.sells);
    if (ratio >= 1.5) score += 20;
    else if (ratio >= 1.2) score += 12;
    else if (ratio >= 1.0) score += 6;

    // Momentum (0–15 pts)
    if (data.priceChange5m > 5) score += 15;
    else if (data.priceChange5m > 2) score += 8;
    else if (data.priceChange5m > 0) score += 4;

    // Age bonus — fresh tokens score higher (0–20 pts)
    if (data.ageHours <= 6) score += 20;
    else if (data.ageHours <= 24) score += 12;
    else if (data.ageHours <= 48) score += 6;

    return Math.min(100, score);
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

export default new DexMarketData();
