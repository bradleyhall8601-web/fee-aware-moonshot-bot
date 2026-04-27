// src/system-health.ts
// Overall system health aggregator

import telemetryLogger from './telemetry';
import stabilityMonitor from './stability-monitor';
import database from './database';
import userManager from './user-manager';
import paperTrading from './paper-trading';

export interface SystemHealth {
  ok: boolean;
  timestamp: string;
  uptime: number;
  version: string;
  mode: string;
  stability: any;
  users: { active: number };
  trading: { openPositions: number; totalTrades: number; winRate: number };
  services: {
    database: boolean;
    telegram: boolean;
    dexScreener: boolean;
    openai: boolean;
  };
  warnings: string[];
}

class SystemHealthChecker {
  private telegramOk = false;
  private dexOk = false;
  private openaiOk = false;

  setServiceStatus(service: 'telegram' | 'dex' | 'openai', ok: boolean): void {
    if (service === 'telegram') this.telegramOk = ok;
    if (service === 'dex') this.dexOk = ok;
    if (service === 'openai') this.openaiOk = ok;
  }

  async getHealth(): Promise<SystemHealth> {
    const stability = stabilityMonitor.getStatus();
    const users = userManager.getAllActiveUsers();
    const paperStats = paperTrading.getStats();
    const warnings: string[] = [...stability.warnings];

    let dbOk = true;
    try {
      database.getAllActiveUsers();
    } catch {
      dbOk = false;
      warnings.push('Database error');
    }

    if (!this.telegramOk) warnings.push('Telegram bot not connected');
    if (!this.dexOk) warnings.push('DexScreener not responding');

    return {
      ok: warnings.length === 0,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      mode: process.env.ENABLE_LIVE_TRADING === 'true' ? 'LIVE' : 'PAPER',
      stability,
      users: { active: users.length },
      trading: {
        openPositions: paperStats.openPositions,
        totalTrades: paperStats.totalTrades,
        winRate: paperStats.winRate,
      },
      services: {
        database: dbOk,
        telegram: this.telegramOk,
        dexScreener: this.dexOk,
        openai: this.openaiOk,
      },
      warnings,
    };
  }
}

export default new SystemHealthChecker();
