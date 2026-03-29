// src/bot-orchestrator.ts
// Main orchestrator for multi-user bot system with AI monitoring

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

  async start(): Promise<void> {
    try {
      telemetryLogger.info('Starting Bot Orchestrator...', 'orchestrator');

      // Initialize all systems
      await this.initializeSystems();

      // Start polling loops
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
    // Initialize API Server
    await apiServer.start();
    telemetryLogger.info('API Server initialized on port 3000', 'orchestrator');

    // Initialize Telegram Bot
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramToken) {
      await telegramBot.initialize(telegramToken);
      telemetryLogger.info('Telegram Bot initialized', 'orchestrator');
    }

    // Initialize AI Monitor
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      await aiMonitor.initialize(telegramBot);
      telemetryLogger.info('AI Monitor initialized', 'orchestrator');
    }

    telemetryLogger.info('All systems initialized', 'orchestrator');
  }

  private startPollingLoop(): void {
    const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);

    this.pollInterval = setInterval(async () => {
      if (this.state.inMaintenance) {
        return;
      }

      try {
        await this.executeTradingCycle();
      } catch (err) {
        telemetryLogger.error('Trading cycle error', 'orchestrator', err);
      }
    }, pollInterval);

    telemetryLogger.info(`Trading polling started (${pollInterval}ms)`, 'orchestrator');
  }

  private startMonitoringLoop(): void {
    // Monitor bot health every 30 seconds
    this.monitorInterval = setInterval(async () => {
      try {
        await aiMonitor.monitorAndAnalyze();
      } catch (err) {
        telemetryLogger.error('Monitoring error', 'orchestrator', err);
      }
    }, 30000);
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute
    this.metricsInterval = setInterval(() => {
      const users = userManager.getAllActiveUsers();
      const trades = Array.from(users)
        .reduce((acc, user) => {
          acc.push(...database.getUserTradingSessions(user.id));
          return acc;
        }, [] as any[]);

      const openTrades = trades.filter(t => t.status === 'open').length;

      telemetryLogger.recordMetrics({
        activeUsers: users.length,
        activeTrades: openTrades,
        totalProfit: trades
          .filter(t => t.status === 'closed')
          .reduce((sum, t) => sum + (t.profit || 0), 0),
      });

      this.state.activeUsers = users.length;
      this.state.activeTrades = openTrades;
      this.state.uptime = process.uptime();
    }, 60000);
  }

  private async executeTradingCycle(): Promise<void> {
    const users = userManager.getAllActiveUsers();

    for (const user of users) {
      const config = userManager.getUserConfig(user.id);
      if (!config) continue;

      // For each user, analyze new opportunities and manage existing trades
      // This is simplified - in production would fetch real market data

      // Find potential moonshot
      const mints = ['EPjFWaJauUf64V8DwYYAstX...', 'TokenMint2', 'TokenMint3']; // Example mints

      for (const mint of mints) {
        const signal = await tradingEngine.analyzeMoonshot(mint);
        if (signal && signal.type === 'BUY') {
          // Execute trade if conditions met
          const success = await tradingEngine.executeBuyTrade(user.id, signal, 1000); // Assume $1000 portfolio

          if (success && config.enableLiveTrading) {
            // Notify user
            const message = `🟢 *BUY SIGNAL*\nToken: ${mint}\nPrice: $${signal.price.toFixed(6)}\nConfidence: ${signal.confidence}%`;
            await telegramBot.sendUserNotification(user.id, message);
          }
        }
      }

      // Manage existing trades
      const prices = new Map<string, number>(); // Would come from real market data
      await tradingEngine.manageTrades(user.id, prices);
    }
  }

  async shutdown(): Promise<void> {
    try {
      telemetryLogger.info('Shutting down Bot Orchestrator..', 'orchestrator');

      this.state.isRunning = false;

      // Stop all intervals
      if (this.pollInterval) clearInterval(this.pollInterval);
      if (this.monitorInterval) clearInterval(this.monitorInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);

      // Shutdown systems
      await telegramBot.shutdown();
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
