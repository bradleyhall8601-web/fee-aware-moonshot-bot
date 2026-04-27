// src/axiom-market-data.ts
// PumpFun/Axiom new token detection

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  createdTimestamp: number;
  creator: string;
  usdMarketCap: number;
  price: number;
  volume24h: number;
  liquidity: number;
  replyCount: number;
  lastReply: number;
  nsfw: boolean;
  complete: boolean; // graduated to Raydium
}

class AxiomMarketData {
  private pumpFunUrl = 'https://frontend-api.pump.fun';

  async getNewTokens(limit = 30): Promise<PumpFunToken[]> {
    try {
      const res = await axios.get(`${this.pumpFunUrl}/coins`, {
        params: {
          offset: 0,
          limit,
          sort: 'created_timestamp',
          order: 'DESC',
          includeNsfw: false,
        },
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const coins = res.data || [];
      return coins.map((c: any) => this.mapToken(c));
    } catch (err) {
      telemetryLogger.warn('PumpFun new tokens fetch failed', 'axiom');
      return [];
    }
  }

  async getTrendingTokens(limit = 20): Promise<PumpFunToken[]> {
    try {
      const res = await axios.get(`${this.pumpFunUrl}/coins`, {
        params: {
          offset: 0,
          limit,
          sort: 'last_trade_timestamp',
          order: 'DESC',
          includeNsfw: false,
        },
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const coins = res.data || [];
      return coins.map((c: any) => this.mapToken(c));
    } catch (err) {
      telemetryLogger.warn('PumpFun trending tokens fetch failed', 'axiom');
      return [];
    }
  }

  async getTokenInfo(mint: string): Promise<PumpFunToken | null> {
    try {
      const res = await axios.get(`${this.pumpFunUrl}/coins/${mint}`, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return this.mapToken(res.data);
    } catch (err) {
      telemetryLogger.debug(`PumpFun token info failed: ${mint}`, 'axiom');
      return null;
    }
  }

  private mapToken(c: any): PumpFunToken {
    return {
      mint: c.mint || '',
      name: c.name || '',
      symbol: c.symbol || '',
      description: c.description || '',
      imageUri: c.image_uri || '',
      createdTimestamp: c.created_timestamp || 0,
      creator: c.creator || '',
      usdMarketCap: c.usd_market_cap || 0,
      price: c.price || 0,
      volume24h: c.volume_24h || 0,
      liquidity: c.virtual_sol_reserves ? c.virtual_sol_reserves * 150 : 0,
      replyCount: c.reply_count || 0,
      lastReply: c.last_reply || 0,
      nsfw: c.nsfw === true,
      complete: c.complete === true,
    };
  }

  getAgeHours(token: PumpFunToken): number {
    if (!token.createdTimestamp) return 999;
    return (Date.now() - token.createdTimestamp) / (1000 * 60 * 60);
  }
}

export default new AxiomMarketData();
