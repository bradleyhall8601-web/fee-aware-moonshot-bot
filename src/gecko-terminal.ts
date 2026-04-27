// src/gecko-terminal.ts
// GeckoTerminal API integration for trending pools and new tokens

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface GeckoPool {
  id: string;
  name: string;
  baseTokenAddress: string;
  baseTokenSymbol: string;
  baseTokenName: string;
  quoteTokenAddress: string;
  quoteTokenSymbol: string;
  priceUsd: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  volumeUsd5m: number;
  volumeUsd1h: number;
  volumeUsd24h: number;
  liquidityUsd: number;
  fdvUsd: number;
  marketCapUsd: number;
  txCount5m: number;
  txCount1h: number;
  txCount24h: number;
  buys5m: number;
  sells5m: number;
  buys1h: number;
  sells1h: number;
  poolCreatedAt: string;
  dexId: string;
}

class GeckoTerminal {
  private baseUrl = 'https://api.geckoterminal.com/api/v2';
  private network = 'solana';

  async getTrendingPools(limit = 20): Promise<GeckoPool[]> {
    try {
      const res = await axios.get(
        `${this.baseUrl}/networks/${this.network}/trending_pools`,
        {
          params: { include: 'base_token,quote_token', page: 1 },
          timeout: 10000,
          headers: { Accept: 'application/json;version=20230302' },
        }
      );
      return this.parsePools(res.data?.data || [], limit);
    } catch (err) {
      telemetryLogger.warn('GeckoTerminal trending pools failed', 'gecko');
      return [];
    }
  }

  async getNewPools(limit = 20): Promise<GeckoPool[]> {
    try {
      const res = await axios.get(
        `${this.baseUrl}/networks/${this.network}/new_pools`,
        {
          params: { include: 'base_token,quote_token', page: 1 },
          timeout: 10000,
          headers: { Accept: 'application/json;version=20230302' },
        }
      );
      return this.parsePools(res.data?.data || [], limit);
    } catch (err) {
      telemetryLogger.warn('GeckoTerminal new pools failed', 'gecko');
      return [];
    }
  }

  async getPoolData(poolAddress: string): Promise<GeckoPool | null> {
    try {
      const res = await axios.get(
        `${this.baseUrl}/networks/${this.network}/pools/${poolAddress}`,
        {
          params: { include: 'base_token,quote_token' },
          timeout: 8000,
          headers: { Accept: 'application/json;version=20230302' },
        }
      );
      const pools = this.parsePools([res.data?.data], 1);
      return pools[0] || null;
    } catch (err) {
      telemetryLogger.debug(`GeckoTerminal pool fetch failed: ${poolAddress}`, 'gecko');
      return null;
    }
  }

  private parsePools(data: any[], limit: number): GeckoPool[] {
    const pools: GeckoPool[] = [];
    for (const item of data.slice(0, limit)) {
      if (!item?.attributes) continue;
      const a = item.attributes;
      const rel = item.relationships;
      const baseToken = rel?.base_token?.data;
      const quoteToken = rel?.quote_token?.data;

      pools.push({
        id: item.id || '',
        name: a.name || '',
        baseTokenAddress: baseToken?.id?.split('_')[1] || '',
        baseTokenSymbol: a.base_token_price_usd ? (a.name?.split('/')[0] || '') : '',
        baseTokenName: '',
        quoteTokenAddress: quoteToken?.id?.split('_')[1] || '',
        quoteTokenSymbol: a.name?.split('/')[1] || '',
        priceUsd: parseFloat(a.base_token_price_usd || '0'),
        priceChange5m: parseFloat(a.price_change_percentage?.m5 || '0'),
        priceChange1h: parseFloat(a.price_change_percentage?.h1 || '0'),
        priceChange24h: parseFloat(a.price_change_percentage?.h24 || '0'),
        volumeUsd5m: parseFloat(a.volume_usd?.m5 || '0'),
        volumeUsd1h: parseFloat(a.volume_usd?.h1 || '0'),
        volumeUsd24h: parseFloat(a.volume_usd?.h24 || '0'),
        liquidityUsd: parseFloat(a.reserve_in_usd || '0'),
        fdvUsd: parseFloat(a.fdv_usd || '0'),
        marketCapUsd: parseFloat(a.market_cap_usd || '0'),
        txCount5m: (a.transactions?.m5?.buys || 0) + (a.transactions?.m5?.sells || 0),
        txCount1h: (a.transactions?.h1?.buys || 0) + (a.transactions?.h1?.sells || 0),
        txCount24h: (a.transactions?.h24?.buys || 0) + (a.transactions?.h24?.sells || 0),
        buys5m: a.transactions?.m5?.buys || 0,
        sells5m: a.transactions?.m5?.sells || 0,
        buys1h: a.transactions?.h1?.buys || 0,
        sells1h: a.transactions?.h1?.sells || 0,
        poolCreatedAt: a.pool_created_at || '',
        dexId: item.relationships?.dex?.data?.id || '',
      });
    }
    return pools;
  }
}

export default new GeckoTerminal();
