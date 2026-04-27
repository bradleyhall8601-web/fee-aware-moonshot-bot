// src/sol-payout.ts
// SOL payment handler for subscriptions

import axios from 'axios';
import telemetryLogger from './telemetry';
import walletBalance from './wallet-balance';

export interface SolPaymentRequest {
  userId: string;
  telegramId: string;
  expectedUsd: number;
  ownerWallet: string;
  expiresAt: number;
  createdAt: number;
  status: 'pending' | 'confirmed' | 'expired' | 'failed';
  txSignature?: string;
  solAmount?: number;
}

class SolPayoutHandler {
  private pendingPayments = new Map<string, SolPaymentRequest>();
  private readonly TOLERANCE = 0.05; // 5% tolerance
  private readonly EXPIRY_MS = 60 * 60 * 1000; // 1 hour

  async createPaymentRequest(userId: string, telegramId: string): Promise<SolPaymentRequest> {
    const solPrice = await walletBalance.getSolPrice();
    if (!solPrice || solPrice <= 0) {
      throw new Error('SOL price unavailable');
    }

    const priceUsd = parseFloat(process.env.SUBSCRIPTION_PRICE_USD || '49.99');
    const solAmount = priceUsd / solPrice;
    const ownerWallet = process.env.OWNER_PAYMENT_WALLET || '';

    if (!ownerWallet) {
      throw new Error('Owner payment wallet not configured');
    }

    const req: SolPaymentRequest = {
      userId,
      telegramId,
      expectedUsd: priceUsd,
      ownerWallet,
      expiresAt: Date.now() + this.EXPIRY_MS,
      createdAt: Date.now(),
      status: 'pending',
      solAmount,
    };

    this.pendingPayments.set(userId, req);
    telemetryLogger.info(`SOL payment request created for user ${userId}: ${solAmount.toFixed(4)} SOL`, 'sol-payout');
    return req;
  }

  async pollForPayment(userId: string): Promise<boolean> {
    const req = this.pendingPayments.get(userId);
    if (!req) return false;

    if (Date.now() > req.expiresAt) {
      req.status = 'expired';
      return false;
    }

    try {
      const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const res = await axios.post(rpc, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [req.ownerWallet, { limit: 10 }],
      }, { timeout: 10000 });

      const sigs = res.data?.result || [];
      const solPrice = await walletBalance.getSolPrice();

      for (const sig of sigs) {
        if (sig.blockTime && sig.blockTime * 1000 > req.createdAt) {
          // Check transaction details
          const txRes = await axios.post(rpc, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [sig.signature, { encoding: 'jsonParsed', commitment: 'confirmed' }],
          }, { timeout: 10000 });

          const tx = txRes.data?.result;
          if (!tx) continue;

          // Look for SOL transfer to owner wallet
          const transfers = tx.meta?.postBalances || [];
          const preBalances = tx.meta?.preBalances || [];
          const accounts = tx.transaction?.message?.accountKeys || [];

          for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            const pubkey = typeof acc === 'string' ? acc : acc.pubkey;
            if (pubkey === req.ownerWallet) {
              const received = ((transfers[i] || 0) - (preBalances[i] || 0)) / 1e9;
              const receivedUsd = received * solPrice;
              const expectedUsd = req.expectedUsd;
              const tolerance = expectedUsd * this.TOLERANCE;

              if (receivedUsd >= expectedUsd - tolerance) {
                req.status = 'confirmed';
                req.txSignature = sig.signature;
                telemetryLogger.info(`SOL payment confirmed for user ${userId}: ${received.toFixed(4)} SOL ($${receivedUsd.toFixed(2)})`, 'sol-payout');
                return true;
              }
            }
          }
        }
      }
    } catch (err) {
      telemetryLogger.warn(`SOL payment poll failed for user ${userId}`, 'sol-payout');
    }

    return false;
  }

  getPendingPayment(userId: string): SolPaymentRequest | null {
    return this.pendingPayments.get(userId) || null;
  }

  clearPayment(userId: string): void {
    this.pendingPayments.delete(userId);
  }
}

export default new SolPayoutHandler();
