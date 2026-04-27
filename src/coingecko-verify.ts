// src/coingecko-verify.ts
// SOL price verification via CoinGecko

import axios from 'axios';
import telemetryLogger from './telemetry';

class CoinGeckoVerify {
  private lastPrice = 0;
  private lastFetchAt = 0;
  private readonly TTL = 60000;

  async getSolPrice(): Promise<number | null> {
    const now = Date.now();
    if (this.lastPrice > 0 && now - this.lastFetchAt < this.TTL) {
      return this.lastPrice;
    }

    try {
      const res = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: { ids: 'solana', vs_currencies: 'usd' },
          timeout: 8000,
        }
      );
      const price = res.data?.solana?.usd;
      if (price && price > 0) {
        this.lastPrice = price;
        this.lastFetchAt = now;
        return price;
      }
      return null;
    } catch (err) {
      telemetryLogger.debug('CoinGecko SOL price fetch failed', 'coingecko');
      return this.lastPrice > 0 ? this.lastPrice : null;
    }
  }

  async verifyPrice(price: number, tolerance = 0.05): Promise<boolean> {
    const cgPrice = await this.getSolPrice();
    if (!cgPrice) return true; // Can't verify, allow
    const diff = Math.abs(price - cgPrice) / cgPrice;
    return diff <= tolerance;
  }

  getLastKnownPrice(): number {
    return this.lastPrice;
  }
}

export default new CoinGeckoVerify();
