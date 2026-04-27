// src/wallet-balance.ts
// Wallet balance tracking and SOL price fetching

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface WalletBalance {
  address: string;
  solBalance: number;
  solBalanceUsd: number;
  solPrice: number;
  tokenBalances: TokenBalance[];
  fetchedAt: number;
  isStale: boolean;
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  usdValue: number;
}

class WalletBalanceTracker {
  private solPrice = 0;
  private solPriceFetchedAt = 0;
  private balanceCache = new Map<string, WalletBalance>();
  private readonly STALE_MS = 60000; // 1 minute
  private readonly SOL_PRICE_TTL = 30000; // 30 seconds

  async getSolPrice(): Promise<number> {
    const now = Date.now();
    if (this.solPrice > 0 && now - this.solPriceFetchedAt < this.SOL_PRICE_TTL) {
      return this.solPrice;
    }

    try {
      // Try CoinGecko first
      const res = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: { ids: 'solana', vs_currencies: 'usd' },
          timeout: 5000,
        }
      );
      this.solPrice = res.data?.solana?.usd || 0;
      this.solPriceFetchedAt = now;
      return this.solPrice;
    } catch {
      // Fallback to Jupiter price
      try {
        const res = await axios.get(
          'https://price.jup.ag/v4/price',
          {
            params: { ids: 'SOL' },
            timeout: 5000,
          }
        );
        this.solPrice = res.data?.data?.SOL?.price || 0;
        this.solPriceFetchedAt = now;
        return this.solPrice;
      } catch {
        telemetryLogger.warn('SOL price fetch failed', 'wallet-balance');
        return this.solPrice; // Return last known price
      }
    }
  }

  async getBalance(address: string, rpcUrl?: string): Promise<WalletBalance> {
    const cached = this.balanceCache.get(address);
    if (cached && Date.now() - cached.fetchedAt < this.STALE_MS) {
      return cached;
    }

    const rpc = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const solPrice = await this.getSolPrice();

    try {
      const res = await axios.post(rpc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address, { commitment: 'confirmed' }],
      }, { timeout: 10000 });

      const lamports = res.data?.result?.value || 0;
      const solBalance = lamports / 1e9;
      const solBalanceUsd = solBalance * solPrice;

      const balance: WalletBalance = {
        address,
        solBalance,
        solBalanceUsd,
        solPrice,
        tokenBalances: [],
        fetchedAt: Date.now(),
        isStale: false,
      };

      this.balanceCache.set(address, balance);
      return balance;
    } catch (err) {
      telemetryLogger.warn(`Balance fetch failed for ${address.slice(0, 8)}...`, 'wallet-balance');
      const stale = this.balanceCache.get(address);
      if (stale) {
        return { ...stale, isStale: true };
      }
      return {
        address,
        solBalance: 0,
        solBalanceUsd: 0,
        solPrice,
        tokenBalances: [],
        fetchedAt: Date.now(),
        isStale: true,
      };
    }
  }

  isSolPriceAvailable(): boolean {
    return this.solPrice > 0 && Date.now() - this.solPriceFetchedAt < 120000;
  }

  getGasReserve(): number {
    return parseFloat(process.env.GAS_RESERVE_SOL || '0.05');
  }

  getTradableAmount(solBalance: number): number {
    const reserve = this.getGasReserve();
    return Math.max(0, solBalance - reserve);
  }
}

export default new WalletBalanceTracker();
