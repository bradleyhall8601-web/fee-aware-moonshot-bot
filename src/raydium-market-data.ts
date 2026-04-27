// src/raydium-market-data.ts
// Raydium DEX market data integration

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface RaydiumPool {
  id: string;
  baseMint: string;
  quoteMint: string;
  baseSymbol: string;
  quoteSymbol: string;
  price: number;
  volume24h: number;
  liquidity: number;
  apr24h: number;
  fee24h: number;
  tvl: number;
}

class RaydiumMarketData {
  private baseUrl = 'https://api.raydium.io/v2';

  async getTopPools(limit = 30): Promise<RaydiumPool[]> {
    try {
      const res = await axios.get(`${this.baseUrl}/main/pairs`, {
        timeout: 10000,
      });
      const pairs = res.data || [];
      return pairs
        .filter((p: any) => p.liquidity > 5000)
        .slice(0, limit)
        .map((p: any) => ({
          id: p.ammId || p.id || '',
          baseMint: p.baseMint || '',
          quoteMint: p.quoteMint || '',
          baseSymbol: p.name?.split('-')[0] || '',
          quoteSymbol: p.name?.split('-')[1] || '',
          price: parseFloat(p.price || '0'),
          volume24h: parseFloat(p.volume24h || '0'),
          liquidity: parseFloat(p.liquidity || '0'),
          apr24h: parseFloat(p.apr24h || '0'),
          fee24h: parseFloat(p.fee24h || '0'),
          tvl: parseFloat(p.tvl || p.liquidity || '0'),
        }));
    } catch (err) {
      telemetryLogger.warn('Raydium pairs fetch failed', 'raydium');
      return [];
    }
  }

  async getPoolInfo(ammId: string): Promise<RaydiumPool | null> {
    try {
      const res = await axios.get(`${this.baseUrl}/main/pool/${ammId}`, {
        timeout: 8000,
      });
      const p = res.data;
      if (!p) return null;
      return {
        id: p.ammId || ammId,
        baseMint: p.baseMint || '',
        quoteMint: p.quoteMint || '',
        baseSymbol: p.name?.split('-')[0] || '',
        quoteSymbol: p.name?.split('-')[1] || '',
        price: parseFloat(p.price || '0'),
        volume24h: parseFloat(p.volume24h || '0'),
        liquidity: parseFloat(p.liquidity || '0'),
        apr24h: parseFloat(p.apr24h || '0'),
        fee24h: parseFloat(p.fee24h || '0'),
        tvl: parseFloat(p.tvl || p.liquidity || '0'),
      };
    } catch (err) {
      telemetryLogger.debug(`Raydium pool info failed: ${ammId}`, 'raydium');
      return null;
    }
  }

  async getNewPools(maxAgeHours = 24): Promise<RaydiumPool[]> {
    try {
      const all = await this.getTopPools(100);
      // Raydium doesn't expose creation time directly; return low-liquidity new pools
      return all.filter(p => p.liquidity < 100000 && p.volume24h > 1000).slice(0, 20);
    } catch (err) {
      telemetryLogger.warn('Raydium new pools fetch failed', 'raydium');
      return [];
    }
  }
}

export default new RaydiumMarketData();
