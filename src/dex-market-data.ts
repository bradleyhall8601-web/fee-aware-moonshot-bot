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
  prevVolume24h?: number;
  priceChange1m: number;
  priceChange5m: number;
  holders: number;
  age: number;
  buys: number;
  sells: number;
  buyPressure: number;
  confidence: number;
  dexs: string[];
  liquidityLockedPct?: number;
  mintAuthorityRevoked?: boolean;
  freezeAuthorityRevoked?: boolean;
  holderConcentrationPct?: number;
  higherHighs?: boolean;
  microTrendUp?: boolean;
}

class DexMarketData {
  private raydiumApiUrl = 'https://api.raydium.io/v2';
  private jupiterApiUrl = 'https://quote-api.jup.ag/v6';
  private birdeyeApiUrl = 'https://public-api.birdeye.so/defi';
  private solanaRpc = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

  private moonshotCache: { value: MoonshotCandidate[]; ts: number } = { value: [], ts: 0 };
  private tokenAnalysisCache = new Map<string, { value: MoonshotCandidate | null; ts: number }>();
  private readonly moonshotCacheMs = Number(process.env.MARKET_CACHE_MS || 10000);
  private readonly upstreamBackoffMs = Number(process.env.MARKET_UPSTREAM_BACKOFF_MS || 60000);
  private raydiumBackoffUntil = 0;
  private jupiterBackoffUntil = 0;

  async getMoonshotCandidates(): Promise<MoonshotCandidate[]> {
    const now = Date.now();
    if (this.moonshotCache.value.length > 0 && now - this.moonshotCache.ts < this.moonshotCacheMs) {
      return this.moonshotCache.value;
    }

    try {
      const candidates: MoonshotCandidate[] = [];
      const [raydiumTokens, jupiterTokens] = await Promise.all([
        this.getRaydiumNewTokens(),
        this.getJupiterNewTokens(),
      ]);

      const uniqueMints = Array.from(new Set([...raydiumTokens, ...jupiterTokens].map((t) => t.mint))).slice(0, 25);

      for (const mint of uniqueMints) {
        const tokenData = await this.analyzeTokenWithCache(mint);
        if (tokenData && tokenData.confidence >= 60) {
          candidates.push(tokenData);
        }
      }

      const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
      this.moonshotCache = { value: sorted, ts: now };
      return sorted;
    } catch (err) {
      telemetryLogger.error('Failed to get moonshot candidates', 'dex-market', err);
      return this.moonshotCache.value;
    }
  }

  private async analyzeTokenWithCache(mint: string): Promise<MoonshotCandidate | null> {
    const now = Date.now();
    const cached = this.tokenAnalysisCache.get(mint);
    if (cached && now - cached.ts < this.moonshotCacheMs) return cached.value;

    const analyzed = await this.analyzeToken(mint);
    this.tokenAnalysisCache.set(mint, { value: analyzed, ts: now });
    return analyzed;
  }

  private async getRaydiumNewTokens(): Promise<any[]> {
    if (Date.now() < this.raydiumBackoffUntil) {
      return [];
    }
    try {
      const response = await axios.get(`${this.raydiumApiUrl}/main/pairs`, { timeout: 10000 });
      this.raydiumBackoffUntil = 0;
      return response.data.filter((pool: any) => {
        const age = Date.now() - pool.createdAt * 1000;
        return age < 48 * 60 * 60 * 1000;
      }).slice(0, 50);
    } catch (err) {
      telemetryLogger.warn('Raydium API error', 'dex-market', err);
      this.raydiumBackoffUntil = Date.now() + this.upstreamBackoffMs;
      return [];
    }
  }

  private async getJupiterNewTokens(): Promise<any[]> {
    if (Date.now() < this.jupiterBackoffUntil) {
      return [];
    }
    try {
      const response = await axios.get(`${this.jupiterApiUrl}/tokens`, { timeout: 10000 });
      this.jupiterBackoffUntil = 0;
      return response.data || [];
    } catch (err) {
      telemetryLogger.warn('Jupiter API error', 'dex-market', err);
      this.jupiterBackoffUntil = Date.now() + this.upstreamBackoffMs;
      return [];
    }
  }

  private async analyzeToken(mint: string): Promise<MoonshotCandidate | null> {
    try {
      const [priceData, tokenInfo, holderData, securityData] = await Promise.all([
        this.getTokenPrice(mint),
        this.getTokenInfo(mint),
        this.getTokenHolders(mint),
        this.getTokenSecurity(mint),
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
        prevVolume24h: holderData.prevVolume24h || 0,
        priceChange1m: holderData.priceChange1m || 0,
        priceChange5m: holderData.priceChange5m || 0,
        holders: holderData.count || 0,
        age: holderData.age || 0,
        buys: holderData.buys || 0,
        sells: holderData.sells || 0,
        buyPressure,
        confidence,
        dexs: ['raydium', 'jupiter'],
        liquidityLockedPct: securityData.liquidityLockedPct,
        mintAuthorityRevoked: securityData.mintAuthorityRevoked,
        freezeAuthorityRevoked: securityData.freezeAuthorityRevoked,
        holderConcentrationPct: securityData.holderConcentrationPct,
        higherHighs: securityData.higherHighs,
        microTrendUp: securityData.microTrendUp,
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
        headers: { 'X-API-Key': process.env.BIRDEYE_API_KEY || 'public' },
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
    } catch {
      return null;
    }
  }

  private async getTokenInfo(mint: string): Promise<TokenInfo | null> {
    try {
      const response = await axios.post(this.solanaRpc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenSupply',
        params: [mint],
      }, { timeout: 5000 });

      const decimals = response.data.result?.value?.decimals || 6;
      return { mint, symbol: '', name: '', decimals, logo: '' };
    } catch {
      return null;
    }
  }

  private async getTokenHolders(mint: string): Promise<any> {
    try {
      const response = await axios.get(`${this.birdeyeApiUrl}/token_trending`, {
        headers: { 'X-API-Key': process.env.BIRDEYE_API_KEY || 'public' },
        timeout: 5000,
      });

      const row = (response.data?.data?.tokens || []).find((t: any) => t.address === mint) || {};
      return {
        count: row.holders || 0,
        age: row.ageHours || 0,
        buys: row.buy24h || 0,
        sells: row.sell24h || 0,
        prevVolume24h: row.prevVolume24h || 0,
        priceChange1m: row.priceChange1m || 0,
        priceChange5m: row.priceChange5m || 0,
        topHolderPct: row.topHolderPct || row.top10HoldingsPct || 100,
        liquidityLockedPct: row.liquidityLockedPct || row.lpLockedPct || 0,
      };
    } catch {
      return { count: 0, age: 0, buys: 0, sells: 0, prevVolume24h: 0, priceChange1m: 0, priceChange5m: 0 };
    }
  }


  private async getTokenSecurity(mint: string): Promise<{ liquidityLockedPct: number; mintAuthorityRevoked: boolean; freezeAuthorityRevoked: boolean; holderConcentrationPct: number; higherHighs: boolean; microTrendUp: boolean }> {
    try {
      const mintInfo = await axios.post(this.solanaRpc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mint, { encoding: 'jsonParsed' }],
      }, { timeout: 5000 });

      const parsedInfo = mintInfo.data?.result?.value?.data?.parsed?.info || {};
      const mintAuthorityRevoked = !parsedInfo.mintAuthority;
      const freezeAuthorityRevoked = !parsedInfo.freezeAuthority;

      const trending = await this.getTokenHolders(mint);
      const holderConcentrationPct = Number(trending.topHolderPct || 100);
      const liquidityLockedPct = Number(trending.liquidityLockedPct || 0);
      const microTrendUp = Number(trending.priceChange1m || 0) > 0;
      const higherHighs = Number(trending.priceChange1m || 0) > 0 && Number(trending.priceChange5m || 0) > 0;

      return {
        liquidityLockedPct,
        mintAuthorityRevoked,
        freezeAuthorityRevoked,
        holderConcentrationPct,
        higherHighs,
        microTrendUp,
      };
    } catch {
      return {
        liquidityLockedPct: 0,
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
        holderConcentrationPct: 100,
        higherHighs: false,
        microTrendUp: false,
      };
    }
  }

  private calculateBuyPressure(priceData: TokenPrice): number {
    const changeFactor = (priceData.priceChange24h || 0) / 100;
    const volumeFactor = Math.min(priceData.volume24h / (priceData.liquidity || 1), 2);
    return Math.max(0, Math.min(100, (changeFactor + volumeFactor) * 50));
  }

  private calculateConfidence(priceData: TokenPrice, holders: any, buyPressure: number): number {
    let score = 0;
    if (priceData.liquidity > 10000) score += 15;
    if (priceData.liquidity > 50000) score += 10;
    if (priceData.volume24h > 50000) score += 15;
    if (priceData.volume24h > 100000) score += 5;
    score += Math.min(25, buyPressure / 4);
    if (holders.count > 100 && holders.count < 50000) score += 15;
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
    const unique = Array.from(new Set(mints));
    const results = await Promise.all(unique.map((mint) => this.getTokenPrice(mint)));

    results.forEach((result, index) => {
      if (result) prices.set(unique[index], result.priceUsd);
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
