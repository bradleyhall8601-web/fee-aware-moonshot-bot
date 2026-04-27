// src/paper-trading.ts
// Paper trading engine - simulates trades across multiple wallet sizes

import database from './database';
import telemetryLogger from './telemetry';
import type { AggregatedSignal } from './signal-aggregator';
import type { StrategyDecision } from './adaptive-strategy-engine';

export interface PaperPosition {
  id: string;
  userId: string;
  mint: string;
  symbol: string;
  entryPrice: number;
  entryAmount: number; // USD
  tokenAmount: number;
  walletSize: number;
  positionSizePct: number;
  takeProfitPct: number;
  stopLossPct: number;
  tpLadder?: number[];
  trailingStop: boolean;
  highWaterPct: number;
  mode: string;
  openedAt: number;
  lastCheckedAt: number;
  status: 'open' | 'closed';
  closedAt?: number;
  exitPrice?: number;
  profitPct?: number;
  profitUsd?: number;
  closeReason?: string;
  tpHits: number;
}

const WALLET_SIZES = [20, 30, 40, 100, 500, 1000, 5000, 10000];
const MAX_CONCURRENT = 3;
const MAX_HOLD_MS = 90 * 60 * 1000; // 90 minutes
const DEX_FEE_PCT = 0.25; // 0.25% per leg
const MONITOR_INTERVAL_MS = 10000;

class PaperTradingEngine {
  private positions = new Map<string, PaperPosition>();
  private closedPositions: PaperPosition[] = [];
  private monitorTimer: NodeJS.Timeout | null = null;
  private onCloseCallback?: (pos: PaperPosition) => void;

  start(onClose?: (pos: PaperPosition) => void): void {
    this.onCloseCallback = onClose;
    this.monitorTimer = setInterval(() => this.monitorPositions(), MONITOR_INTERVAL_MS);
    telemetryLogger.info('Paper trading engine started', 'paper');
  }

  stop(): void {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
  }

  async openPosition(
    userId: string,
    signal: AggregatedSignal,
    strategy: StrategyDecision,
    walletSize?: number
  ): Promise<PaperPosition | null> {
    const openForUser = Array.from(this.positions.values()).filter(
      p => p.userId === userId && p.status === 'open'
    );
    if (openForUser.length >= MAX_CONCURRENT) {
      telemetryLogger.debug(`Max concurrent paper trades reached for ${userId}`, 'paper');
      return null;
    }
    if (openForUser.some(p => p.mint === signal.mint)) {
      return null;
    }

    const ws = walletSize || WALLET_SIZES[1]; // Default 30 SOL equivalent
    const entryAmount = (ws * strategy.positionSizePct) / 100;
    const feeAdjusted = entryAmount * (1 - DEX_FEE_PCT / 100);
    const tokenAmount = signal.price > 0 ? feeAdjusted / signal.price : 0;

    const pos: PaperPosition = {
      id: `paper_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      mint: signal.mint,
      symbol: signal.symbol,
      entryPrice: signal.price,
      entryAmount,
      tokenAmount,
      walletSize: ws,
      positionSizePct: strategy.positionSizePct,
      takeProfitPct: strategy.takeProfitPct,
      stopLossPct: strategy.stopLossPct,
      tpLadder: strategy.tpLadder,
      trailingStop: strategy.trailingStop || false,
      highWaterPct: 0,
      mode: strategy.mode,
      openedAt: Date.now(),
      lastCheckedAt: Date.now(),
      status: 'open',
      tpHits: 0,
    };

    this.positions.set(pos.id, pos);
    telemetryLogger.info(
      `[PAPER] Opened ${strategy.mode} position: ${signal.symbol} @ $${signal.price.toFixed(8)}, size=$${entryAmount.toFixed(2)}`,
      'paper'
    );
    return pos;
  }

  updatePrice(mint: string, currentPrice: number): void {
    for (const pos of this.positions.values()) {
      if (pos.mint === mint && pos.status === 'open') {
        const pct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
        if (pct > pos.highWaterPct) pos.highWaterPct = pct;
        pos.lastCheckedAt = Date.now();
        this.checkExitConditions(pos, currentPrice);
      }
    }
  }

  private checkExitConditions(pos: PaperPosition, currentPrice: number): void {
    const pct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const now = Date.now();

    // Max hold time
    if (now - pos.openedAt > MAX_HOLD_MS) {
      this.closePosition(pos, currentPrice, 'max_hold_time');
      return;
    }

    // Stop loss
    if (pct <= -pos.stopLossPct) {
      this.closePosition(pos, currentPrice, 'stop_loss');
      return;
    }

    // Trailing stop (activates at +15%, 10% buffer from peak)
    if (pos.trailingStop && pos.highWaterPct >= 15) {
      const trailingStopPct = pos.highWaterPct - 10;
      if (pct <= trailingStopPct) {
        this.closePosition(pos, currentPrice, 'trailing_stop');
        return;
      }
    }

    // TP ladder
    if (pos.tpLadder && pos.tpLadder.length > pos.tpHits) {
      const nextTp = pos.tpLadder[pos.tpHits];
      if (pct >= nextTp) {
        pos.tpHits++;
        if (pos.tpHits >= pos.tpLadder.length) {
          this.closePosition(pos, currentPrice, `tp_ladder_${nextTp}pct`);
          return;
        }
        telemetryLogger.info(`[PAPER] TP hit ${pos.tpHits}/${pos.tpLadder.length} for ${pos.symbol} at +${pct.toFixed(1)}%`, 'paper');
      }
    } else if (pct >= pos.takeProfitPct) {
      this.closePosition(pos, currentPrice, 'take_profit');
    }
  }

  private closePosition(pos: PaperPosition, exitPrice: number, reason: string): void {
    const pct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const grossProfit = pos.entryAmount * (pct / 100);
    const exitFee = pos.entryAmount * (DEX_FEE_PCT / 100);
    const netProfit = grossProfit - exitFee;
    const netPct = (netProfit / pos.entryAmount) * 100;

    pos.status = 'closed';
    pos.closedAt = Date.now();
    pos.exitPrice = exitPrice;
    pos.profitPct = netPct;
    pos.profitUsd = netProfit;
    pos.closeReason = reason;

    this.positions.delete(pos.id);
    this.closedPositions.push(pos);
    if (this.closedPositions.length > 500) this.closedPositions.shift();

    telemetryLogger.info(
      `[PAPER] Closed ${pos.symbol}: ${netPct >= 0 ? '+' : ''}${netPct.toFixed(2)}% ($${netProfit.toFixed(2)}) reason=${reason}`,
      'paper'
    );

    if (this.onCloseCallback) this.onCloseCallback(pos);
  }

  private async monitorPositions(): Promise<void> {
    // Positions are updated via updatePrice() calls from the orchestrator
    const now = Date.now();
    for (const pos of this.positions.values()) {
      if (pos.status === 'open' && now - pos.openedAt > MAX_HOLD_MS) {
        this.closePosition(pos, pos.entryPrice, 'max_hold_time_monitor');
      }
    }
  }

  getOpenPositions(userId?: string): PaperPosition[] {
    const all = Array.from(this.positions.values()).filter(p => p.status === 'open');
    return userId ? all.filter(p => p.userId === userId) : all;
  }

  getClosedPositions(userId?: string, limit = 50): PaperPosition[] {
    const all = this.closedPositions.slice(-limit);
    return userId ? all.filter(p => p.userId === userId) : all;
  }

  getStats(userId?: string) {
    const closed = this.getClosedPositions(userId, 1000);
    const wins = closed.filter(p => (p.profitPct || 0) > 0);
    const losses = closed.filter(p => (p.profitPct || 0) <= 0);
    const totalProfit = closed.reduce((s, p) => s + (p.profitUsd || 0), 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + (p.profitPct || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + (p.profitPct || 0), 0) / losses.length : 0;
    return {
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalProfit,
      avgWin,
      avgLoss,
      openPositions: this.getOpenPositions(userId).length,
    };
  }

  // Simulate across all wallet sizes
  getWalletSimulations() {
    return WALLET_SIZES.map(ws => {
      const closed = this.closedPositions.filter(p => p.walletSize === ws);
      const totalProfit = closed.reduce((s, p) => s + (p.profitUsd || 0), 0);
      const winRate = closed.length > 0
        ? (closed.filter(p => (p.profitPct || 0) > 0).length / closed.length) * 100
        : 0;
      return { walletSize: ws, trades: closed.length, totalProfit, winRate };
    });
  }
}

export default new PaperTradingEngine();
