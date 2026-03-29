// src/telegram-debug.ts
// Debug logging for Telegram bot activity

interface TelegramDebugLog {
  timestamp: string;
  type: 'message' | 'callback' | 'command' | 'error';
  userId: string;
  username: string;
  action: string;
  details?: any;
}

class TelegramDebugger {
  private logs: TelegramDebugLog[] = [];
  private maxLogs = 200;

  log(type: 'message' | 'callback' | 'command' | 'error', userId: string, username: string, action: string, details?: any): void {
    const logEntry: TelegramDebugLog = {
      timestamp: new Date().toISOString(),
      type,
      userId,
      username,
      action,
      details,
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console with emojis
    const icon = {
      message: '💬',
      callback: '🔘',
      command: '⚡',
      error: '❌',
    }[type];

    console.log(`${icon} [TELEGRAM DEBUG] @${username} (${userId}): ${action}`);
    if (details) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }

  getMessage(type: 'message' | 'callback' | 'command' | 'error', userId: string, text: string): void {
    this.log(type, userId, 'unknown', text);
  }

  getRecentLogs(limit: number = 50): TelegramDebugLog[] {
    return this.logs.slice(-limit);
  }

  getAllLogs(): TelegramDebugLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    console.log('🔄 [TELEGRAM DEBUG] Logs cleared');
  }

  getStats(): any {
    const stats = {
      totalLogs: this.logs.length,
      byType: {
        message: this.logs.filter(l => l.type === 'message').length,
        callback: this.logs.filter(l => l.type === 'callback').length,
        command: this.logs.filter(l => l.type === 'command').length,
        error: this.logs.filter(l => l.type === 'error').length,
      },
      uniqueUsers: new Set(this.logs.map(l => l.userId)).size,
      lastLog: this.logs[this.logs.length - 1]?.timestamp,
    };
    return stats;
  }
}

export default new TelegramDebugger();
