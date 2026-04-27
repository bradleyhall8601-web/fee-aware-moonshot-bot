// src/stability-monitor.ts
// Heartbeat, memory, and lag detection

import telemetryLogger from './telemetry';

export interface StabilityStatus {
  healthy: boolean;
  uptime: number;
  memoryMb: number;
  memoryPct: number;
  lastHeartbeat: number;
  lagMs: number;
  errorRate: number;
  warnings: string[];
}

class StabilityMonitor {
  private lastHeartbeat = Date.now();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private errorCount = 0;
  private cycleCount = 0;
  private readonly MAX_MEMORY_MB = 512;
  private readonly MAX_LAG_MS = 30000;

  start(): void {
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 10000);
    telemetryLogger.info('Stability monitor started', 'stability');
  }

  stop(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  private heartbeat(): void {
    this.lastHeartbeat = Date.now();
    const status = this.getStatus();

    if (!status.healthy) {
      for (const w of status.warnings) {
        telemetryLogger.warn(`[STABILITY] ${w}`, 'stability');
      }
    }
  }

  recordError(): void { this.errorCount++; }
  recordCycle(): void { this.cycleCount++; }

  getStatus(): StabilityStatus {
    const mem = process.memoryUsage();
    const memMb = mem.heapUsed / 1024 / 1024;
    const memPct = (memMb / this.MAX_MEMORY_MB) * 100;
    const lagMs = Date.now() - this.lastHeartbeat;
    const errorRate = this.cycleCount > 0 ? (this.errorCount / this.cycleCount) * 100 : 0;
    const warnings: string[] = [];

    if (memMb > this.MAX_MEMORY_MB * 0.8) warnings.push(`High memory: ${memMb.toFixed(0)}MB`);
    if (lagMs > this.MAX_LAG_MS) warnings.push(`High lag: ${lagMs}ms`);
    if (errorRate > 20) warnings.push(`High error rate: ${errorRate.toFixed(1)}%`);

    return {
      healthy: warnings.length === 0,
      uptime: process.uptime(),
      memoryMb: Math.round(memMb),
      memoryPct: Math.round(memPct),
      lastHeartbeat: this.lastHeartbeat,
      lagMs,
      errorRate,
      warnings,
    };
  }
}

export default new StabilityMonitor();
