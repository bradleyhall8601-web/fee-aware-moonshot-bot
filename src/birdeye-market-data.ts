// src/birdeye-market-data.ts
// Birdeye API integration for security and token data

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface BirdeyeTokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  holder: number;
  trade24h: number;
  buy24h: number;
  sell24h: number;
  uniqueWallet24h: number;
  lastTradeUnixTime: number;
}

export interface BirdeyeSecurityData {
  ownerAddress: string;
  creatorAddress: string;
  ownerBalance: number;
  ownerPercentage: number;
  creatorBalance: number;
  creatorPercentage: number;
  top10HolderBalance: number;
  top10HolderPercent: number;
  isMutable: boolean;
  mintable: boolean;
  freezable: boolean;
}

class BirdeyeMarketData {
  private baseUrl = 'https://public-api.birdeye.so';
  private apiKey = process.env.BIRDEYE_API_KEY || '';

  private get headers() {
    return {
      'X-API-KEY': this.apiKey,
      'x-chain': 'solana',
    };
  }

  async getTokenOverview(address: string): Promise<BirdeyeTokenData | null> {
    if (!this.apiKey) {
      telemetryLogger.debug('Birdeye API key not set', 'birdeye');
      return null;
    }
    try {
      const res = await axios.get(`${this.baseUrl}/defi/token_overview`, {
        params: { address },
        headers: this.headers,
        timeout: 8000,
      });
      const d = res.data?.data;
      if (!d) return null;
      return {
        address,
        symbol: d.symbol || '',
        name: d.name || '',
        decimals: d.decimals || 6,
        price: d.price || 0,
        priceChange24h: d.priceChange24hPercent || 0,
        volume24h: d.v24hUSD || 0,
        liquidity: d.liquidity || 0,
        marketCap: d.mc || 0,
        holder: d.holder || 0,
        trade24h: d.trade24h || 0,
        buy24h: d.buy24h || 0,
        sell24h: d.sell24h || 0,
        uniqueWallet24h: d.uniqueWallet24h || 0,
        lastTradeUnixTime: d.lastTradeUnixTime || 0,
      };
    } catch (err) {
      telemetryLogger.debug(`Birdeye token overview failed for ${address}`, 'birdeye');
      return null;
    }
  }

  async getTokenSecurity(address: string): Promise<BirdeyeSecurityData | null> {
    if (!this.apiKey) return null;
    try {
      const res = await axios.get(`${this.baseUrl}/defi/token_security`, {
        params: { address },
        headers: this.headers,
        timeout: 8000,
      });
      const d = res.data?.data;
      if (!d) return null;
      return {
        ownerAddress: d.ownerAddress || '',
        creatorAddress: d.creatorAddress || '',
        ownerBalance: d.ownerBalance || 0,
        ownerPercentage: d.ownerPercentage || 0,
        creatorBalance: d.creatorBalance || 0,
        creatorPercentage: d.creatorPercentage || 0,
        top10HolderBalance: d.top10HolderBalance || 0,
        top10HolderPercent: d.top10HolderPercent || 0,
        isMutable: d.mutableMetadata === true,
        mintable: d.mintable === true,
        freezable: d.freezable === true,
      };
    } catch (err) {
      telemetryLogger.debug(`Birdeye security check failed for ${address}`, 'birdeye');
      return null;
    }
  }

  async getTrendingTokens(limit = 20): Promise<BirdeyeTokenData[]> {
    if (!this.apiKey) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/defi/token_trending`, {
        params: { sort_by: 'rank', sort_type: 'asc', offset: 0, limit },
        headers: this.headers,
        timeout: 10000,
      });
      const items = res.data?.data?.tokens || [];
      return items.map((d: any) => ({
        address: d.address || '',
        symbol: d.symbol || '',
        name: d.name || '',
        decimals: d.decimals || 6,
        price: d.price || 0,
        priceChange24h: d.priceChange24hPercent || 0,
        volume24h: d.v24hUSD || 0,
        liquidity: d.liquidity || 0,
        marketCap: d.mc || 0,
        holder: d.holder || 0,
        trade24h: d.trade24h || 0,
        buy24h: d.buy24h || 0,
        sell24h: d.sell24h || 0,
        uniqueWallet24h: d.uniqueWallet24h || 0,
        lastTradeUnixTime: d.lastTradeUnixTime || 0,
      }));
    } catch (err) {
      telemetryLogger.warn('Birdeye trending fetch failed', 'birdeye');
      return [];
    }
  }

  isRugRisk(security: BirdeyeSecurityData): boolean {
    if (security.ownerPercentage > 20) return true;
    if (security.top10HolderPercent > 80) return true;
    if (security.mintable) return true;
    if (security.freezable) return true;
    return false;
  }
}

export default new BirdeyeMarketData();
