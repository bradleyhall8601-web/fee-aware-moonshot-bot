// src/telemetry.ts
// Centralized logging and telemetry for monitoring

import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  module: string;
  message: string;
  data?: any;
}

interface SystemMetrics {
  timestamp: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeUsers: number;
  activeTrades: number;
  totalProfit: number;
  errors: number;
  warnings: number;
}

class TelemetryLogger {
  private logDir = path.join(process.cwd(), 'logs');
  private currentLogFile: string;
  private logBuffer: LogEntry[] = [];
  private metrics: SystemMetrics[] = [];
  private errorCount = 0;
  private warningCount = 0;

  constructor() {
    this.ensureLogDirectory();
    this.currentLogFile = this.getLogFilePath();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `bot-${date}.log`);
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  info(message: string, module: string = 'app', data?: any): void {
    this.log('info', module, message, data);
  }

  warn(message: string, module: string = 'app', data?: any): void {
    this.warningCount++;
    this.log('warn', module, message, data);
  }

  error(message: string, module: string = 'app', data?: any): void {
    this.errorCount++;
    this.log('error', module, message, data);
  }

  debug(message: string, module: string = 'app', data?: any): void {
    if (process.env.DEBUG === 'true') {
      this.log('debug', module, message, data);
    }
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', module: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
    };

    this.logBuffer.push(entry);
    console.log(`[${entry.timestamp}] ${level.toUpperCase()} [${module}] ${message}${data ? ` ${JSON.stringify(data)}` : ''}`);

    // Flush buffer periodically
    if (this.logBuffer.length >= 10) {
      this.flushLogs();
    }
  }

  flushLogs(): void {
    if (this.logBuffer.length === 0) return;

    try {
      const logs = this.logBuffer.map(e => this.formatLog(e)).join('\n');
      fs.appendFileSync(this.currentLogFile, logs + '\n');
      this.logBuffer = [];
    } catch (err) {
      console.error('Failed to flush logs:', err);
    }
  }

  recordMetrics(metrics: Partial<SystemMetrics>): void {
    const fullMetrics: SystemMetrics = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeUsers: 0, // Will be updated by monitoring agent
      activeTrades: 0, // Will be updated by monitoring agent
      totalProfit: 0, // Will be updated by monitoring agent
      errors: this.errorCount,
      warnings: this.warningCount,
      ...metrics,
    };

    this.metrics.push(fullMetrics);

    // Keep last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  getRecentMetrics(minutes: number = 5): SystemMetrics[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getWarningCount(): number {
    return this.warningCount;
  }

  resetErrorCounts(): void {
    this.errorCount = 0;
    this.warningCount = 0;
  }

  getLogsForAnalysis(lines: number = 100): string {
    try {
      const data = fs.readFileSync(this.currentLogFile, 'utf-8');
      return data.split('\n').slice(-lines).join('\n');
    } catch (err) {
      return '';
    }
  }
}

export default new TelemetryLogger();
