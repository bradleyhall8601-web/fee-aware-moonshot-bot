// src/telegram-registration.ts
// Enhanced Telegram user registration and wallet setup flow

import { Context, Markup } from 'telegraf';
import userManager from './user-manager';
import telemetryLogger from './telemetry';
import { Keypair } from '@solana/web3.js';

// bs58 is available from @solana/web3.js
const bs58 = require('bs58');

interface RegistrationState {
  stage:
    | 'username'
    | 'wallet_choice'
    | 'import_wallet'
    | 'generate_wallet'
    | 'private_key'
    | 'confirm'
    | 'completed';
  username?: string;
  walletAddress?: string;
  privateKey?: string;
  walletMethod?: 'import' | 'generate';
  timestamp: number;
}

class TelegramRegistrationFlow {
  private userStates: Map<string, RegistrationState> = new Map();
  private readonly TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Start registration flow
   */
  async startRegistration(ctx: Context): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const existingUser = userManager.getUserByTelegramId(telegramId);

    if (existingUser) {
      await ctx.reply('✅ You are already registered!');
      return;
    }

    this.userStates.set(telegramId, {
      stage: 'username',
      timestamp: Date.now(),
    });

    await ctx.reply(
      `👋 Welcome to Fee-Aware Moonshot Bot Registration!

We'll set up your wallet in a few simple steps.

📝 Step 1: What's your username? (e.g., trader_pro)`,
      {
        reply_markup: {
          force_reply: true,
          selective: true,
        },
      }
    );

    telemetryLogger.info(
      `Registration started for user ${telegramId}`,
      'telegram-registration'
    );
  }

  /**
   * Process registration input
   */
  async processInput(ctx: Context, text: string): Promise<boolean> {
    const telegramId = String(ctx.from?.id);
    const state = this.userStates.get(telegramId);

    if (!state) {
      return false;
    }

    if (Date.now() - state.timestamp > this.TIMEOUT) {
      this.userStates.delete(telegramId);
      await ctx.reply(
        '❌ Registration session expired. Please start again with /register'
      );
      return false;
    }

    state.timestamp = Date.now();

    try {
      switch (state.stage) {
        case 'username':
          return await this.handleUsernameInput(ctx, text, state, telegramId);

        case 'wallet_choice':
          await ctx.reply(
            '👇 Please tap one of the buttons to choose wallet setup.'
          );
          return true;

        case 'import_wallet':
          return await this.handleWalletImport(ctx, text, state, telegramId);

        case 'generate_wallet':
          await ctx.reply(
            '👇 Please tap the confirm button under the generated wallet.'
          );
          return true;

        case 'private_key':
          return await this.handlePrivateKeyInput(ctx, text, state, telegramId);

        case 'confirm':
          await ctx.reply('👇 Please tap the confirm button to finish setup.');
          return true;

        default:
          return false;
      }
    } catch (err) {
      console.error('RAW REGISTRATION ERROR:', err);

      telemetryLogger.error('Registration flow error', 'telegram-registration', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        error:
          err instanceof Error
            ? {
                name: err.name,
                message: err.message,
                stack: err.stack,
              }
            : err,
      });

      await ctx.reply('❌ An error occurred. Please try again with /register');
      this.userStates.delete(telegramId);
      return false;
    }
  }

  /**
   * Handle username input
   */
  private async handleUsernameInput(
    ctx: Context,
    text: string,
    state: RegistrationState,
    telegramId: string
  ): Promise<boolean> {
    const username = text.trim();

    if (!username || username.length < 3 || username.length > 30) {
      await ctx.reply('❌ Username must be between 3-30 characters. Try again:');
      return true;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      await ctx.reply(
        '❌ Username can only contain letters, numbers, dashes, and underscores. Try again:'
      );
      return true;
    }

    // TEMP: skip username uniqueness check until userManager method is verified
    // if (userManager.getUserByUsername(username)) {
    //   await ctx.reply('❌ This username is already taken. Please choose another:');
    //   return true;
    // }

    state.username = username;
    state.stage = 'wallet_choice';
    state.timestamp = Date.now();

    await ctx.reply(
      `✅ Great! Your username is: ${username}

📝 Step 2: How would you like to set up your wallet?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📥 Import Existing Wallet', 'wallet_import')],
        [Markup.button.callback('✨ Generate New Wallet', 'wallet_generate')],
      ])
    );

    return true;
  }

  /**
   * Handle wallet choice (callback button)
   */
  async handleWalletChoice(
    ctx: Context,
    choice: string,
    state: RegistrationState,
    telegramId: string
  ): Promise<boolean> {
    state.timestamp = Date.now();

    if (choice === 'import') {
      state.walletMethod = 'import';
      state.stage = 'import_wallet';

      await ctx.reply(
        `📥 Import Your Wallet

Paste your private key in base58 format.

⚠️ SECURITY WARNING:
- Never share your private key with anyone except systems you fully trust
- This bot will never ask for your key outside this setup flow
- For safety, paper trade first

Send your private key now:`,
        {
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        }
      );

      return true;
    }

    if (choice === 'generate') {
      state.walletMethod = 'generate';
      state.stage = 'confirm';

      const newKeypair = Keypair.generate();
      const publicKey = newKeypair.publicKey.toString();
      const privateKey = bs58.encode(newKeypair.secretKey);

      state.walletAddress = publicKey;
      state.privateKey = privateKey;

      await ctx.reply(
        `✨ New Wallet Generated!

📍 Your Wallet Address:
\`${publicKey}\`

This is your public address. You can safely use it to receive SOL.

🔐 Step 3: Confirm this wallet to complete setup.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '✅ Confirm & Complete Setup',
                'confirm_generated'
              ),
            ],
            [
              Markup.button.callback(
                '❌ Cancel & Start Over',
                'cancel_registration'
              ),
            ],
          ]),
        }
      );

      return true;
    }

    return false;
  }

  /**
   * Handle wallet import (private key input)
   */
  private async handleWalletImport(
    ctx: Context,
    text: string,
    state: RegistrationState,
    telegramId: string
  ): Promise<boolean> {
    const keyInput = text.trim();

    try {
      let keypair: Keypair;

      try {
        const decoded = bs58.decode(keyInput);
        keypair = Keypair.fromSecretKey(decoded);
      } catch {
        await ctx.reply(
          "❌ Invalid private key format. Please ensure it's valid base58 and try again:"
        );
        return true;
      }

      state.walletAddress = keypair.publicKey.toString();
      state.privateKey = keyInput;
      state.stage = 'confirm';
      state.timestamp = Date.now();

      await ctx.reply(
        `✅ Wallet imported successfully!

📍 Wallet Address:
\`${state.walletAddress}\`

This will be your trading wallet with the bot.

🔐 Step 3: Confirm to complete setup.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirm & Complete', 'confirm_imported')],
            [Markup.button.callback('❌ Cancel', 'cancel_registration')],
          ]),
        }
      );

      return true;
    } catch (err) {
      console.error('RAW WALLET IMPORT ERROR:', err);
      telemetryLogger.error(
        'Wallet import validation error',
        'telegram-registration',
        {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        }
      );
      await ctx.reply(
        '❌ Invalid wallet. Please check your private key and try again:'
      );
      return true;
    }
  }

  /**
   * Handle wallet generation (no text input needed)
   */
  private async handleWalletGeneration(
    ctx: Context,
    text: string,
    state: RegistrationState,
    telegramId: string
  ): Promise<boolean> {
    await ctx.reply('👇 Please use the generated wallet confirmation button.');
    return true;
  }

  /**
   * Handle private key confirmation
   */
  private async handlePrivateKeyInput(
    ctx: Context,
    text: string,
    state: RegistrationState,
    telegramId: string
  ): Promise<boolean> {
    await ctx.reply('👇 Please continue using the on-screen buttons.');
    return true;
  }

  /**
   * Handle final confirmation and account creation
   */
  private async handleConfirmation(
    ctx: Context,
    text: string,
    state: RegistrationState,
    telegramId: string
  ): Promise<boolean> {
    if (!state.username || !state.walletAddress || !state.privateKey) {
      await ctx.reply(
        '❌ Registration incomplete. Please start again with /register'
      );
      this.userStates.delete(telegramId);
      return false;
    }

    try {
      const user = await userManager.registerUser(
        telegramId,
        state.username,
        state.walletAddress,
        state.privateKey
      );

      if (!user) {
        await ctx.reply('❌ Failed to create user account. Please try again.');
        this.userStates.delete(telegramId);
        return false;
      }

      this.userStates.delete(telegramId);

      await ctx.reply(
        `🎉 Registration Complete!

✅ Account Created
Username: ${state.username}
Wallet: \`${state.walletAddress.slice(0, 8)}...${state.walletAddress.slice(-8)}\`

📊 You can now:
• Monitor your portfolio
• View trading signals
• Configure trading settings
• Check trading history

Use /help to see all available commands.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('View Dashboard', 'show_dashboard')],
            [Markup.button.callback('Configure Settings', 'config')],
          ]),
        }
      );

      telemetryLogger.info(
        `User registered successfully: ${user.id}`,
        'telegram-registration'
      );
      return false;
    } catch (err) {
      console.error('RAW CREATE USER ERROR:', err);

      telemetryLogger.error(
        'Failed to create user account',
        'telegram-registration',
        {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          error:
            err instanceof Error
              ? {
                  name: err.name,
                  message: err.message,
                  stack: err.stack,
                }
              : err,
        }
      );

      await ctx.reply('❌ Registration failed. Please contact support.');
      this.userStates.delete(telegramId);
      return false;
    }
  }

  /**
   * Handle button callbacks for wallet choice
   */
  async handleCallback(ctx: Context, action: string): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const state = this.userStates.get(telegramId);
    const userName = ctx.from?.username || 'unknown';

    console.log(`[REG-CB] Callback from @${userName} (${telegramId}): action=${action}, hasState=${!!state}`);

    if (!state) {
      console.warn(`[REG-CB] No active registration state for user ${telegramId}, ignoring callback: ${action}`);
      // Silently ignore - user may have expired session or clicked old button
      try {
        await ctx.answerCbQuery('Your registration session has expired. Start a new registration with /register');
      } catch (err) {
        console.error(`[REG-CB] Failed to answer callback query:`, err);
      }
      return;
    }

    try {
      console.log(`[REG-CB] Processing action=${action}, currentStage=${state.stage}`);
      
      if (action === 'wallet_import') {
        const result = await this.handleWalletChoice(ctx, 'import', state, telegramId);
        if (result) {
          await ctx.answerCbQuery('Loading import wallet screen...');
        }
      } else if (action === 'wallet_generate') {
        const result = await this.handleWalletChoice(ctx, 'generate', state, telegramId);
        if (result) {
          await ctx.answerCbQuery('Wallet generated! Confirm to continue.');
        }
      } else if (action === 'confirm_generated' || action === 'confirm_imported') {
        console.log(`[REG-CB] Processing confirmation: ${action}`);
        const result = await this.handleConfirmation(ctx, '', state, telegramId);
        if (result) {
          await ctx.answerCbQuery('✅ Account created successfully!');
        } else {
          await ctx.answerCbQuery('❌ Account creation failed. Try again.');
        }
      } else if (action === 'cancel_registration') {
        this.userStates.delete(telegramId);
        await ctx.reply('❌ Registration cancelled. You can start again anytime with /register');
        await ctx.answerCbQuery('Registration cancelled');
      } else {
        console.warn(`[REG-CB] Unknown callback action: ${action}`);
        await ctx.answerCbQuery('Unknown action');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const stackTrace = err instanceof Error ? err.stack : '';
      console.error(`[REG-CB] ERROR for @${userName} (${telegramId}):`, errorMsg);
      console.error(`[REG-CB] Stack:`, stackTrace);

      telemetryLogger.error('Callback handler error', 'telegram-registration', {
        telegramId,
        action,
        stage: state?.stage,
        message: errorMsg,
        stack: stackTrace,
      });

      try {
        await ctx.answerCbQuery('⚠️  An error occurred. Please try /register again.');
        await ctx.reply('❌ Something went wrong. Please use /register to start over.');
      } catch (replyErr) {
        console.error(`[REG-CB] Failed to send error reply:`, replyErr);
      }
      
      this.userStates.delete(telegramId);
    }
  }

  /**
   * Check if user is in registration flow
   */
  isInRegistrationFlow(telegramId: string): boolean {
    return this.userStates.has(telegramId);
  }

  /**
   * Cancel registration for user
   */
  cancelRegistration(telegramId: string): void {
    this.userStates.delete(telegramId);
  }
}

export default new TelegramRegistrationFlow();