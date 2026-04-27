// src/helius-tracker.ts
// Helius API integration for enhanced Solana data

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  nativeTransfers: any[];
  tokenTransfers: any[];
  accountData: any[];
}

class HeliusTracker {
  private apiKey = process.env.HELIUS_API_KEY || '';
  private baseUrl = 'https://api.helius.xyz/v0';

  async getTransactionHistory(address: string, limit = 20): Promise<HeliusTransaction[]> {
    if (!this.apiKey) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/addresses/${address}/transactions`, {
        params: { api_key: this.apiKey, limit },
        timeout: 10000,
      });
      return res.data || [];
    } catch (err) {
      telemetryLogger.debug(`Helius tx history failed for ${address.slice(0, 8)}`, 'helius');
      return [];
    }
  }

  async getTokenMetadata(mints: string[]): Promise<any[]> {
    if (!this.apiKey || mints.length === 0) return [];
    try {
      const res = await axios.post(
        `${this.baseUrl}/token-metadata`,
        { mintAccounts: mints.slice(0, 100) },
        {
          params: { api_key: this.apiKey },
          timeout: 10000,
        }
      );
      return res.data || [];
    } catch (err) {
      telemetryLogger.debug('Helius token metadata failed', 'helius');
      return [];
    }
  }

  async getWebhooks(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/webhooks`, {
        params: { api_key: this.apiKey },
        timeout: 8000,
      });
      return res.data || [];
    } catch {
      return [];
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export default new HeliusTracker();
