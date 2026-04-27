// src/wallet-tracker.ts
// Wallet monitoring and tracking

import telemetryLogger from './telemetry';
import walletBalance from './wallet-balance';
import database from './database';

export interface TrackedWallet {
  userId: string;
  address: string;
  label: string;
  solBalance: number;
  solBalanceUsd: number;
  lastUpdated: number;
  isActive: boolean;
}

class WalletTracker {
  private wallets = new Map<string, TrackedWallet>();
  private updateInterval: NodeJS.Timeout | null = null;

  start(): void {
    this.updateInterval = setInterval(() => this.updateAll(), 60000);
    telemetryLogger.info('Wallet tracker started', 'wallet-tracker');
  }

  stop(): void {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }

  async trackWallet(userId: string, address: string, label = 'Main'): Promise<TrackedWallet> {
    const balance = await walletBalance.getBalance(address);
    const wallet: TrackedWallet = {
      userId,
      address,
      label,
      solBalance: balance.solBalance,
      solBalanceUsd: balance.solBalanceUsd,
      lastUpdated: Date.now(),
      isActive: true,
    };
    this.wallets.set(`${userId}:${address}`, wallet);
    return wallet;
  }

  async getWallet(userId: string, address: string): Promise<TrackedWallet | null> {
    const key = `${userId}:${address}`;
    const cached = this.wallets.get(key);
    if (cached && Date.now() - cached.lastUpdated < 60000) return cached;
    return this.trackWallet(userId, address);
  }

  getUserWallets(userId: string): TrackedWallet[] {
    return Array.from(this.wallets.values()).filter(w => w.userId === userId);
  }

  private async updateAll(): Promise<void> {
    for (const [key, wallet] of this.wallets) {
      if (!wallet.isActive) continue;
      try {
        const balance = await walletBalance.getBalance(wallet.address);
        wallet.solBalance = balance.solBalance;
        wallet.solBalanceUsd = balance.solBalanceUsd;
        wallet.lastUpdated = Date.now();
      } catch (err) {
        telemetryLogger.debug(`Wallet update failed: ${wallet.address.slice(0, 8)}`, 'wallet-tracker');
      }
    }
  }

  getAllWallets(): TrackedWallet[] {
    return Array.from(this.wallets.values());
  }
}

export default new WalletTracker();
