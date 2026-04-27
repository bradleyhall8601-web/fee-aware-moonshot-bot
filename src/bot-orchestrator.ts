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
import signalAggregator from './signal-aggregator';
import confidenceScorer from './confidence-scorer';
import adaptiveStrategy from './adaptive-strategy-engine';
import aiSignalEngine from './ai-signal-engine';
import paperTrading from './paper-trading';
import aiSelfImprove from './ai-self-improve';
import winStreakLearner from './win-streak-learner';
import pnlLearning from './pnl-learning';
import failureMemory from './failure-memory';
import coinLearning from './coin-learning';
import cascadeState from './cascade-state';
import stabilityMonitor from './stability-monitor';
import systemHealth from './system-health';
import bossAI from './boss-ai';
import aiSupport from './ai-support';

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
  private cachedCandidates: any[] = [];
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
    // Start stability monitor
    stabilityMonitor.start();

    // Start paper trading engine
    paperTrading.start((pos) => {
      // On paper trade close, record outcomes
      const win = (pos.profitPct || 0) > 0;
      aiSelfImprove.recordResult(win);
      winStreakLearner[win ? 'recordWin' : 'recordLoss']();
      aiSignalEngine.recordOutcome(win);
      pnlLearning.record({
        id: pos.id,
        mint: pos.mint,
        symbol: pos.symbol,
        mode: pos.mode,
        entryPrice: pos.entryPrice,
        exitPrice: pos.exitPrice || pos.entryPrice,
        profitPct: pos.profitPct || 0,
        profitUsd: pos.profitUsd || 0,
        holdTimeMs: (pos.closedAt || Date.now()) - pos.openedAt,
        confidence: 70,
        sources: [],
        closeReason: pos.closeReason || 'unknown',
        timestamp: Date.now(),
      });
      coinLearning.recordTrade(pos.mint, pos.symbol, pos.profitPct || 0, (pos.closedAt || Date.now()) - pos.openedAt, pos.mode, win);
      if (win) {
        telemetryLogger.info(`[PAPER] WIN: ${pos.symbol} +${(pos.profitPct || 0).toFixed(2)}%`, 'orchestrator');
      } else {
        telemetryLogger.info(`[PAPER] LOSS: ${pos.symbol} ${(pos.profitPct || 0).toFixed(2)}%`, 'orchestrator');
        failureMemory.recordFailure({
          mint: pos.mint,
          symbol: pos.symbol,
          reason: pos.closeReason || 'stop_loss',
          confidence: 70,
          liquidity: 0,
          buyPressure: 0,
          ageHours: 0,
          timestamp: Date.now(),
          lossPercent: pos.profitPct,
        });
      }
    });

    // Start AI self-improvement
    aiSelfImprove.start();

    // Load golden params
    winStreakLearner.loadGoldenParams();
    winStreakLearner.setGoldenLockCallback((params) => {
      telemetryLogger.info(`🏆 GOLDEN LOCK: ${JSON.stringify(params)}`, 'orchestrator');
    });

    // Initialize AI engines
    await aiSignalEngine.initialize();
    await bossAI.initialize();
    await aiSupport.initialize();

    // Start API server
    await apiServer.start();
    telemetryLogger.info('API Server initialized', 'orchestrator');

    // Initialize Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramToken) {
      await telegramBot.initialize(telegramToken);
      systemHealth.setServiceStatus('telegram', true);
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
      const paperStats = paperTrading.getStats();
      telemetryLogger.recordMetrics({
        activeUsers: users.length,
        activeTrades: paperStats.openPositions,
        totalProfit: paperStats.totalProfit,
      });
      this.state.activeUsers = users.length;
      this.state.activeTrades = paperStats.openPositions;
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
    const cycle = cascadeState.startCycle();
    stabilityMonitor.recordCycle();

    try {
      // Stage 1: Aggregate signals
      cascadeState.update({ stage: 'aggregating' });
      const signals = await signalAggregator.aggregate();
      cascadeState.update({ candidatesFound: signals.length });
      telemetryLogger.info(`[CYCLE] ${signals.length} signals aggregated`, 'orchestrator');

      if (signals.length === 0) {
        cascadeState.completeCycle();
        return;
      }

      // Stage 2: Score and filter
      cascadeState.update({ stage: 'scoring' });
      let buyCount = 0;
      let skipCount = 0;
      let watchCount = 0;

      for (const signal of signals) {
        // Hard skip rules
        if (signal.liquidity < parseFloat(process.env.MIN_LIQUIDITY_USDC || '10000')) continue;
        if (signal.volume1h < parseFloat(process.env.MIN_VOLUME_1H || '1000')) continue;
        if (!signal.price || signal.price <= 0) continue;
        if (!signal.mint) continue;
        if (signal.rugRisk) continue;
        if (failureMemory.isBlocked(signal.mint)) continue;

        // Score confidence
        const confidence = confidenceScorer.score(signal);

        if (!confidence.sniperPasses) {
          skipCount++;
          continue;
        }

        // Select strategy mode
        const strategy = adaptiveStrategy.selectMode(signal, confidence);
        if (strategy.mode === 'SKIP') {
          skipCount++;
          continue;
        }

        // Stage 3: AI gate
        const aiResult = await aiSignalEngine.evaluate(
          signal,
          confidence,
          strategy.mode,
          aiSignalEngine.getWinRate()
        );

        if (aiResult.decision === 'SKIP') {
          skipCount++;
          continue;
        }

        if (aiResult.decision === 'WATCH') {
          watchCount++;
          continue;
        }

        buyCount++;

        // Log signal to DB
        database.logSignal({
          mint: signal.mint,
          symbol: signal.symbol,
          confidence: confidence.score,
          decision: aiResult.decision,
          mode: strategy.mode,
          sources: signal.sources.join(','),
          price: signal.price,
          liquidity: signal.liquidity,
          buyPressure: signal.buyPressure,
          ageHours: signal.ageHours,
        });

        // Stage 4: Paper trading
        const users = userManager.getAllActiveUsers();
        for (const user of users) {
          try {
            const pos = await paperTrading.openPosition(user.id, signal, strategy);
            if (pos) {
              const msg = `🎯 *${strategy.mode} SIGNAL*\n\n${signal.symbol}\nConf: ${confidence.score}/100\nPrice: $${signal.price.toFixed(8)}\nLiq: $${signal.liquidity.toLocaleString()}\nBP: ${signal.buyPressure.toFixed(0)}%\nAge: ${signal.ageHours.toFixed(1)}h\nSources: ${signal.sources.join(', ')}\n\n${aiResult.reason}`;
              await telegramBot.sendUserNotification(user.id, msg);
            }
          } catch (err) {
            telemetryLogger.error(`Paper trade error for user ${user.id}`, 'orchestrator', err);
          }
        }
      }

      // Update paper positions with current prices
      for (const signal of signals) {
        if (signal.price > 0) {
          paperTrading.updatePrice(signal.mint, signal.price);
        }
      }

      this.state.lastCycleAt = new Date().toISOString();
      this.state.lastCycleSummary = `signals=${signals.length}, buy=${buyCount}, skip=${skipCount}, watch=${watchCount}`;
      systemHealth.setServiceStatus('dex', true);

      telemetryLogger.info(
        `[CYCLE] Complete: signals=${signals.length} buy=${buyCount} skip=${skipCount} watch=${watchCount}`,
        'orchestrator'
      );
    } catch (err) {
      stabilityMonitor.recordError();
      systemHealth.setServiceStatus('dex', false);
      telemetryLogger.error('Trading cycle error', 'orchestrator', err);
    }

    cascadeState.completeCycle();
  }

  async shutdown(): Promise<void> {
    try {
      telemetryLogger.info('Shutting down Bot Orchestrator..', 'orchestrator');
      this.state.isRunning = false;
      if (this.pollInterval) clearInterval(this.pollInterval);
      if (this.monitorInterval) clearInterval(this.monitorInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      paperTrading.stop();
      aiSelfImprove.stop();
      stabilityMonitor.stop();
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
