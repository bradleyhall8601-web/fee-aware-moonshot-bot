// src/command-registry.ts
// Command tracking and registry for Telegram bot

interface CommandRecord {
  command: string;
  userId: string;
  username: string;
  timestamp: number;
  success: boolean;
  responseMs?: number;
}

interface CommandStats {
  command: string;
  totalCalls: number;
  successRate: number;
  avgResponseMs: number;
  lastUsed: number;
}

class CommandRegistry {
  private records: CommandRecord[] = [];
  private maxRecords = 1000;

  record(command: string, userId: string, username: string, success: boolean, responseMs?: number): void {
    this.records.push({
      command,
      userId,
      username,
      timestamp: Date.now(),
      success,
      responseMs,
    });
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  getStats(): CommandStats[] {
    const map = new Map<string, CommandRecord[]>();
    for (const r of this.records) {
      if (!map.has(r.command)) map.set(r.command, []);
      map.get(r.command)!.push(r);
    }
    const stats: CommandStats[] = [];
    for (const [cmd, recs] of map) {
      const successes = recs.filter(r => r.success).length;
      const withMs = recs.filter(r => r.responseMs !== undefined);
      stats.push({
        command: cmd,
        totalCalls: recs.length,
        successRate: recs.length > 0 ? (successes / recs.length) * 100 : 0,
        avgResponseMs: withMs.length > 0 ? withMs.reduce((s, r) => s + (r.responseMs || 0), 0) / withMs.length : 0,
        lastUsed: Math.max(...recs.map(r => r.timestamp)),
      });
    }
    return stats.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  getRecentCommands(limit = 50): CommandRecord[] {
    return this.records.slice(-limit).reverse();
  }

  getAllCommands(): string[] {
    return [
      '/start', '/help', '/status', '/signals', '/positions', '/trades',
      '/wallet', '/mode', '/paper', '/live', '/join', '/pay', '/subscribe',
      '/support', '/settings', '/admin', '/users', '/logs', '/performance',
      '/kill', '/resume', '/broadcast', '/approve', '/deny', '/grant',
      '/revoke', '/ai', '/health', '/debug',
    ];
  }
}

export default new CommandRegistry();
