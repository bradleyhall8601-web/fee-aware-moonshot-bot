import database, { TradingSession } from '../src/database';
import telemetryLogger from '../src/telemetry';
import userManager from '../src/user-manager';
import aiBrain from '../phase4/ai-brain';
import godMode from './god-mode-engine';
import { simulateExecution, liveExecution } from './phantom-execution';

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
  confidence: number;
  reason: string;
}

interface CandidateInput {
  mint: string;
  symbol?: string;
  name?: string;
  price: number;
  liquidity: number;
  volume24h: number;
  buys?: number;
  sells?: number;
  age?: number;
  holders?: number;
  confidence?: number;
  priceChange5m?: number;
}

class TradingEnginePhase5 {
  private activeTrades: Map<string, Trade> = new Map();

  async analyzeMoonshot(mint: string, candidate?: CandidateInput): Promise<TradingSignal | null> {
    if (!candidate) return null;

    const godScore = godMode.score({
      liquidity: candidate.liquidity,
      volume24h: candidate.volume24h,
      buys: candidate.buys || 0,
      sells: candidate.sells || 0,
      ageHours: candidate.age || 999,
      priceChange5m: candidate.priceChange5m || 0,
      confidence: candidate.confidence || 0,
    });

    if (!godMode.shouldEnter(godScore)) return null;

    const adjustedConfidence = aiBrain.adjustConfidence(godScore.score);
    if (adjustedConfidence < 75) return null;

    return {
      type: 'BUY',
      mint,
      price: candidate.price,
      confidence: adjustedConfidence,
      reason: godScore.reasons.join('|'),
    };
  }

  async executeBuyTrade(userId: string, signal: TradingSignal, portfolioValue: number): Promise<boolean> {
    try {
      const user = database.getUserById(userId);
      const config = userManager.getUserConfig(userId);
      if (!user || !config) return false;

      const open = database.getUserTradingSessions(userId).filter(s => s.status === 'open');
      if (open.length >= 3) return false;
      if (open.some(s => s.tokenMint === signal.mint)) return false;

      const size = Math.max(5, Math.min(portfolioValue, config.tradeSize || portfolioValue));
      const amount = size / signal.price;

      const execution = config.enableLiveTrading
        ? await liveExecution(signal.price, amount)
        : await simulateExecution(signal.price, amount);

      if (!execution.success) return false;

      const session = database.createTradingSession({
        userId,
        tokenMint: signal.mint,
        entryPrice: execution.executedPrice,
        entryAmount: execution.amount,
        status: 'open',
        startedAt: Date.now(),
      });

      this.activeTrades.set(session.id, {
        mint: signal.mint,
        entryPrice: execution.executedPrice,
        entryAmount: execution.amount,
        currentPrice: execution.executedPrice,
        profitPct: 0,
        riskReward: 0,
      });

      telemetryLogger.info(`phase5 buy executed for ${signal.mint}`, 'trading-engine-phase5');
      return true;
    } catch (err) {
      telemetryLogger.error('phase5 buy error', 'trading-engine-phase5', err);
      return false;
    }
  }

  async manageTrades(userId: string, prices: Map<string, number>): Promise<void> {
    const config = userManager.getUserConfig(userId);
    if (!config) return;

    const open = database.getUserTradingSessions(userId).filter(s => s.status === 'open');
    for (const session of open) {
      const price = prices.get(session.tokenMint);
      if (!price) continue;

      const pct = ((price - session.entryPrice) / session.entryPrice) * 100;
      const stop = session.entryPrice * (1 - config.trailingStopPct / 100);

      if (pct >= config.profitTargetPct || price <= stop) {
        await this.closeTrade(session, price, pct);
      }
    }
  }

  private async closeTrade(session: TradingSession, price: number, pct: number): Promise<void> {
    const profit = (price - session.entryPrice) * session.entryAmount;
    database.closeTradingSession(session.id, price, session.entryAmount, profit, pct);
    this.activeTrades.delete(session.id);

    aiBrain.record({
      mint: session.tokenMint,
      profitPct: pct,
      durationMs: Date.now() - session.startedAt,
      entryConfidence: 75,
      timestamp: Date.now(),
    });

    const sessions = database.getUserTradingSessions(session.userId);
    database.updatePerformanceMetrics(session.userId, sessions);
  }
}

export default new TradingEnginePhase5();
