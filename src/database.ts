// src/database.ts
// Database layer for multi-user bot system

import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'bot.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

interface User {
  id: string;
  telegramId: string;
  username: string;
  walletAddress: string;
  privateKey: string; // Encrypted in production
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
  createdAt: number;
  updatedAt: number;
}

interface TradingSession {
  id: string;
  userId: string;
  tokenMint: string;
  entryPrice: number;
  entryAmount: number;
  exitPrice?: number;
  exitAmount?: number;
  profit?: number;
  profitPct?: number;
  status: 'open' | 'closed' | 'stopped';
  startedAt: number;
  endedAt?: number;
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

  private initializeSchema(): void {
    // Users table
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

    // User configurations
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
        createdAt INTEGER,
        updatedAt INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    // Trading sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trading_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT,
        tokenMint TEXT,
        entryPrice REAL,
        entryAmount REAL,
        exitPrice REAL,
        exitAmount REAL,
        profit REAL,
        profitPct REAL,
        status TEXT,
        startedAt INTEGER,
        endedAt INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    // Maintenance logs
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

    // Performance metrics
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
  }

  // User operations
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): User {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, telegramId, username, walletAddress, privateKey, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.telegramId, user.username, user.walletAddress, user.privateKey, user.isActive ? 1 : 0, now, now);
    return { ...user, createdAt: now, updatedAt: now };
  }

  getUserByTelegramId(telegramId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE telegramId = ?');
    return stmt.get(telegramId) as User | null;
  }

  getUserById(userId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as User | null;
  }

  getAllActiveUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE isActive = 1');
    return stmt.all() as User[];
  }

  updateUserConfig(config: UserConfig): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_configs 
      (userId, minLiquidityUsd, maxPoolAgeMs, minTxns, maxTxns, profitTargetPct, trailingStopPct, enableLiveTrading, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(config.userId, config.minLiquidityUsd, config.maxPoolAgeMs, config.minTxns, config.maxTxns, 
             config.profitTargetPct, config.trailingStopPct, config.enableLiveTrading ? 1 : 0,
             config.createdAt || now, now);
  }

  getUserConfig(userId: string): UserConfig | null {
    const stmt = this.db.prepare('SELECT * FROM user_configs WHERE userId = ?');
    return stmt.get(userId) as UserConfig | null;
  }

  // Trading session operations
  createTradingSession(session: Omit<TradingSession, 'id'>): TradingSession {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO trading_sessions 
      (id, userId, tokenMint, entryPrice, entryAmount, status, startedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, session.userId, session.tokenMint, session.entryPrice, session.entryAmount, 'open', session.startedAt);
    return { id, ...session };
  }

  closeTradingSession(id: string, exitPrice: number, exitAmount: number, profit: number, profitPct: number): void {
    const stmt = this.db.prepare(`
      UPDATE trading_sessions 
      SET exitPrice = ?, exitAmount = ?, profit = ?, profitPct = ?, status = ?, endedAt = ?
      WHERE id = ?
    `);
    stmt.run(exitPrice, exitAmount, profit, profitPct, 'closed', Date.now(), id);
  }

  getUserTradingSessions(userId: string): TradingSession[] {
    const stmt = this.db.prepare('SELECT * FROM trading_sessions WHERE userId = ? ORDER BY startedAt DESC');
    return stmt.all(userId) as TradingSession[];
  }

  // Maintenance logs
  createMaintenanceLog(log: Omit<MaintenanceLog, 'id' | 'createdAt'>): MaintenanceLog {
    const id = `maint_${Date.now()}`;
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO maintenance_logs (id, issue, status, startTime, estimatedMinutes, message, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, log.issue, log.status, log.startTime, log.estimatedMinutes, log.message, now);
    return { id, ...log, createdAt: now };
  }

  updateMaintenanceStatus(id: string, status: string, message?: string): void {
    const stmt = this.db.prepare('UPDATE maintenance_logs SET status = ?, message = ? WHERE id = ?');
    stmt.run(status, message || '', id);
  }

  completeMaintenanceLog(id: string): void {
    const stmt = this.db.prepare('UPDATE maintenance_logs SET status = ?, endTime = ? WHERE id = ?');
    stmt.run('completed', Date.now(), id);
  }

  getLatestMaintenanceLog(): MaintenanceLog | null {
    const stmt = this.db.prepare('SELECT * FROM maintenance_logs ORDER BY createdAt DESC LIMIT 1');
    return stmt.get() as MaintenanceLog | null;
  }

  // Performance metrics
  updatePerformanceMetrics(userId: string, trades: TradingSession[]): void {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.profit && t.profit > 0).length;
    const losingTrades = trades.filter(t => t.profit && t.profit < 0).length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const id = `perf_${userId}`;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO performance_metrics 
      (id, userId, totalTrades, winningTrades, losingTrades, totalProfit, winRate, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, totalTrades, winningTrades, losingTrades, totalProfit, winRate, Date.now());
  }

  getPerformanceMetrics(userId: string) {
    const stmt = this.db.prepare('SELECT * FROM performance_metrics WHERE userId = ?');
    return stmt.get(userId);
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
const database = new DatabaseManager();

export default database;
export { User, UserConfig, TradingSession, MaintenanceLog };
