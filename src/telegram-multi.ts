// src/telegram-multi.ts
// Multi-user Telegram Bot with registration and management

import { Telegraf, Context, Markup } from 'telegraf';
import userManager from './user-manager.js';
import database from './database.js';
import telemetryLogger from './telemetry.js';
import registrationFlow from './telegram-registration.js';
import telegramDebug from './telegram-debug.js';

interface TelegramConfig {
  token: string;
}

interface UserSession {
  state: 'idle' | 'registering_wallet' | 'registering_key' | 'settings';
  walletAddress?: string;
  privateKey?: string;
}

class MultiUserTelegramBot {
  private bot: Telegraf<Context> | null = null;
  private userSessions: Map<string, UserSession> = new Map();
  private allUsers: Map<string, string> = new Map(); // telegramId -> userId mapping

  async initialize(token: string): Promise<void> {
    if (!token) {
      telemetryLogger.warn('Telegram bot token not provided', 'telegram-multi');
      console.log('❌ [TELEGRAM] No bot token provided');
      return;
    }

    try {
      console.log('🔧 [TELEGRAM] Initializing with token:', token.slice(0, 10) + '...');
      this.bot = new Telegraf(token);

      // Add debug middleware to log all updates
      this.bot.use((ctx, next) => {
        const updateType = ctx.updateType;
        const userId = ctx.from?.id;
        const username = ctx.from?.username || 'unknown';
        
        console.log(`📨 [TELEGRAM] Update from @${username} (${userId}): ${updateType}`);
        telegramDebug.log('message', String(userId), username, `${updateType} update received`);
        
        if ('text' in (ctx.message || {})) {
          const text = (ctx.message as any).text;
          console.log(`   Message: ${text.substring(0, 50)}`);
          telegramDebug.log('message', String(userId), username, `Text: ${text.substring(0, 100)}`);
        } else if ((ctx.callbackQuery as any)?.data) {
          const data = (ctx.callbackQuery as any).data;
          console.log(`   Callback: ${data}`);
          telegramDebug.log('callback', String(userId), username, `Callback: ${data}`);
        }
        
        return next();
      });

      // Setup command handlers
      this.bot.start((ctx) => {
        console.log(`✅ [TELEGRAM] Start command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleStart.call(this, ctx);
      });
      this.bot.command('register', (ctx) => {
        console.log(`📝 [TELEGRAM] Register command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleRegister.call(this, ctx);
      });
      this.bot.command('status', (ctx) => {
        console.log(`📊 [TELEGRAM] Status command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleStatus.call(this, ctx);
      });
      this.bot.command('config', (ctx) => {
        console.log(`⚙️ [TELEGRAM] Config command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleConfig.call(this, ctx);
      });
      this.bot.command('trades', (ctx) => {
        console.log(`📈 [TELEGRAM] Trades command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleTrades.call(this, ctx);
      });
      this.bot.command('help', (ctx) => {
        console.log(`❓ [TELEGRAM] Help command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleHelp.call(this, ctx);
      });
      this.bot.command('stop', (ctx) => {
        console.log(`🛑 [TELEGRAM] Stop command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleStopTrading.call(this, ctx);
      });
      this.bot.command('start_trading', (ctx) => {
        console.log(`🚀 [TELEGRAM] Start trading command from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleStartTrading.call(this, ctx);
      });

      // Handle text messages for registration flow
      this.bot.on('text', (ctx) => {
        console.log(`💬 [TELEGRAM] Text message from @${ctx.from?.username} (${ctx.from?.id})`);
        return this.handleTextInput.call(this, ctx);
      });

      // Handle callbacks - MUST be after on('text')
      this.bot.on('callback_query', (ctx) => {
        console.log(`🔘 [TELEGRAM] Callback from @${ctx.from?.username} (${ctx.from?.id}): ${(ctx.callbackQuery as any)?.data}`);
        return this.handleCallback.call(this, ctx);
      });

      // Add error handler
      this.bot.catch((err, ctx) => {
        console.error(`❌ [TELEGRAM ERROR] Message handling error:`, err);
        console.error(`   From: @${ctx.from?.username} (${ctx.from?.id})`);
        telemetryLogger.error('Telegram handler error', 'telegram-multi', err);
      });

      console.log('🚀 [TELEGRAM] Launching bot...');
      // Launch the bot with timeout to allow localhost/API access
      let launchSucceeded = false;
      const launchPromise = this.bot.launch()
        .then(() => {
          launchSucceeded = true;
          console.log('✅ [TELEGRAM] Bot successfully launched and polling!');
        })
        .catch(err => {
          console.error('❌ [TELEGRAM] Failed to launch:', err);
          telemetryLogger.error(`Telegram bot launch failed: ${err}`, 'telegram-multi', err);
        });

      // Don't wait infinitely - resolve after 5 seconds if launch is still pending
      await Promise.race([
        launchPromise,
        new Promise(resolve => {
          setTimeout(() => {
            if (!launchSucceeded) {
              console.log('⏱️ [TELEGRAM] Launch taking longer than expected, continuing anyway...');
            }
            resolve(undefined);
          }, 5000);
        })
      ]);

      telemetryLogger.info('Multi-user Telegram bot initialized', 'telegram-multi');

      // Load existing users
      const users = database.getAllActiveUsers();
      users.forEach(u => {
        this.allUsers.set(u.telegramId, u.id);
      });
      console.log(`✅ [TELEGRAM] Bot ready. Loaded ${users.length} existing users`);
    } catch (err) {
      console.error('❌ [TELEGRAM INIT ERROR]', err);
      telemetryLogger.error('Failed to initialize Telegram bot', 'telegram-multi', err);
    }
  }

  private async handleStart(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const username = ctx.from?.username || 'unknown';
    console.log(`[START] Processing /start for user ${telegramId}`);
    telegramDebug.log('command', telegramId, username, '/start');
    
    const existingUser = userManager.getUserByTelegramId(telegramId);

    if (existingUser) {
      console.log(`[START] User already registered: ${existingUser.username}`);
      telegramDebug.log('command', telegramId, username, `Start - User already registered: ${existingUser.username}`);
      await ctx.reply(`👋 Welcome back, ${existingUser.username}!

Use /help to see available commands.`);
    } else {
      console.log(`[START] New user, showing registration prompt`);
      telegramDebug.log('command', telegramId, username, 'Start - New user, showing registration');
      await ctx.reply(`🤖 Welcome to Fee-Aware Moonshot Bot!

This is a multi-user Solana trading bot with AI monitoring.

To get started, use /register to set up your wallet.`, 
      Markup.inlineKeyboard([
        Markup.button.callback('Register Now', 'register_start'),
        Markup.button.callback('Help', 'show_help'),
      ]));
    }
  }

  private async handleRegister(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const existingUser = userManager.getUserByTelegramId(telegramId);

    if (existingUser) {
      await ctx.reply('❌ You are already registered!');
      return;
    }

    await registrationFlow.startRegistration(ctx);
  }

  private async handleTextInput(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    
    // Type guard for text messages
    if (!('text' in ctx.message! || {})) {
      console.log(`[TEXT] Skipping non-text message from ${telegramId}`);
      return;
    }
    
    const text = (ctx.message as any).text || '';
    console.log(`[TEXT] Received from ${telegramId}: "${text.substring(0, 100)}"`);

    // Check if user is in registration flow
    if (registrationFlow.isInRegistrationFlow(telegramId)) {
      console.log(`[TEXT] User in registration flow, processing...`);
      const processed = await registrationFlow.processInput(ctx, text);
      console.log(`[TEXT] Registration flow processed: ${processed}`);
      if (processed) return;
    }

    // Check if in old session state
    const session = this.userSessions.get(telegramId);
    if (!session) {
      console.log(`[TEXT] User has no session, ignoring`);
      return;
    }

    console.log(`[TEXT] Processing session for user in state: ${session.state}`);

    // Handle old-style registration (fallback)
    if (session.state === 'registering_wallet') {
      // Validate wallet address (basic check)
      if (text.length < 40 || text.length > 50) {
        console.log(`[TEXT] Invalid wallet address length: ${text.length}`);
        await ctx.reply('❌ Invalid wallet address. Please try again.');
        return;
      }

      session.walletAddress = text;
      session.state = 'registering_key';
      console.log(`[TEXT] Wallet set, moving to key registration`);
      await ctx.reply('Step 2: Send your private key (Keep this SECURE!)\n\n⚠️ WARNING: Never share your private key with anyone!');
    } else if (session.state === 'registering_key') {
      if (text.length < 80) {
        console.log(`[TEXT] Invalid private key length: ${text.length}`);
        await ctx.reply('❌ Invalid private key format. Please try again.');
        return;
      }

      session.privateKey = text;
      console.log(`[TEXT] Private key received, finalizing registration`);

      try {
        const username = ctx.from?.username || `User_${telegramId.slice(0, 5)}`;
        console.log(`[TEXT] Creating user: ${username}`);
        const user = await userManager.registerUser(
          telegramId,
          username,
          session.walletAddress!,
          session.privateKey!
        );

        this.allUsers.set(telegramId, user.id);
        this.userSessions.delete(telegramId);

        console.log(`[TEXT] User registered successfully: ${user.id}`);
        await ctx.reply(`✅ Registration successful!\n\nYour bot is now configured and ready to trade in PAPER mode.

Use /config to adjust trading parameters or /start_trading to enable live trading.`);
      } catch (err) {
        console.error(`[TEXT] Registration error:`, err);
        await ctx.reply(`❌ Registration failed: ${err}`);
        telemetryLogger.error('Registration failed', 'telegram-multi', err);
      }
    }
  }

  private async handleStatus(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('❌ Please register first using /register');
      return;
    }

    const config = userManager.getUserConfig(user.id);
    const sessions = database.getUserTradingSessions(user.id);
    const metrics = database.getPerformanceMetrics(user.id) as any;

    const message = `📊 *Your Bot Status*

👤 User: ${user.username}
💼 Wallet: ${user.walletAddress.slice(0, 8)}...
🔄 Live Trading: ${config?.enableLiveTrading ? '✅ ENABLED' : '❌ PAPER MODE'}

📈 *Performance*
Total Trades: ${metrics?.totalTrades || 0}
Win Rate: ${metrics?.winRate?.toFixed(1) || 0}%
Total Profit: $${metrics?.totalProfit?.toFixed(2) || 0}

🎯 *Settings*
Min Liquidity: $${config?.minLiquidityUsd || 7500}
Profit Target: ${config?.profitTargetPct || 30}%
Stop Loss: ${config?.trailingStopPct || 15}%

Open Positions: ${sessions.filter(s => s.status === 'open').length}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleConfig(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('❌ Please register first using /register');
      return;
    }

    const config = userManager.getUserConfig(user.id);
    const message = `⚙️ *Current Configuration*

Min Liquidity: $${config?.minLiquidityUsd}
Max Pool Age: ${(config?.maxPoolAgeMs || 0) / (60 * 60 * 1000)} hours
Min Transactions: ${config?.minTxns}
Max Transactions: ${config?.maxTxns}
Profit Target: ${config?.profitTargetPct}%
Trailing Stop: ${config?.trailingStopPct}%

🔧 Configuration adjustments can be made via the web dashboard or by contacting support.`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleTrades(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('❌ Please register first using /register');
      return;
    }

    const sessions = database.getUserTradingSessions(user.id).slice(0, 5);

    if (sessions.length === 0) {
      await ctx.reply('No trading sessions found.');
      return;
    }

    let message = '📈 *Recent Trades*\n\n';

    for (const trade of sessions) {
      const status = trade.status === 'open' ? '🔄 OPEN' : '✅ CLOSED';
      message += `${status} - ${trade.tokenMint.slice(0, 8)}...
Entry: $${trade.entryPrice.toFixed(6)}
${trade.exitPrice ? `Exit: $${trade.exitPrice.toFixed(6)}\nProfit: ${trade.profitPct?.toFixed(2)}%\n` : 'Pending...\n'}\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleStartTrading(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('❌ Please register first using /register');
      return;
    }

    await userManager.updateUserConfig(user.id, { enableLiveTrading: true });
    await ctx.reply('🟢 Live trading ENABLED.\n\n⚠️ Your bot will now trade with real funds!');
  }

  private async handleStopTrading(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('❌ Please register first using /register');
      return;
    }

    await userManager.updateUserConfig(user.id, { enableLiveTrading: false });
    await ctx.reply('🛑 Live trading DISABLED. Back to paper mode.');
  }

  private async handleHelp(ctx: Context): Promise<void> {
    const message = `ℹ️ *Available Commands*

/register - Register your wallet
/status - View bot status and performance
/config - View current configuration
/trades - View recent trades
/start_trading - Enable live trading
/stop - Disable live trading
/help - Show this message

🤖 Bot Features:
- Multi-user support
- Paper and live trading modes
- AI-powered monitoring
- Automatic error detection and fixes
- Real-time Telegram notifications

📞 Support: Contact @support or /help`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleCallback(ctx: Context): Promise<void> {
    try {
      const data = (ctx.callbackQuery as any)?.data;
      const telegramId = String(ctx.from?.id);
      const username = ctx.from?.username || 'unknown';
      
      console.log(`[CALLBACK] From ${telegramId}, action: ${data}`);
      telegramDebug.log('callback', telegramId, username, `Callback: ${data}`);
      
      // Always answer the callback query first to remove the loading state
      try {
        await ctx.answerCbQuery();
      } catch (err) {
        console.error(`[CALLBACK ERROR] Failed to answer callback query:`, err);
      }

      // Handle registration flow callbacks
      if (data?.startsWith('wallet_') || data === 'confirm_generated' || data === 'confirm_imported' || data === 'cancel_registration') {
        console.log(`[CALLBACK] Routing to registration flow for action: ${data}`);
        telegramDebug.log('callback', telegramId, username, `Routing to registration flow: ${data}`);
        await registrationFlow.handleCallback(ctx, data);
        return;
      }

      // Handle other callbacks
      if (data === 'register_start') {
        console.log(`[CALLBACK] User starting registration`);
        telegramDebug.log('callback', telegramId, username, 'User starting registration');
        await this.handleRegister(ctx);
      } else if (data === 'show_help') {
        console.log(`[CALLBACK] User requesting help`);
        telegramDebug.log('callback', telegramId, username, 'User requesting help');
        await this.handleHelp(ctx);
      } else if (data === 'show_dashboard') {
        console.log(`[CALLBACK] User requesting dashboard`);
        telegramDebug.log('callback', telegramId, username, 'User requesting dashboard');
        await ctx.reply('📊 Dashboard coming soon!\n\nFor now, use /status to see your portfolio.');
      } else if (data === 'config') {
        console.log(`[CALLBACK] User requesting config`);
        telegramDebug.log('callback', telegramId, username, 'User requesting config');
        await this.handleConfig(ctx);
      } else {
        console.log(`[CALLBACK] Unknown action, ignoring`);
        telegramDebug.log('callback', telegramId, username, `Unknown callback: ${data}`);
      }
    } catch (err) {
      console.error(`❌ [CALLBACK HANDLER ERROR]:`, err);
      const telegramId = String(ctx.from?.id);
      const username = ctx.from?.username || 'unknown';
      telegramDebug.log('callback', telegramId, username, `ERROR: ${err instanceof Error ? err.message : String(err)}`);
      
      try {
        await ctx.answerCbQuery(`Error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
      } catch (answerErr) {
        console.error(`Failed to answer callback query with error:`, answerErr);
      }
    }
  }

  async broadcastMaintenanceAlert(message: string): Promise<void> {
    if (!this.bot) return;

    for (const [telegramId] of this.allUsers) {
      try {
        await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
      } catch (err) {
        telemetryLogger.error(`Failed to send maintenance alert to ${telegramId}`, 'telegram-multi', err);
      }
    }
  }

  async broadcastMaintenanceComplete(message: string): Promise<void> {
    if (!this.bot) return;

    for (const [telegramId] of this.allUsers) {
      try {
        await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
      } catch (err) {
        telemetryLogger.error(`Failed to send complete message to ${telegramId}`, 'telegram-multi', err);
      }
    }
  }

  async sendUserNotification(userId: string, message: string): Promise<void> {
    if (!this.bot) return;

    const user = database.getUserById(userId);
    if (!user) return;

    try {
      await this.bot.telegram.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      telemetryLogger.error(`Failed to send notification to user ${userId}`, 'telegram-multi', err);
    }
  }

  async shutdown(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stop();
        telemetryLogger.info('Telegram bot stopped', 'telegram-multi');
      } catch (err) {
        telemetryLogger.error('Error stopping Telegram bot', 'telegram-multi', err);
      }
    }
  }
}

export default new MultiUserTelegramBot();
