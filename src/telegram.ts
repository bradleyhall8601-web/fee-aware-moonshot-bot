// src/telegram.ts
// Telegram Bot Integration Module

import { Telegraf, Context } from "telegraf";

interface TelegramConfig {
  token: string;
  chatId: string;
}

class TelegramBot {
  private bot: Telegraf<Context> | null = null;
  private config: TelegramConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize the Telegram bot
   */
  async initialize(token: string, chatId: string): Promise<void> {
    if (!token || !chatId) {
      console.warn("[telegram] Bot token or chat ID missing. Telegram notifications disabled.");
      return;
    }

    try {
      this.config = { token, chatId };
      this.bot = new Telegraf(token);

      // Set up command handlers
      this.bot.command("status", this.handleStatusCommand.bind(this));
      this.bot.command("start", this.handleStartCommand.bind(this));
      this.bot.command("stop", this.handleStopCommand.bind(this));
      this.bot.command("help", this.handleHelpCommand.bind(this));

      // Launch bot
      await this.bot.launch();
      this.isInitialized = true;
      console.log("[telegram] Bot initialized successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[telegram] Failed to initialize: ${msg}`);
    }
  }

  /**
   * Send a message to the configured chat
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.isInitialized || !this.bot || !this.config) {
      return;
    }

    try {
      await this.bot.telegram.sendMessage(this.config.chatId, message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[telegram] Failed to send message: ${msg}`);
    }
  }

  /**
   * Send trading alert
   */
  async sendTradingAlert(alert: {
    type: "BUY" | "SELL" | "STOPLOSS" | "ERROR";
    mint: string;
    price: number;
    amount: number;
    profit?: number;
  }): Promise<void> {
    const emoji = {
      BUY: "🟢",
      SELL: "🔴",
      STOPLOSS: "⚠️",
      ERROR: "❌",
    }[alert.type];

    const message = `${emoji} *${alert.type}*
Mint: \`${alert.mint}\`
Price: $${alert.price.toFixed(6)}
Amount: ${alert.amount.toFixed(4)}
${alert.profit !== undefined ? `Profit: ${alert.profit > 0 ? "+" : ""}${alert.profit.toFixed(2)}%\n` : ""}
Time: ${new Date().toISOString()}`;

    await this.sendMessage(message);
  }

  /**
   * Send status update
   */
  async sendStatus(status: {
    mode: string;
    balances: number;
    orders: number;
    profit?: number;
  }): Promise<void> {
    const message = `📊 *Bot Status*
Mode: ${status.mode}
Balances Tracked: ${status.balances}
Active Orders: ${status.orders}
${status.profit !== undefined ? `Total Profit: ${status.profit > 0 ? "+" : ""}${status.profit.toFixed(2)}%\n` : ""}
Updated: ${new Date().toISOString()}`;

    await this.sendMessage(message);
  }

  /**
   * Command handlers
   */
  private async handleStatusCommand(ctx: Context): Promise<void> {
    const message = "📊 Bot Status Request received. (Status feature not yet implemented)";
    await ctx.reply(message);
  }

  private async handleStartCommand(ctx: Context): Promise<void> {
    const message = "🟢 Bot Start Command received.\n(Real-time control not yet implemented - bot runs continuously)";
    await ctx.reply(message);
  }

  private async handleStopCommand(ctx: Context): Promise<void> {
    const message = "🔴 Bot Stop Command received.\n(Real-time control not yet implemented - use ENABLE_LIVE_TRADING env var)";
    await ctx.reply(message);
  }

  private async handleHelpCommand(ctx: Context): Promise<void> {
    const message = `ℹ️ *Fee-Aware Moonshot Bot Commands*

/status - Get current bot status
/start - Start trading (manual trigger)
/stop - Stop trading safely
/help - Show this help message

Status: The bot is currently running in ${process.env.ENABLE_LIVE_TRADING === "true" ? "LIVE" : "PAPER"} mode.`;

    await ctx.reply(message);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized && this.bot) {
      try {
        await this.bot.stop();
        console.log("[telegram] Bot stopped");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[telegram] Error during shutdown: ${msg}`);
      }
    }
  }
}

// Singleton instance
const telegramBot = new TelegramBot();

export default telegramBot;
