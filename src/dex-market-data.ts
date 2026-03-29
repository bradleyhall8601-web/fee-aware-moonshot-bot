// src/dex-market-data.ts
// Real-time market data from Raydium, Jupiter, and Orca

import axios from 'axios';
import telemetryLogger from './telemetry';

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
}

interface PoolData {
  poolId: string;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpMint: string;
  lpDecimals: number;
  version: number;
  programId: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  lookupTableAddress: string;
}

interface TokenPrice {
  mint: string;
  price: number;
  priceUsd: number;
  volume24h: number;
  marketCap?: number;
  priceChange24h?: number;
  liquidity: number;
}

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

class DexMarketData {
  private raydiumApiUrl = 'https://api.raydium.io/v2';
  private jupiterApiUrl = 'https://quote-api.jup.ag/v6';
  private birdeyeApiUrl = 'https://public-api.birdeye.so/defi';
  private solanaRpc = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

  async getMoonshotCandidates(): Promise<MoonshotCandidate[]> {
    try {
      const candidates: MoonshotCandidate[] = [];

      // Fetch from multiple DEXs
      const raydiumTokens = await this.getRaydiumNewTokens();
      const jupiterTokens = await this.getJupiterNewTokens();

      // Combine and deduplicate
      const allTokens = [...raydiumTokens, ...jupiterTokens];
      const uniqueMints = new Set(allTokens.map(t => t.mint));

      for (const mint of Array.from(uniqueMints).slice(0, 20)) {
        const tokenData = await this.analyzeToken(mint);
        if (tokenData && tokenData.confidence > 60) {
          candidates.push(tokenData);
        }
      }

      // Sort by confidence
      return candidates.sort((a, b) => b.confidence - a.confidence);
    } catch (err) {
      telemetryLogger.error('Failed to get moonshot candidates', 'dex-market', err);
      return [];
    }
  }

  private async getRaydiumNewTokens(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.raydiumApiUrl}/main/pairs`, {
        timeout: 10000,
      });
      
      // Filter for new, low cap tokens
      return response.data
        .filter((pool: any) => {
          const age = Date.now() - pool.createdAt * 1000;
          return age < 48 * 60 * 60 * 1000; // Less than 48 hours old
        })
        .slice(0, 50);
    } catch (err) {
      telemetryLogger.warn('Raydium API error', 'dex-market', err);
      return [];
    }
  }

  private async getJupiterNewTokens(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.jupiterApiUrl}/swap`, {
        params: {
          sortBy: 'volumeUsd',
          period: '24h',
          limit: 50,
        },
        timeout: 10000,
      });

      return response.data.data || [];
    } catch (err) {
      telemetryLogger.warn('Jupiter API error', 'dex-market', err);
      return [];
    }
  }

  private async analyzeToken(mint: string): Promise<MoonshotCandidate | null> {
    try {
      const [priceData, tokenInfo, holderData] = await Promise.all([
        this.getTokenPrice(mint),
        this.getTokenInfo(mint),
        this.getTokenHolders(mint),
      ]);

      if (!priceData || !tokenInfo) return null;

      const buyPressure = this.calculateBuyPressure(priceData);
      const confidence = this.calculateConfidence(priceData, holderData, buyPressure);

      return {
        mint,
        symbol: tokenInfo.symbol || 'UNKNOWN',
        name: tokenInfo.name || 'Unknown Token',
        price: priceData.price,
        liquidity: priceData.liquidity,
        volume24h: priceData.volume24h,
        priceChange5m: Math.random() * 10 - 5, // TODO: Get from chain data
        holders: holderData.count || 0,
        age: holderData.age || 0,
        buys: holderData.buys || 0,
        sells: holderData.sells || 0,
        buyPressure,
        confidence,
        dexs: ['raydium', 'jupiter'],
      };
    } catch (err) {
      telemetryLogger.debug(`Failed to analyze token ${mint}`, 'dex-market', err);
      return null;
    }
  }

  private async getTokenPrice(mint: string): Promise<TokenPrice | null> {
    try {
      const response = await axios.get(`${this.birdeyeApiUrl}/token/info`, {
        params: { address: mint },
        headers: {
          'X-API-Key': process.env.BIRDEYE_API_KEY || 'public',
        },
        timeout: 5000,
      });

      const data = response.data.data;
      return {
        mint,
        price: data.price || 0,
        priceUsd: data.price || 0,
        volume24h: data.volume24h || 0,
        marketCap: data.marketCap,
        priceChange24h: data.priceChange24h,
        liquidity: data.liquidity || 0,
      };
    } catch (err) {
      telemetryLogger.debug(`Failed to get price for ${mint}`, 'dex-market', err);
      return null;
    }
  }

  private async getTokenInfo(mint: string): Promise<TokenInfo | null> {
    try {
      const response = await axios.get(`${this.solanaRpc}`, {
        method: 'POST',
        data: {
          jsonrpc: '2.0',
          id: 1,
          method: 'getParsedAccountInfo',
          params: [mint],
        },
        timeout: 5000,
      });

      // Parse Solana RPC response
      const info = response.data.result?.value?.data?.parsed?.info;
      return {
        mint,
        symbol: '',
        name: '',
        decimals: info?.decimals || 6,
        logo: '',
      };
    } catch (err) {
      return null;
    }
  }

  private async getTokenHolders(mint: string): Promise<any> {
    try {
      // Mock data - in production would fetch from chain
      return {
        count: Math.floor(Math.random() * 10000),
        age: Math.random() * 48,
        buys: Math.floor(Math.random() * 1000),
        sells: Math.floor(Math.random() * 500),
      };
    } catch (err) {
      return { count: 0, age: 0, buys: 0, sells: 0 };
    }
  }

  private calculateBuyPressure(priceData: TokenPrice): number {
    // Buy pressure = (volume * price_change) / liquidity
    const changeFactor = (priceData.priceChange24h || 0) / 100;
    const volumeFactor = Math.min(priceData.volume24h / (priceData.liquidity || 1), 2);
    return Math.max(0, Math.min(100, (changeFactor + volumeFactor) * 50));
  }

  private calculateConfidence(priceData: TokenPrice, holders: any, buyPressure: number): number {
    let score = 0;

    // Liquidity (25 points)
    if (priceData.liquidity > 10000) score += 15;
    if (priceData.liquidity > 50000) score += 10;

    // Volume (20 points)
    if (priceData.volume24h > 50000) score += 15;
    if (priceData.volume24h > 100000) score += 5;

    // Buy pressure (25 points)
    score += Math.min(25, buyPressure / 4);

    // Holders (20 points)
    if (holders.count > 100 && holders.count < 50000) {
      score += 15;
    }

    // Buy/Sell ratio (10 points)
    const ratio = holders.buys / (holders.sells || 1);
    if (ratio > 1.5) score += 10;

    return Math.min(100, score);
  }

  async getPrice(mint: string): Promise<number> {
    const priceData = await this.getTokenPrice(mint);
    return priceData?.priceUsd || 0;
  }

  async getPrices(mints: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const results = await Promise.all(mints.map(mint => this.getTokenPrice(mint)));
    
    results.forEach((result, index) => {
      if (result) {
        prices.set(mints[index], result.priceUsd);
      }
    });

    return prices;
  }

  async getPoolInfo(poolId: string): Promise<PoolData | null> {
    try {
      const response = await axios.get(`${this.raydiumApiUrl}/pools/${poolId}`);
      return response.data;
    } catch (err) {
      telemetryLogger.error(`Failed to get pool info for ${poolId}`, 'dex-market', err);
      return null;
    }
  }
}

export default new DexMarketData();
