import database, { TradingSession } from './database';
import telemetryLogger from './telemetry';
import userManager from './user-manager';

interface Trade { mint: string; entryPrice: number; entryAmount: number; currentPrice: number; profitPct: number; riskReward: number; }
interface TradingSignal { type: 'BUY' | 'SELL'; mint: string; price: number; confidence: number; reason: string; }
interface CandidateInput { mint: string; symbol?: string; name?: string; price: number; liquidity: number; volume24h: number; buys?: number; sells?: number; age?: number; holders?: number; confidence?: number; priceChange5m?: number; buyPressure?: number; }

class TradingEngine {
  private activeTrades: Map<string, Trade> = new Map();

  async analyzeMoonshot(mint: string, candidate?: CandidateInput): Promise<TradingSignal | null> {
    try {
      const tokenData = candidate;
      if (!tokenData) return null;
      return this.evaluateMoonshotPotential(tokenData);
    } catch (err) {
      telemetryLogger.error(`Failed to analyze ${mint}`, 'trading-engine', err);
      return null;
    }
  }

  private evaluateMoonshotPotential(tokenData: CandidateInput): TradingSignal | null {
    let score = 0;
    const reasons: string[] = [];

    if (tokenData.liquidity >= 10000) { score += 20; reasons.push('liquidity'); } else return null;
    if (tokenData.volume24h >= 5000) { score += 15; reasons.push('volume'); }
    const ratio = (tokenData.buys || 0) / Math.max(1, tokenData.sells || 0);
    if (ratio >= 1.15) { score += 15; reasons.push('buy pressure'); }
    if ((tokenData.age || 0) <= 24) { score += 10; reasons.push('fresh'); }
    if ((tokenData.priceChange5m || 0) > 0) { score += 10; reasons.push('momentum'); }
    score += Math.min(20, tokenData.confidence || 0);
    if (score < 65) return null;

    return { type: 'BUY', mint: tokenData.mint, price: tokenData.price, confidence: Math.round(score), reason: reasons.join('|') };
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

      const session = database.createTradingSession({ userId, tokenMint: signal.mint, entryPrice: signal.price, entryAmount: amount, status: 'open', startedAt: Date.now() });

      this.activeTrades.set(session.id, { mint: signal.mint, entryPrice: signal.price, entryAmount: amount, currentPrice: signal.price, profitPct: 0, riskReward: 0 });

      return true;
    } catch (err) {
      telemetryLogger.error('buy error', 'trading-engine', err);
      return false;
    }
  }

  async manageTrades(userId: string, prices: Map<string, number>): Promise<void> {
    const user = database.getUserById(userId);
    const config = userManager.getUserConfig(userId);
    if (!user || !config) return;

    const open = database.getUserTradingSessions(userId).filter(s => s.status === 'open');

    for (const session of open) {
      const price = prices.get(session.tokenMint);
      if (!price) continue;

      const pct = ((price - session.entryPrice) / session.entryPrice) * 100;

      if (pct >= config.profitTargetPct) {
        await this.closeTrade(session, price);
        continue;
      }

      const stop = session.entryPrice * (1 - config.trailingStopPct / 100);
      if (price <= stop) {
        await this.closeTrade(session, price);
      }
    }
  }

  private async closeTrade(session: TradingSession, price: number) {
    const profit = (price - session.entryPrice) * session.entryAmount;
    const pct = ((price - session.entryPrice) / session.entryPrice) * 100;
    database.closeTradingSession(session.id, price, session.entryAmount, profit, pct);
    this.activeTrades.delete(session.id);
    const sessions = database.getUserTradingSessions(session.userId);
    database.updatePerformanceMetrics(session.userId, sessions);
  }
}

export default new TradingEngine();