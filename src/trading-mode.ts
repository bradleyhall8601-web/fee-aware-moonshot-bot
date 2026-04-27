// src/trading-mode.ts
// Paper/live mode logic and gate checking

import telemetryLogger from './telemetry';
import walletBalance from './wallet-balance';
import database from './database';

export type EffectiveMode = 'PAPER' | 'LIVE';

export interface ModeStatus {
  globalLiveEnabled: boolean;
  userPreference: EffectiveMode;
  effectiveMode: EffectiveMode;
  gates: {
    subscriptionActive: boolean;
    walletConnected: boolean;
    aiReadiness: boolean;
    globalLiveAllowed: boolean;
    enoughSol: boolean;
  };
  missingGates: string[];
  solBalance?: number;
  solPrice?: number;
  tradableAmount?: number;
  gasReserve?: number;
  balanceFresh?: boolean;
}

class TradingModeManager {
  private globalLiveEnabled = process.env.ENABLE_LIVE_TRADING === 'true';
  private aiReadiness = 0; // 0-100

  setGlobalLive(enabled: boolean): void {
    this.globalLiveEnabled = enabled;
    telemetryLogger.info(`Global live trading: ${enabled ? 'ENABLED' : 'DISABLED'}`, 'trading-mode');
  }

  setAIReadiness(score: number): void {
    this.aiReadiness = Math.max(0, Math.min(100, score));
    if (score >= 70) {
      telemetryLogger.info(`AI readiness at ${score}% - recommend live mode review`, 'trading-mode');
    }
  }

  async getModeStatus(userId: string): Promise<ModeStatus> {
    const user = database.getUserById(userId);
    const config = database.getUserConfig(userId);
    const missingGates: string[] = [];

    const subscriptionActive = this.checkSubscription(userId);
    const walletConnected = !!(user?.walletAddress);
    const aiReady = this.aiReadiness >= 70;
    const globalAllowed = this.globalLiveEnabled;

    let solBalance = 0;
    let solPrice = 0;
    let tradableAmount = 0;
    let balanceFresh = false;
    let enoughSol = false;

    if (walletConnected && user?.walletAddress) {
      try {
        const balance = await walletBalance.getBalance(user.walletAddress);
        solBalance = balance.solBalance;
        solPrice = balance.solPrice;
        tradableAmount = walletBalance.getTradableAmount(solBalance);
        balanceFresh = !balance.isStale;
        enoughSol = tradableAmount > 0.1; // At least 0.1 SOL tradable
      } catch {
        enoughSol = false;
      }
    }

    if (!subscriptionActive) missingGates.push('Subscription not active');
    if (!walletConnected) missingGates.push('Wallet not connected');
    if (!aiReady) missingGates.push(`AI readiness too low (${this.aiReadiness}%)`);
    if (!globalAllowed) missingGates.push('Live trading not enabled by admin');
    if (!enoughSol) missingGates.push('Insufficient SOL balance');

    const userPreference: EffectiveMode = config?.enableLiveTrading ? 'LIVE' : 'PAPER';
    const allGatesPassed = subscriptionActive && walletConnected && aiReady && globalAllowed && enoughSol;
    const effectiveMode: EffectiveMode = (userPreference === 'LIVE' && allGatesPassed) ? 'LIVE' : 'PAPER';

    return {
      globalLiveEnabled: this.globalLiveEnabled,
      userPreference,
      effectiveMode,
      gates: {
        subscriptionActive,
        walletConnected,
        aiReadiness: aiReady,
        globalLiveAllowed: globalAllowed,
        enoughSol,
      },
      missingGates,
      solBalance,
      solPrice,
      tradableAmount,
      gasReserve: walletBalance.getGasReserve(),
      balanceFresh,
    };
  }

  private checkSubscription(userId: string): boolean {
    try {
      const user = database.getUserById(userId);
      if (!user) return false;
      // Check access status
      const accessRow = (database as any).getUserAccess?.(userId);
      if (!accessRow) return false;
      const status = accessRow.status;
      return ['owner', 'dev', 'active', 'granted'].includes(status);
    } catch {
      return false;
    }
  }

  isGlobalLiveEnabled(): boolean { return this.globalLiveEnabled; }
  getAIReadiness(): number { return this.aiReadiness; }
}

export default new TradingModeManager();
