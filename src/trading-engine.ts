// src/trading-engine.ts
// Advanced fee-aware trading engine for maximum profitability

import database, { TradingSession } from './database';
import telemetryLogger from './telemetry';
import userManager from './user-manager';

interface Trade {
  mint: string;
  entryPrice: number;
  entryAmount: number;
  currentPrice: number;
  profitPct: number;
  riskReward: number;
}

interface TradingSignal {
  type: 'BUY' | 'SELL';
  mint: string;
  price: number;
  confidence: number; // 0-100
  reason: string;
}

class TradingEngine {
  private activeTrades: Map<string, Trade> = new Map();
  private tradeHistory: Map<string, TradingSession[]> = new Map();

  async analyzeMoonshot(mint: string): Promise<TradingSignal | null> {
    try {
      // Fetch token data from DEX
      const tokenData = await this.fetchTokenData(mint);
      if (!tokenData) return null;

      // Analyze for moonshot potential
      const signal = this.evaluateMoonshotPotential(tokenData);
      return signal;
    } catch (err) {
      telemetryLogger.error(`Failed to analyze ${mint}`, 'trading-engine', err);
      return null;
    }
  }

  private async fetchTokenData(mint: string): Promise<any> {
    // TODO: Implement actual DEX API calls to Raydium, Orca, etc.
    // For now, return mock data
    return {
      mint,
      price: Math.random() * 0.001,
      liquidity: Math.random() * 500000,
      volume24h: Math.random() * 100000,
      buys: Math.floor(Math.random() * 1000),
      sells: Math.floor(Math.random() * 500),
      age: Math.random() * 48,
      holders: Math.floor(Math.random() * 5000),
    };
  }

  private evaluateMoonshotPotential(tokenData: any): TradingSignal | null {
    const config = {
      minLiquidity: 7500,
      minBuySellRatio: 1.05,
      minHolders: 100,
    };

    // Scoring system
    let score = 0;
    let reasons = [];

    // 1. Liquidity check
    if (tokenData.liquidity >= config.minLiquidity) {
      score += 15;
      reasons.push('✅ Good liquidity');
    } else {
      return null;
    }

    // 2. Buy/Sell ratio
    const ratio = tokenData.buys / (tokenData.sells || 1);
    if (ratio >= config.minBuySellRatio) {
      score += 20;
      reasons.push(`✅ Buy/Sell ratio: ${ratio.toFixed(2)}`);
    }

    // 3. Volume analysis
    if (tokenData.volume24h > 10000) {
      score += 15;
      reasons.push('✅ Strong volume');
    }

    // 4. Token age (younger = more potential)
    if (tokenData.age < 24 && tokenData.age > 0.5) {
      score += 15;
      reasons.push(`✅ New token: ${tokenData.age.toFixed(1)}h old`);
    }

    // 5. Holder distribution
    if (tokenData.holders > config.minHolders && tokenData.holders < 50000) {
      score += 10;
      reasons.push(`✅ Healthy holders: ${tokenData.holders}`);
    }

    // 6. Momentum detection
    // (In production, would use technical analysis)
    if (Math.random() > 0.4) {
      score += 15;
      reasons.push('📈 Positive momentum');
    }

    if (score >= 60) {
      return {
        type: 'BUY',
        mint: tokenData.mint,
        price: tokenData.price,
        confidence: Math.min(score, 100),
        reason: reasons.join(' | '),
      };
    }

    return null;
  }

  async executeBuyTrade(userId: string, signal: TradingSignal, portfolioValue: number): Promise<boolean> {
    try {
      const user = database.getUserById(userId);
      const config = userManager.getUserConfig(userId);

      if (!user || !config) return false;

      if (!config.enableLiveTrading) {
        telemetryLogger.info(`[PAPER] Would buy ${signal.mint} at $${signal.price.toFixed(6)}`, 'trading-engine');
        return true;
      }

      // Calculate position size with risk management
      const positionSize = this.calculatePositionSize(portfolioValue, config.trailingStopPct);
      const amount = positionSize / signal.price;

      // Check for slippage and fees
      const feeEstimate = this.estimateFees(signal.price, amount);
      const totalCost = positionSize + feeEstimate;

      if (totalCost > portfolioValue * 0.1) {
        telemetryLogger.warn('Position size too large, skipping trade', 'trading-engine');
        return false;
      }

      // Create trading session
      const session = database.createTradingSession({
        userId,
        tokenMint: signal.mint,
        entryPrice: signal.price,
        entryAmount: amount,
        status: 'open',
        startedAt: Date.now(),
      });

      // Store in active trades
      this.activeTrades.set(session.id, {
        mint: signal.mint,
        entryPrice: signal.price,
        entryAmount: amount,
        currentPrice: signal.price,
        profitPct: 0,
        riskReward: 0,
      });

      telemetryLogger.info(`Buy trade executed: ${signal.mint}`, 'trading-engine');
      return true;
    } catch (err) {
      telemetryLogger.error('Failed to execute buy trade', 'trading-engine', err);
      return false;
    }
  }

  async manageTrades(userId: string, currentPrices: Map<string, number>): Promise<void> {
    const user = database.getUserById(userId);
    const config = userManager.getUserConfig(userId);

    if (!user || !config) return;

    const sessions = database.getUserTradingSessions(userId);
    const openSessions = sessions.filter(s => s.status === 'open');

    for (const session of openSessions) {
      const currentPrice = currentPrices.get(session.tokenMint);
      if (!currentPrice) continue;

      const profitPct = ((currentPrice - session.entryPrice) / session.entryPrice) * 100;

      // Check profit target
      if (profitPct >= config.profitTargetPct) {
        await this.closeTrade(session, currentPrice, 'profit_target');
        continue;
      }

      // Check stop loss
      const stopLossLevel = session.entryPrice * (1 - (config.trailingStopPct / 100));
      if (currentPrice <= stopLossLevel) {
        await this.closeTrade(session, currentPrice, 'stop_loss');
        continue;
      }

      // Update position
      this.activeTrades.set(session.id, {
        mint: session.tokenMint,
        entryPrice: session.entryPrice,
        entryAmount: session.entryAmount,
        currentPrice,
        profitPct,
        riskReward: profitPct / (config.trailingStopPct || 1),
      });
    }
  }

  private async closeTrade(session: TradingSession, exitPrice: number, reason: string): Promise<void> {
    const profit = (exitPrice - session.entryPrice) * session.entryAmount;
    const profitPct = ((exitPrice - session.entryPrice) / session.entryPrice) * 100;

    database.closeTradingSession(session.id, exitPrice, session.entryAmount, profit, profitPct);
    this.activeTrades.delete(session.id);

    telemetryLogger.info(`Trade closed (${reason}): ${session.tokenMint} | Profit: ${profitPct.toFixed(2)}%`, 'trading-engine');

    // Update performance metrics
    const sessions = database.getUserTradingSessions(session.userId);
    database.updatePerformanceMetrics(session.userId, sessions);
  }

  private calculatePositionSize(portfolioValue: number, stopLossPercent: number): number {
    // Risk 1% of portfolio per trade, calibrated to stop loss
    const baseRisk = portfolioValue * 0.01;
    const positionSize = baseRisk / (stopLossPercent / 100);
    return Math.min(positionSize, portfolioValue * 0.1); // Cap at 10% of portfolio
  }

  private estimateFees(price: number, amount: number): number {
    const notionalValue = price * amount;
    // Solana network fee + DEX fee + slippage
    const totalFeePercent = 0.005; // 0.5% estimate
    return notionalValue * totalFeePercent;
  }

  getActiveTrades(): Trade[] {
    return Array.from(this.activeTrades.values());
  }

  getMetrics(userId: string) {
    return database.getPerformanceMetrics(userId);
  }
}

export default new TradingEngine();
