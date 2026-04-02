import * as dotenv from 'dotenv';
dotenv.config();

import database from './database';
import userManager from './user-manager';
import telemetryLogger from './telemetry';
import aiMonitor from './ai-monitor';
import telegramBot from './telegram-multi';
import tradingEngine from './trading-engine';
import apiServer from './api-server';
import dexMarketData from './dex-market-data';

interface BotState {
  isRunning: boolean;
  inMaintenance: boolean;
  activeUsers: number;
  activeTrades: number;
  uptime: number;
  lastCycleAt?: string;
  lastCycleSummary?: string;
}

class BotOrchestrator {
  private state: BotState = {
    isRunning: false,
    inMaintenance: false,
    activeUsers: 0,
    activeTrades: 0,
    uptime: 0,
  };

  private pollInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private cachedCandidates: Awaited<ReturnType<typeof dexMarketData.getMoonshotCandidates>> = [];
  private lastCandidateFetchAt = 0;
  private readonly candidateRefreshMs = parseInt(process.env.CANDIDATE_REFRESH_MS || '15000', 10);

  async start(): Promise<void> {
    try {
      telemetryLogger.info('Starting Bot Orchestrator...', 'orchestrator');
      await this.initializeSystems();
      this.startPollingLoop();
      this.startMonitoringLoop();
      this.startMetricsCollection();
      this.state.isRunning = true;
      telemetryLogger.info('Bot Orchestrator started successfully', 'orchestrator');
    } catch (err) {
      telemetryLogger.error('Failed to start Bot Orchestrator', 'orchestrator', err);
      await this.shutdown();
      process.exit(1);
    }
  }

  private async initializeSystems(): Promise<void> {
    await apiServer.start();
    telemetryLogger.info('API Server initialized', 'orchestrator');
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramToken) {
      await telegramBot.initialize(telegramToken);
      telemetryLogger.info('Telegram Bot initialized', 'orchestrator');
    } else {
      telemetryLogger.warn('Telegram token missing, bot notifications disabled', 'orchestrator');
    }
    telemetryLogger.info('All systems initialized', 'orchestrator');
  }

  private startPollingLoop(): void {
    const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
    this.pollInterval = setInterval(async () => {
      if (this.state.inMaintenance) return;
      try {
        await this.executeTradingCycle();
      } catch (err) {
        telemetryLogger.error('Trading cycle error', 'orchestrator', err);
      }
    }, pollInterval);
    telemetryLogger.info(`Trading polling started (${pollInterval}ms)`, 'orchestrator');
  }

  private startMonitoringLoop(): void {
    this.monitorInterval = setInterval(async () => {
      try {
        if (process.env.ENABLE_AI_MONITOR === 'true') {
          await aiMonitor.monitorAndAnalyze();
        }
      } catch (err) {
        telemetryLogger.error('Monitoring error', 'orchestrator', err);
      }
    }, 30000);
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const users = userManager.getAllActiveUsers();
      const trades = users.flatMap(user => database.getUserTradingSessions(user.id));
      const openTrades = trades.filter(t => t.status === 'open').length;
      telemetryLogger.recordMetrics({
        activeUsers: users.length,
        activeTrades: openTrades,
        totalProfit: trades.filter(t => t.status === 'closed').reduce((sum, t) => sum + (t.profit || 0), 0),
      });
      this.state.activeUsers = users.length;
      this.state.activeTrades = openTrades;
      this.state.uptime = process.uptime();
    }, 60000);
  }

  private async getFreshCandidates() {
    const now = Date.now();
    if (this.cachedCandidates.length > 0 && now - this.lastCandidateFetchAt < this.candidateRefreshMs) {
      return this.cachedCandidates;
    }
    this.cachedCandidates = await dexMarketData.getMoonshotCandidates();
    this.lastCandidateFetchAt = now;
    return this.cachedCandidates;
  }

  private async executeTradingCycle(): Promise<void> {
    const users = userManager.getAllActiveUsers();
    const candidates = await this.getFreshCandidates();
    const candidatePrices = new Map<string, number>();
    candidates.forEach(candidate => candidatePrices.set(candidate.mint, candidate.price));
    let buySignalsSent = 0;
    for (const user of users) {
      try {
        const config = userManager.getUserConfig(user.id);
        if (!config) continue;
        await tradingEngine.manageTrades(user.id, candidatePrices);
        const refreshedOpenTrades = database.getUserTradingSessions(user.id).filter(session => session.status === 'open');
        if (refreshedOpenTrades.length >= 3) {
          telemetryLogger.info(`Skipping new entries for ${user.username}, max open trades reached`, 'orchestrator');
          continue;
        }
        const availableSlots = Math.max(0, 3 - refreshedOpenTrades.length);
        const blockedMints = new Set(refreshedOpenTrades.map(trade => trade.tokenMint));
        const topCandidates = candidates.filter(candidate => candidate.confidence >= 70 && !blockedMints.has(candidate.mint)).slice(0, availableSlots);
        for (const candidate of topCandidates) {
          const signal = await tradingEngine.analyzeMoonshot(candidate.mint, candidate);
          if (!signal || signal.type !== 'BUY') continue;
          const success = await tradingEngine.executeBuyTrade(user.id, signal, (config.tradeSize as number) || 30);
          if (success) {
            buySignalsSent += 1;
            const modeLabel = config.enableLiveTrading ? 'LIVE' : 'PAPER';
            const message = `${modeLabel} BUY SIGNAL\nToken: ${candidate.name} (${candidate.symbol})\nPrice: ${candidate.price.toFixed(8)}\nLiquidity: ${candidate.liquidity.toLocaleString()}\n24h Volume: ${candidate.volume24h.toLocaleString()}\nConfidence: ${candidate.confidence}%`;
            await telegramBot.sendUserNotification(user.id, message);
          }
        }
      } catch (error) {
        telemetryLogger.error(`Trade cycle error for user ${user.id}: ${error}`, 'orchestrator');
      }
    }
    this.state.lastCycleAt = new Date().toISOString();
    this.state.lastCycleSummary = `users=${users.length}, candidates=${candidates.length}, buySignals=${buySignalsSent}`;
  }

  async shutdown(): Promise<void> {
    try {
      telemetryLogger.info('Shutting down Bot Orchestrator..', 'orchestrator');
      this.state.isRunning = false;
      if (this.pollInterval) clearInterval(this.pollInterval);
      if (this.monitorInterval) clearInterval(this.monitorInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      await telegramBot.shutdown();
      await apiServer.stop();
      telemetryLogger.flushLogs();
      database.close();
      telemetryLogger.info('Bot Orchestrator shut down successfully', 'orchestrator');
      process.exit(0);
    } catch (err) {
      telemetryLogger.error('Error during shutdown', 'orchestrator', err);
      process.exit(1);
    }
  }

  getStatus(): BotState {
    return this.state;
  }
}

export default new BotOrchestrator();
