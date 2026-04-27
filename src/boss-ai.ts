// src/boss-ai.ts
// Owner natural language command processor

import telemetryLogger from './telemetry';
import database from './database';
import userManager from './user-manager';
import paperTrading from './paper-trading';
import aiSelfImprove from './ai-self-improve';
import confidenceScorer from './confidence-scorer';

export interface BossCommand {
  input: string;
  userId: string;
  isOwner: boolean;
  response: string;
  timestamp: number;
}

class BossAI {
  private openai: any = null;
  private commandHistory: BossCommand[] = [];

  async initialize(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) return;
    try {
      const { default: OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      telemetryLogger.info('Boss AI initialized', 'boss-ai');
    } catch {
      telemetryLogger.warn('Boss AI: OpenAI init failed', 'boss-ai');
    }
  }

  async processCommand(input: string, userId: string, isOwner: boolean): Promise<string> {
    const lower = input.toLowerCase().trim();

    // Built-in commands (no AI needed)
    if (lower.includes('status') || lower.includes('how is the bot')) {
      return this.getSystemStatus();
    }
    if (lower.includes('users') || lower.includes('show users')) {
      return this.getUserList();
    }
    if (lower.includes('performance') || lower.includes('win rate')) {
      return this.getPerformance();
    }
    if (lower.includes('strategy') || lower.includes('current mode')) {
      return this.getStrategy();
    }
    if (lower.includes('recent trades') || lower.includes('last trades')) {
      return this.getRecentTrades();
    }
    if (lower.includes('threshold') || lower.includes('confidence')) {
      return `Current confidence threshold: ${confidenceScorer.getThreshold()}\nWeights: ${JSON.stringify(confidenceScorer.getWeights(), null, 2)}`;
    }
    if (lower.includes('learning') || lower.includes('self improve')) {
      const stats = aiSelfImprove.getStats();
      return `AI Learning Stats:\n${JSON.stringify(stats, null, 2)}`;
    }

    // AI-powered response
    if (this.openai) {
      return this.aiResponse(input, isOwner);
    }

    return `I understand you're asking about: "${input}"\n\nAvailable commands: status, users, performance, strategy, recent trades, threshold, learning`;
  }

  private async aiResponse(input: string, isOwner: boolean): Promise<string> {
    try {
      const context = this.getSystemStatus();
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are Boss AI, the intelligent assistant for MoonShotForge trading bot. 
You help the ${isOwner ? 'owner' : 'admin'} manage the bot.
Never expose API keys, private keys, or secrets.
Current system context: ${context}`,
          },
          { role: 'user', content: input },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });
      return response.choices[0]?.message?.content || 'No response generated';
    } catch {
      return 'AI response unavailable. Use built-in commands: status, users, performance, strategy';
    }
  }

  private getSystemStatus(): string {
    const users = userManager.getAllActiveUsers();
    const paperStats = paperTrading.getStats();
    const learnStats = aiSelfImprove.getStats();
    return `🤖 MoonShotForge Status
Users: ${users.length} active
Paper Trades: ${paperStats.totalTrades} total, ${paperStats.winRate.toFixed(1)}% win rate
Open Positions: ${paperStats.openPositions}
Confidence Threshold: ${confidenceScorer.getThreshold()}
Consecutive Wins: ${learnStats.consecutiveWins}
Consecutive Losses: ${learnStats.consecutiveLosses}
Live Trading: ${process.env.ENABLE_LIVE_TRADING === 'true' ? '🟢 ENABLED' : '🔴 DISABLED'}`;
  }

  private getUserList(): string {
    const users = userManager.getAllActiveUsers();
    if (users.length === 0) return 'No active users';
    return `👥 Active Users (${users.length}):\n` +
      users.map(u => `• ${u.username} (${u.telegramId})`).join('\n');
  }

  private getPerformance(): string {
    const stats = paperTrading.getStats();
    return `📊 Performance
Total Trades: ${stats.totalTrades}
Win Rate: ${stats.winRate.toFixed(1)}%
Total Profit: $${stats.totalProfit.toFixed(2)}
Avg Win: +${stats.avgWin.toFixed(1)}%
Avg Loss: ${stats.avgLoss.toFixed(1)}%`;
  }

  private getStrategy(): string {
    const threshold = confidenceScorer.getThreshold();
    return `🎯 Current Strategy
Confidence Threshold: ${threshold}
Sniper Threshold: ${threshold - 10}
Modes: SNIPER (age<5h, bp≥50%), AGGRESSIVE_SCALP (bp 50-59%), HIGH_CONFIDENCE (bp≥60%)`;
  }

  private getRecentTrades(): string {
    const closed = paperTrading.getClosedPositions(undefined, 5);
    if (closed.length === 0) return 'No recent trades';
    return '📈 Recent Trades:\n' + closed.map(p =>
      `• ${p.symbol}: ${(p.profitPct || 0) >= 0 ? '+' : ''}${(p.profitPct || 0).toFixed(1)}% (${p.closeReason})`
    ).join('\n');
  }

  getHistory(): BossCommand[] {
    return this.commandHistory.slice(-20);
  }
}

export default new BossAI();
