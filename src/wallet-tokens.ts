// src/wallet-tokens.ts
// Token holdings for a wallet

import axios from 'axios';
import telemetryLogger from './telemetry';

export interface TokenHolding {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  usdValue: number;
  uiAmount: number;
}

class WalletTokens {
  async getTokenHoldings(address: string): Promise<TokenHolding[]> {
    const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    try {
      const res = await axios.post(rpc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed', commitment: 'confirmed' },
        ],
      }, { timeout: 15000 });

      const accounts = res.data?.result?.value || [];
      const holdings: TokenHolding[] = [];

      for (const acc of accounts) {
        const info = acc.account?.data?.parsed?.info;
        if (!info) continue;
        const amount = parseFloat(info.tokenAmount?.uiAmountString || '0');
        if (amount <= 0) continue;
        holdings.push({
          mint: info.mint || '',
          symbol: '',
          amount: parseInt(info.tokenAmount?.amount || '0'),
          decimals: info.tokenAmount?.decimals || 6,
          usdValue: 0,
          uiAmount: amount,
        });
      }

      return holdings;
    } catch (err) {
      telemetryLogger.warn(`Token holdings fetch failed for ${address.slice(0, 8)}`, 'wallet-tokens');
      return [];
    }
  }

  async getTokenDecimals(mint: string): Promise<number> {
    const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    try {
      const res = await axios.post(rpc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mint, { encoding: 'jsonParsed' }],
      }, { timeout: 8000 });
      return res.data?.result?.value?.data?.parsed?.info?.decimals ?? 6;
    } catch {
      return 6;
    }
  }
}

export default new WalletTokens();
