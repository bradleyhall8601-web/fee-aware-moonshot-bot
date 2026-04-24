// src/database.ts
// Database layer for multi-user bot system

import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'bot.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

interface TradeOutcome {
  mint: string;
  profitPct: number;
  durationMs: number;
  entryConfidence: number;
  timestamp: number;
}

interface User {
  id: string;
  telegramId: string;
  username: string;
  walletAddress: string;
  privateKey: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface UserConfig {
  userId: string;
  minLiquidityUsd: number;
  maxPoolAgeMs: number;
  minTxns: number;
  maxTxns: number;
  profitTargetPct: number;
  trailingStopPct: number;
  enableLiveTrading: boolean;
  tradeSize?: number;
  maxOpenTrades?: number;
  dailyLossCapUsd?: number;
  gasReserveSol?: number;
  maxTradeSizeUsd?: number;
  emergencyStop?: boolean;
  userSuspended?: boolean;
  failureCount?: number;
  createdAt: number;
  updatedAt: number;
}

interface TradingSession {
  id: string;
  userId: string;
  tokenMint: string;
  entryPrice: number;
  entryAmount: number;
  entryTxSig?: string;
  exitPrice?: number;
  exitAmount?: number;
  exitTxSig?: string;
  profit?: number;
  profitPct?: number;
  status: 'open' | 'closed' | 'stopped';
  startedAt: number;
  endedAt?: number;
}

interface ExecutionMetric {
  id: string;
  userId: string;
  tokenMint: string;
  side: 'BUY' | 'SELL';
  success: boolean;
  slippageBps: number;
  durationMs: number;
  createdAt: number;
  reason?: string;
}

interface MaintenanceLog {
  id: string;
  issue: string;
  status: 'started' | 'in-progress' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  estimatedMinutes: number;
  message: string;
  createdAt: number;
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private addColumnIfMissing(table: string, column: string, typeDef: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegramId TEXT UNIQUE,
        username TEXT,
        walletAddress TEXT,
        privateKey TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt INTEGER,
        updatedAt INTEGER
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_configs (
        userId TEXT PRIMARY KEY,
        minLiquidityUsd INTEGER,
        maxPoolAgeMs INTEGER,
        minTxns INTEGER,
        maxTxns INTEGER,
        profitTargetPct INTEGER,
        trailingStopPct INTEGER,
        enableLiveTrading INTEGER DEFAULT 0,
        tradeSize REAL,
        maxOpenTrades INTEGER DEFAULT 3,
        dailyLossCapUsd REAL DEFAULT 100,
        gasReserveSol REAL DEFAULT 0.02,
        maxTradeSizeUsd REAL DEFAULT 50,
        emergencyStop INTEGER DEFAULT 0,
        userSuspended INTEGER DEFAULT 0,
        failureCount INTEGER DEFAULT 0,
        createdAt INTEGER,
        updatedAt INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trading_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT,
        tokenMint TEXT,
        entryPrice REAL,
        entryAmount REAL,
        entryTxSig TEXT,
        exitPrice REAL,
        exitAmount REAL,
        exitTxSig TEXT,
        profit REAL,
        profitPct REAL,
        status TEXT,
        startedAt INTEGER,
        endedAt INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id TEXT PRIMARY KEY,
        issue TEXT,
        status TEXT,
        startTime INTEGER,
        endTime INTEGER,
        estimatedMinutes INTEGER,
        message TEXT,
        createdAt INTEGER
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        userId TEXT,
        totalTrades INTEGER,
        winningTrades INTEGER,
        losingTrades INTEGER,
        totalProfit REAL,
        winRate REAL,
        updatedAt INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_trade_outcomes (
        id TEXT PRIMARY KEY,
        mint TEXT,
        profitPct REAL,
        durationMs INTEGER,
        entryConfidence REAL,
        timestamp INTEGER
      )
    `);


    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_metrics (
        id TEXT PRIMARY KEY,
        userId TEXT,
        tokenMint TEXT,
        side TEXT,
        success INTEGER,
        slippageBps REAL,
        durationMs INTEGER,
        reason TEXT,
        createdAt INTEGER
      )
    `);


    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shadow_strategy_metrics (
        id TEXT PRIMARY KEY,
        userId TEXT,
        tokenMint TEXT,
        primaryScore REAL,
        shadowScore REAL,
        wouldTrade INTEGER,
        timestamp INTEGER
      )
    `);

    // Backward-compatible migrations
    this.addColumnIfMissing('trading_sessions', 'entryTxSig', 'TEXT');
    this.addColumnIfMissing('trading_sessions', 'exitTxSig', 'TEXT');
    this.addColumnIfMissing('user_configs', 'tradeSize', 'REAL');
    this.addColumnIfMissing('user_configs', 'maxOpenTrades', 'INTEGER DEFAULT 3');
    this.addColumnIfMissing('user_configs', 'dailyLossCapUsd', 'REAL DEFAULT 100');
    this.addColumnIfMissing('user_configs', 'gasReserveSol', 'REAL DEFAULT 0.02');
    this.addColumnIfMissing('user_configs', 'maxTradeSizeUsd', 'REAL DEFAULT 50');
    this.addColumnIfMissing('user_configs', 'emergencyStop', 'INTEGER DEFAULT 0');
    this.addColumnIfMissing('user_configs', 'userSuspended', 'INTEGER DEFAULT 0');
    this.addColumnIfMissing('user_configs', 'failureCount', 'INTEGER DEFAULT 0');
  }

  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): User {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, telegramId, username, walletAddress, privateKey, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.telegramId, user.username, user.walletAddress, user.privateKey, user.isActive ? 1 : 0, now, now);
    return { ...user, createdAt: now, updatedAt: now };
  }

  updateUserWallet(userId: string, walletAddress: string, encryptedPrivateKey: string): void {
    const stmt = this.db.prepare('UPDATE users SET walletAddress = ?, privateKey = ?, updatedAt = ? WHERE id = ?');
    stmt.run(walletAddress, encryptedPrivateKey, Date.now(), userId);
  }

  getUserByTelegramId(telegramId: string): User | null {
    return this.db.prepare('SELECT * FROM users WHERE telegramId = ?').get(telegramId) as User | null;
  }

  getUserById(userId: string): User | null {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | null;
  }

  getAllActiveUsers(): User[] {
    return this.db.prepare('SELECT * FROM users WHERE isActive = 1').all() as User[];
  }

  updateUserConfig(config: UserConfig): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_configs
      (userId, minLiquidityUsd, maxPoolAgeMs, minTxns, maxTxns, profitTargetPct, trailingStopPct, enableLiveTrading,
      tradeSize, maxOpenTrades, dailyLossCapUsd, gasReserveSol, maxTradeSizeUsd, emergencyStop, userSuspended, failureCount,
      createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      config.userId,
      config.minLiquidityUsd,
      config.maxPoolAgeMs,
      config.minTxns,
      config.maxTxns,
      config.profitTargetPct,
      config.trailingStopPct,
      config.enableLiveTrading ? 1 : 0,
      config.tradeSize || 25,
      config.maxOpenTrades || 3,
      config.dailyLossCapUsd || 100,
      config.gasReserveSol || 0.02,
      config.maxTradeSizeUsd || 50,
      config.emergencyStop ? 1 : 0,
      config.userSuspended ? 1 : 0,
      config.failureCount || 0,
      config.createdAt || now,
      now
    );
  }

  getUserConfig(userId: string): UserConfig | null {
    const cfg = this.db.prepare('SELECT * FROM user_configs WHERE userId = ?').get(userId) as UserConfig | null;
    if (!cfg) return null;
    cfg.enableLiveTrading = Boolean((cfg as any).enableLiveTrading);
    cfg.emergencyStop = Boolean((cfg as any).emergencyStop);
    cfg.userSuspended = Boolean((cfg as any).userSuspended);
    return cfg;
  }

  incrementUserFailure(userId: string): number {
    const cfg = this.getUserConfig(userId);
    if (!cfg) return 0;
    const next = (cfg.failureCount || 0) + 1;
    this.updateUserConfig({ ...cfg, failureCount: next, userSuspended: next >= 5 });
    return next;
  }

  clearUserFailures(userId: string): void {
    const cfg = this.getUserConfig(userId);
    if (!cfg) return;
    this.updateUserConfig({ ...cfg, failureCount: 0, userSuspended: false });
  }

  createTradingSession(session: Omit<TradingSession, 'id'>): TradingSession {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO trading_sessions
      (id, userId, tokenMint, entryPrice, entryAmount, entryTxSig, status, startedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, session.userId, session.tokenMint, session.entryPrice, session.entryAmount, session.entryTxSig || null, session.status, session.startedAt);
    return { ...session, id };
  }


  updateTradingSessionEntryAmount(id: string, newEntryAmount: number): void {
    this.db.prepare('UPDATE trading_sessions SET entryAmount = ? WHERE id = ? AND status = ?').run(newEntryAmount, id, 'open');
  }

  closeTradingSession(id: string, exitPrice: number, exitAmount: number, profit: number, profitPct: number, exitTxSig?: string): void {
    this.db.prepare(`
      UPDATE trading_sessions
      SET exitPrice = ?, exitAmount = ?, profit = ?, profitPct = ?, status = ?, endedAt = ?, exitTxSig = ?
      WHERE id = ?
    `).run(exitPrice, exitAmount, profit, profitPct, 'closed', Date.now(), exitTxSig || null, id);
  }

  getUserTradingSessions(userId: string): TradingSession[] {
    return this.db.prepare('SELECT * FROM trading_sessions WHERE userId = ? ORDER BY startedAt DESC').all(userId) as TradingSession[];
  }

  getOpenTradingSessionForToken(userId: string, tokenMint: string): TradingSession | null {
    return this.db.prepare('SELECT * FROM trading_sessions WHERE userId = ? AND tokenMint = ? AND status = ? LIMIT 1').get(userId, tokenMint, 'open') as TradingSession | null;
  }

  createMaintenanceLog(log: Omit<MaintenanceLog, 'id' | 'createdAt'>): MaintenanceLog {
    const id = `maint_${Date.now()}`;
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO maintenance_logs (id, issue, status, startTime, estimatedMinutes, message, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, log.issue, log.status, log.startTime, log.estimatedMinutes, log.message, now);
    return { id, ...log, createdAt: now };
  }

  updateMaintenanceStatus(id: string, status: string, message?: string): void {
    this.db.prepare('UPDATE maintenance_logs SET status = ?, message = ? WHERE id = ?').run(status, message || '', id);
  }

  completeMaintenanceLog(id: string): void {
    this.db.prepare('UPDATE maintenance_logs SET status = ?, endTime = ? WHERE id = ?').run('completed', Date.now(), id);
  }

  getLatestMaintenanceLog(): MaintenanceLog | null {
    return this.db.prepare('SELECT * FROM maintenance_logs ORDER BY createdAt DESC LIMIT 1').get() as MaintenanceLog | null;
  }

  updatePerformanceMetrics(userId: string, trades: TradingSession[]): void {
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.profit && t.profit > 0).length;
    const losingTrades = trades.filter((t) => t.profit && t.profit < 0).length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const id = `perf_${userId}`;
    this.db.prepare(`
      INSERT OR REPLACE INTO performance_metrics
      (id, userId, totalTrades, winningTrades, losingTrades, totalProfit, winRate, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, totalTrades, winningTrades, losingTrades, totalProfit, winRate, Date.now());
  }

  getPerformanceMetrics(userId: string) {
    return this.db.prepare('SELECT * FROM performance_metrics WHERE userId = ?').get(userId);
  }

  saveAiTradeOutcome(outcome: TradeOutcome): void {
    const id = `ai_${outcome.timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    this.db.prepare(`
      INSERT INTO ai_trade_outcomes (id, mint, profitPct, durationMs, entryConfidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, outcome.mint, outcome.profitPct, outcome.durationMs, outcome.entryConfidence, outcome.timestamp);
  }

  getRecentAiTradeOutcomes(limit: number): TradeOutcome[] {
    return this.db.prepare(`
      SELECT mint, profitPct, durationMs, entryConfidence, timestamp
      FROM ai_trade_outcomes
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as TradeOutcome[];
  }


  recordExecutionMetric(metric: Omit<ExecutionMetric, 'id' | 'createdAt'>): void {
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.prepare(`
      INSERT INTO execution_metrics
      (id, userId, tokenMint, side, success, slippageBps, durationMs, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      metric.userId,
      metric.tokenMint,
      metric.side,
      metric.success ? 1 : 0,
      metric.slippageBps,
      metric.durationMs,
      metric.reason || '',
      Date.now()
    );
  }

  getExecutionMetricsSummary(userId: string): { successRate: number; failedSwaps: number; averageSlippageBps: number; averageTimeInTradeMs: number } {
    const rows = this.db.prepare('SELECT * FROM execution_metrics WHERE userId = ? ORDER BY createdAt DESC LIMIT 1000').all(userId) as any[];
    if (rows.length === 0) {
      return { successRate: 0, failedSwaps: 0, averageSlippageBps: 0, averageTimeInTradeMs: 0 };
    }

    const success = rows.filter(r => r.success === 1).length;
    const failed = rows.length - success;
    const avgSlip = rows.reduce((a, r) => a + (r.slippageBps || 0), 0) / rows.length;
    const avgDur = rows.reduce((a, r) => a + (r.durationMs || 0), 0) / rows.length;

    return {
      successRate: (success / rows.length) * 100,
      failedSwaps: failed,
      averageSlippageBps: avgSlip,
      averageTimeInTradeMs: avgDur,
    };
  }


  recordShadowStrategyMetric(userId: string, tokenMint: string, primaryScore: number, shadowScore: number, wouldTrade: boolean): void {
    const id = `shadow_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.prepare(`
      INSERT INTO shadow_strategy_metrics (id, userId, tokenMint, primaryScore, shadowScore, wouldTrade, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, tokenMint, primaryScore, shadowScore, wouldTrade ? 1 : 0, Date.now());
  }

  close(): void {
    this.db.close();
  }
}

const database = new DatabaseManager();

export default database;
export { User, UserConfig, TradingSession, MaintenanceLog };
