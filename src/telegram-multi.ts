// src/telegram-multi.ts
// MoonShotForge Multi-User Telegram Bot - Full command set

import { Telegraf, Context, Markup } from 'telegraf';
import userManager from './user-manager';
import database from './database';
import telemetryLogger from './telemetry';
import registrationFlow from './telegram-registration';
import telegramDebug from './telegram-debug';
import accessManager from './access/access-manager';
import commandRegistry from './command-registry';
import paperTrading from './paper-trading';
import aiSelfImprove from './ai-self-improve';
import confidenceScorer from './confidence-scorer';
import tradingModeManager from './trading-mode';
import paypalHandler from './payments/paypal-handler';
import solPaymentHandler from './payments/sol-payment-handler';
import aiSupport from './ai-support';
import bossAI from './boss-ai';

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

      // New MoonShotForge commands
      this.bot.command('signals', (ctx) => this.handleSignals(ctx));
      this.bot.command('positions', (ctx) => this.handlePositions(ctx));
      this.bot.command('wallet', (ctx) => this.handleWallet(ctx));
      this.bot.command('mode', (ctx) => this.handleMode(ctx));
      this.bot.command('paper', (ctx) => this.handlePaperMode(ctx));
      this.bot.command('live', (ctx) => this.handleLiveMode(ctx));
      this.bot.command('join', (ctx) => this.handleJoin(ctx));
      this.bot.command('pay', (ctx) => this.handlePay(ctx));
      this.bot.command('subscribe', (ctx) => this.handleSubscribe(ctx));
      this.bot.command('checkpayment', (ctx) => this.handleCheckPayment(ctx));
      this.bot.command('support', (ctx) => this.handleSupport(ctx));
      this.bot.command('settings', (ctx) => this.handleSettings(ctx));
      this.bot.command('performance', (ctx) => this.handlePerformance(ctx));

      // Admin commands
      this.bot.command('admin', (ctx) => this.handleAdmin(ctx));
      this.bot.command('users', (ctx) => this.handleUsers(ctx));
      this.bot.command('logs', (ctx) => this.handleLogs(ctx));
      this.bot.command('kill', (ctx) => this.handleKill(ctx));
      this.bot.command('resume', (ctx) => this.handleResume(ctx));
      this.bot.command('broadcast', (ctx) => this.handleBroadcast(ctx));
      this.bot.command('approve', (ctx) => this.handleApprove(ctx));
      this.bot.command('deny', (ctx) => this.handleDeny(ctx));
      this.bot.command('grant', (ctx) => this.handleGrant(ctx));
      this.bot.command('revoke', (ctx) => this.handleRevoke(ctx));
      this.bot.command('ai', (ctx) => this.handleAI(ctx));
      this.bot.command('health', (ctx) => this.handleHealth(ctx));
      this.bot.command('debug', (ctx) => this.handleDebugCmd(ctx));

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
      const hasAccess = accessManager.hasAccess(telegramId);
      await ctx.reply(
        `👋 Welcome back, *${existingUser.username}*!\n\nAccess: ${hasAccess ? '✅ Active' : '⚠️ No subscription — use /join'}\n\nUse /help to see all commands.\nUse /signals to see live signals.\nUse /status for your performance.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      console.log(`[START] New user, showing registration prompt`);
      telegramDebug.log('command', telegramId, username, 'Start - New user, showing registration');
      await ctx.reply(
        `🚀 *Welcome to MoonShotForge!*\n\nThe most advanced Solana meme-coin signal & trading bot.\n\n• AI-powered signals from 5+ sources\n• Paper trading (free) & Live trading\n• Self-learning AI with adaptive thresholds\n• Subscription: $49.99/month\n\nTo get started, register your wallet:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📝 Register Now', 'register_start')],
            [Markup.button.callback('💳 Subscribe', 'pay_paypal'), Markup.button.callback('❓ Help', 'show_help')],
          ]),
        }
      );
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
      await ctx.reply('❌ Please register first using /start');
      return;
    }

    const config = userManager.getUserConfig(user.id);
    const paperStats = paperTrading.getStats(user.id);
    const hasAccess = accessManager.hasAccess(telegramId);
    const isOwner = accessManager.isOwner(telegramId);

    const message = `📊 *MoonShotForge Status*

👤 User: ${user.username}
💼 Wallet: \`${user.walletAddress.slice(0, 8)}...\`
🔑 Access: ${isOwner ? '👑 Owner' : hasAccess ? '✅ Active' : '⚠️ No subscription'}
🔄 Mode: ${config?.enableLiveTrading ? '🟢 LIVE' : '📄 PAPER'}

📈 *Performance*
Total Trades: ${paperStats.totalTrades}
Win Rate: ${paperStats.winRate.toFixed(1)}%
Total Profit: ${paperStats.totalProfit.toFixed(2)}
Open Positions: ${paperStats.openPositions}

🎯 *Settings*
Profit Target: ${config?.profitTargetPct || 30}%
Stop Loss: ${config?.trailingStopPct || 15}%

Use /signals for live signals • /positions for open trades`;

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
    const message = `ℹ️ *MoonShotForge Commands*

*User Commands:*
/start — Welcome & register
/status — Bot status & performance
/signals — Recent trading signals
/positions — Open positions
/trades — Trade history
/wallet — Your wallet info
/mode — Current trading mode
/paper — Switch to paper mode
/live — Request live mode
/join — Subscribe ($49.99/month)
/pay — PayPal payment
/subscribe — SOL payment
/checkpayment — Check SOL payment
/support — NOVA AI support
/settings — Your settings
/performance — Performance stats
/help — This message

*Admin Commands:*
/admin /users /logs /broadcast
/approve /deny /grant /revoke
/kill /resume /ai /health /debug

🤖 Powered by AI • Multi-source signals • Paper & Live trading`;

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
      } else if (data === 'pay_paypal') {
        await this.handlePay(ctx);
      } else if (data === 'pay_sol') {
        await this.handleSubscribe(ctx);
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

  private async handleSignals(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.hasAccess(telegramId) && !accessManager.isOwner(telegramId)) {
      await ctx.reply('🔒 Signals require an active subscription. Use /join to subscribe.');
      return;
    }
    const signals = database.getRecentSignals(5);
    if (signals.length === 0) {
      await ctx.reply('📡 No recent signals. The bot is scanning markets...');
      return;
    }
    let msg = '📡 *Recent Signals*\n\n';
    for (const s of signals) {
      const emoji = s.decision === 'BUY' ? '🟢' : s.decision === 'WATCH' ? '🟡' : '🔴';
      msg += `${emoji} *${s.symbol}* — ${s.decision}\nConf: ${s.confidence}/100 | Mode: ${s.mode}\nLiq: ${Number(s.liquidity).toLocaleString()} | BP: ${Number(s.buyPressure).toFixed(0)}%\n\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  private async handlePositions(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const positions = paperTrading.getOpenPositions(user.id);
    if (positions.length === 0) {
      await ctx.reply('📊 No open positions.');
      return;
    }
    let msg = '📊 *Open Positions*\n\n';
    for (const p of positions) {
      const holdMin = Math.round((Date.now() - p.openedAt) / 60000);
      msg += `🔄 *${p.symbol}* (${p.mode})\nEntry: ${p.entryPrice.toFixed(8)}\nSize: ${p.entryAmount.toFixed(2)} | Hold: ${holdMin}m\n\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  private async handleWallet(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const addr = user.walletAddress;
    await ctx.reply(
      `💼 *Your Wallet*\n\nAddress: \`${addr}\`\n\nThis is your Solana wallet for trading.\nPaper mode: No real funds used.\nLive mode: Requires subscription + admin approval.\n\n🔗 [View on Solscan](https://solscan.io/account/${addr})`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleMode(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const status = await tradingModeManager.getModeStatus(user.id);
    const badge = status.effectiveMode === 'LIVE' ? '🟢 LIVE' : '📄 PAPER';
    let msg = `🎯 *Trading Mode*\n\nEffective Mode: ${badge}\nGlobal Live: ${status.globalLiveEnabled ? '✅' : '❌'}\nYour Preference: ${status.userPreference}\n\n`;
    if (status.missingGates.length > 0) {
      msg += `⚠️ *Missing Gates:*\n${status.missingGates.map(g => `• ${g}`).join('\n')}\n\n`;
    }
    if (status.solBalance !== undefined) {
      msg += `💰 SOL Balance: ${status.solBalance.toFixed(4)} SOL\n`;
      msg += `💵 SOL Price: ${status.solPrice?.toFixed(2)}\n`;
      msg += `📊 Tradable: ${status.tradableAmount?.toFixed(4)} SOL\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  private async handlePaperMode(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    await userManager.updateUserConfig(user.id, { enableLiveTrading: false });
    await ctx.reply('📄 Switched to *Paper Mode*. No real funds will be used.', { parse_mode: 'Markdown' });
  }

  private async handleLiveMode(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const status = await tradingModeManager.getModeStatus(user.id);
    if (status.missingGates.length > 0) {
      await ctx.reply(`❌ Cannot enable live mode:\n${status.missingGates.map(g => `• ${g}`).join('\n')}`);
      return;
    }
    await userManager.updateUserConfig(user.id, { enableLiveTrading: true });
    await ctx.reply('🟢 *Live Mode* requested. Awaiting admin approval.', { parse_mode: 'Markdown' });
  }

  private async handleJoin(ctx: Context): Promise<void> {
    const price = process.env.SUBSCRIPTION_PRICE_DISPLAY || '$49.99/month';
    await ctx.reply(
      `🚀 *Join MoonShotForge*\n\nSubscription: ${price}\n\nPayment Options:\n💳 PayPal: /pay\n⚡ SOL: /subscribe\n\nAfter payment, your access will be activated within 24 hours.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Pay with PayPal', 'pay_paypal')],
          [Markup.button.callback('⚡ Pay with SOL', 'pay_sol')],
        ]),
      }
    );
  }

  private async handlePay(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    const userId = user?.id || telegramId;
    const instructions = paypalHandler.getPaymentInstructions(userId);
    await ctx.reply(instructions, { parse_mode: 'Markdown' });
  }

  private async handleSubscribe(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const instructions = await solPaymentHandler.initiatePayment(user.id, telegramId);
    await ctx.reply(instructions, { parse_mode: 'Markdown' });
  }

  private async handleCheckPayment(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const result = await solPaymentHandler.checkPayment(user.id);
    await ctx.reply(result.message);
  }

  private async handleSupport(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    const text = (ctx.message as any)?.text?.replace('/support', '').trim();
    if (!text) {
      await ctx.reply('💬 *NOVA Support*\n\nAsk me anything!\nExample: /support How do I connect my wallet?\n\nOr use /join to subscribe.', { parse_mode: 'Markdown' });
      return;
    }
    const isAdmin = accessManager.isAdmin(telegramId);
    const isOwner = accessManager.isOwner(telegramId);
    const answer = await aiSupport.answer(text, user?.id || telegramId, telegramId, isAdmin, isOwner);
    await ctx.reply(`🤖 *NOVA:* ${answer}`, { parse_mode: 'Markdown' });
  }

  private async handleSettings(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const config = userManager.getUserConfig(user.id);
    await ctx.reply(
      `⚙️ *Settings*\n\nMin Liquidity: ${config?.minLiquidityUsd || 10000}\nProfit Target: ${config?.profitTargetPct || 30}%\nStop Loss: ${config?.trailingStopPct || 15}%\nLive Trading: ${config?.enableLiveTrading ? '✅' : '❌'}\n\nUse /mode to change trading mode.`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handlePerformance(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const user = userManager.getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('❌ Please /start to register first.'); return; }
    const stats = paperTrading.getStats(user.id);
    await ctx.reply(
      `📈 *Performance*\n\nTotal Trades: ${stats.totalTrades}\nWin Rate: ${stats.winRate.toFixed(1)}%\nTotal Profit: ${stats.totalProfit.toFixed(2)}\nAvg Win: +${stats.avgWin.toFixed(1)}%\nAvg Loss: ${stats.avgLoss.toFixed(1)}%\nOpen Positions: ${stats.openPositions}`,
      { parse_mode: 'Markdown' }
    );
  }

  // Admin commands
  private async handleAdmin(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) {
      await ctx.reply('❌ Admin access required.');
      return;
    }
    const users = userManager.getAllActiveUsers();
    const paperStats = paperTrading.getStats();
    const learnStats = aiSelfImprove.getStats();
    await ctx.reply(
      `🔧 *Admin Panel*\n\nUsers: ${users.length}\nPaper Win Rate: ${paperStats.winRate.toFixed(1)}%\nThreshold: ${confidenceScorer.getThreshold()}\nStreak: ${learnStats.consecutiveWins}W/${learnStats.consecutiveLosses}L\nLive: ${process.env.ENABLE_LIVE_TRADING === 'true' ? '🟢' : '🔴'}\n\nCommands: /users /logs /broadcast /grant /revoke /approve /deny /kill /resume /ai /health`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleUsers(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const users = userManager.getAllActiveUsers();
    if (users.length === 0) { await ctx.reply('No users registered.'); return; }
    let msg = `👥 *Users (${users.length})*\n\n`;
    for (const u of users.slice(0, 20)) {
      const access = database.getUserAccess(u.id);
      msg += `• ${u.username} (${u.telegramId}) — ${access?.status || 'unpaid'}\n`;
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  private async handleLogs(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const logs = telemetryLogger.getLogsForAnalysis(20);
    await ctx.reply(`📋 *Recent Logs*\n\n\`\`\`\n${logs.slice(-1000)}\n\`\`\``, { parse_mode: 'Markdown' });
  }

  private async handleKill(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    process.env.ENABLE_LIVE_TRADING = 'false';
    await ctx.reply('🛑 *Emergency Kill* — Live trading disabled globally.', { parse_mode: 'Markdown' });
    telemetryLogger.warn(`Emergency kill triggered by ${telegramId}`, 'telegram-multi');
  }

  private async handleResume(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isOwner(telegramId)) { await ctx.reply('❌ Owner only.'); return; }
    await ctx.reply('▶️ Bot resumed. Use /live to re-enable live trading if needed.');
  }

  private async handleBroadcast(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const text = (ctx.message as any)?.text?.replace('/broadcast', '').trim();
    if (!text) { await ctx.reply('Usage: /broadcast <message>'); return; }
    await this.broadcastMaintenanceAlert(`📢 *Broadcast*\n\n${text}`);
    await ctx.reply(`✅ Broadcast sent to all users.`);
  }

  private async handleApprove(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const args = (ctx.message as any)?.text?.split(' ');
    const targetId = args?.[1];
    if (!targetId) { await ctx.reply('Usage: /approve <userId>'); return; }
    const user = database.getUserByTelegramId(targetId) || database.getUserById(targetId);
    if (!user) { await ctx.reply('User not found.'); return; }
    accessManager.grantAccess(user.id, telegramId, 30);
    paypalHandler.approvePayment(user.id, telegramId);
    await ctx.reply(`✅ Access granted to ${user.username} for 30 days.`);
    if (this.bot) {
      try { await this.bot.telegram.sendMessage(user.telegramId, '✅ Your subscription has been approved! Welcome to MoonShotForge.'); } catch {}
    }
  }

  private async handleDeny(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const args = (ctx.message as any)?.text?.split(' ');
    const targetId = args?.[1];
    if (!targetId) { await ctx.reply('Usage: /deny <userId>'); return; }
    const user = database.getUserByTelegramId(targetId) || database.getUserById(targetId);
    if (!user) { await ctx.reply('User not found.'); return; }
    paypalHandler.rejectPayment(user.id, telegramId);
    await ctx.reply(`❌ Payment denied for ${user.username}.`);
  }

  private async handleGrant(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const args = (ctx.message as any)?.text?.split(' ');
    const targetId = args?.[1];
    const days = parseInt(args?.[2] || '30');
    if (!targetId) { await ctx.reply('Usage: /grant <userId> [days]'); return; }
    const user = database.getUserByTelegramId(targetId) || database.getUserById(targetId);
    if (!user) { await ctx.reply('User not found.'); return; }
    accessManager.grantAccess(user.id, telegramId, days);
    await ctx.reply(`✅ Access granted to ${user.username} for ${days} days.`);
  }

  private async handleRevoke(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const args = (ctx.message as any)?.text?.split(' ');
    const targetId = args?.[1];
    if (!targetId) { await ctx.reply('Usage: /revoke <userId>'); return; }
    const user = database.getUserByTelegramId(targetId) || database.getUserById(targetId);
    if (!user) { await ctx.reply('User not found.'); return; }
    accessManager.revokeAccess(user.id, telegramId);
    await ctx.reply(`🚫 Access revoked for ${user.username}.`);
  }

  private async handleAI(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const text = (ctx.message as any)?.text?.replace('/ai', '').trim();
    if (!text) { await ctx.reply('Usage: /ai <question>\nExample: /ai What is the current win rate?'); return; }
    const isOwner = accessManager.isOwner(telegramId);
    const user = userManager.getUserByTelegramId(telegramId);
    const response = await bossAI.processCommand(text, user?.id || telegramId, isOwner);
    await ctx.reply(response, { parse_mode: 'Markdown' });
  }

  private async handleHealth(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const uptime = Math.round(process.uptime() / 60);
    const mem = process.memoryUsage();
    const memMb = Math.round(mem.heapUsed / 1024 / 1024);
    await ctx.reply(
      `💚 *System Health*\n\nUptime: ${uptime} minutes\nMemory: ${memMb}MB\nLive Trading: ${process.env.ENABLE_LIVE_TRADING === 'true' ? '🟢' : '🔴'}\nAI Monitor: ${process.env.ENABLE_AI_MONITOR === 'true' ? '🟢' : '🔴'}\nThreshold: ${confidenceScorer.getThreshold()}`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleDebugCmd(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    if (!accessManager.isAdmin(telegramId)) { await ctx.reply('❌ Admin only.'); return; }
    const stats = aiSelfImprove.getStats();
    await ctx.reply(
      `🔍 *Debug Info*\n\nThreshold: ${stats.currentThreshold}\nWin Rate: ${stats.recentWinRate.toFixed(1)}%\nCycles: ${stats.cyclesRun}\nStreak: ${stats.consecutiveWins}W/${stats.consecutiveLosses}L\n\nDashboard: ${process.env.BASE_URL || 'http://localhost:5000'}/debug.html`,
      { parse_mode: 'Markdown' }
    );
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
