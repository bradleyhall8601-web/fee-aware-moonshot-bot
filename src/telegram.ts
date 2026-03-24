// src/telegram.ts
// Telegraf bot: Telegram control interface for the paper-trading bot.

import { Telegraf, Context } from "telegraf";
import { config } from "./config";
import {
  addWatchedWallet,
  getCash,
  getPositions,
  getWatchedWallets,
  loadState,
} from "./state";
import {
  scanCandidates,
  simulateBuy,
  simulateSell,
} from "./strategy";
import { WatchedWallet } from "./types";

// ── Bot instance ──────────────────────────────────────────────────────────────

let bot: Telegraf | null = null;

export function getTelegramBot(): Telegraf | null {
  return bot;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function reply(ctx: Context, text: string): Promise<unknown> {
  return ctx.reply(text, { parse_mode: "Markdown" });
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(ctx: Context): Promise<void> {
  await reply(
    ctx,
    `🤖 *Fee-Aware Moonshot Bot* (SAFE MODE)\n\n` +
      `Running in *paper-trading mode only*. No real funds are at risk.\n\n` +
      `Commands:\n` +
      `/status – bot status\n` +
      `/positions – open positions\n` +
      `/cash – available cash\n` +
      `/scan – scan for candidates\n` +
      `/buy SYMBOL USD – simulate buy\n` +
      `/sell SYMBOL – simulate sell\n` +
      `/watch WALLET – add wallet to watch list\n` +
      `/watches – list watched wallets`
  );
}

async function handleStatus(ctx: Context): Promise<void> {
  const state = loadState();
  const positions = getPositions();
  const totalValue = positions.reduce((s, p) => s + p.currentValueUsd, 0);
  const totalPnl = positions.reduce((s, p) => s + p.unrealizedPnlUsd, 0);
  const uptime = Math.round((Date.now() - state.startedAt) / 1000 / 60);

  await reply(
    ctx,
    `📊 *Bot Status*\n\n` +
      `Mode: PAPER (safe mode)\n` +
      `Cash: ${fmtUsd(state.cashUsd)}\n` +
      `Open positions: ${positions.length}\n` +
      `Portfolio value: ${fmtUsd(totalValue)}\n` +
      `Unrealised PnL: ${fmtUsd(totalPnl)}\n` +
      `Realised PnL: ${fmtUsd(state.pnl)}\n` +
      `Uptime: ${uptime} min\n` +
      `Last scan: ${state.lastScanAt ? new Date(state.lastScanAt).toISOString() : "never"}`
  );
}

async function handlePositions(ctx: Context): Promise<void> {
  const positions = getPositions();
  if (positions.length === 0) {
    await reply(ctx, "📭 No open positions.");
    return;
  }

  const lines = positions.map(
    (p) =>
      `• *${p.symbol}*\n` +
      `  Entry: ${fmtUsd(p.entryPriceUsd)}  Now: ${fmtUsd(p.currentPriceUsd)}\n` +
      `  Value: ${fmtUsd(p.currentValueUsd)}  PnL: ${fmtUsd(p.unrealizedPnlUsd)} (${p.unrealizedPnlPct.toFixed(1)}%)`
  );

  await reply(ctx, `📈 *Open Positions*\n\n${lines.join("\n\n")}`);
}

async function handleCash(ctx: Context): Promise<void> {
  const cash = getCash();
  await reply(ctx, `💵 Available cash: *${fmtUsd(cash)}* (paper mode)`);
}

async function handleScan(ctx: Context): Promise<void> {
  await reply(ctx, "🔍 Scanning for candidates…");
  try {
    const candidates = await scanCandidates();
    if (candidates.length === 0) {
      await reply(ctx, "No candidates found after filtering.");
      return;
    }
    const top = candidates.slice(0, 5);
    const lines = top.map(
      (c, i) =>
        `${i + 1}. *${c.symbol}* – conf: ${c.confidence}\n` +
        `   Liq: ${fmtUsd(c.liquidityUsd)}  Vol: ${fmtUsd(c.volumeUsd24h)}\n` +
        `   B/S ratio: ${c.buySellRatio.toFixed(2)}  Price: $${c.priceUsd.toFixed(6)}`
    );
    await reply(
      ctx,
      `📋 *Top ${top.length} Candidates*\n\n${lines.join("\n\n")}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await reply(ctx, `❌ Scan failed: ${msg}`);
  }
}

async function handleBuy(ctx: Context): Promise<void> {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const parts = text.trim().split(/\s+/);
  // /buy SYMBOL [USD]
  if (parts.length < 2) {
    await reply(ctx, "Usage: `/buy SYMBOL [USD]`");
    return;
  }
  const symbol = parts[1].toUpperCase();

  // Scan to find the candidate
  await reply(ctx, `🔍 Looking up ${symbol}…`);
  try {
    const candidates = await scanCandidates();
    const match = candidates.find(
      (c) => c.symbol.toUpperCase() === symbol
    );
    if (!match) {
      await reply(
        ctx,
        `❌ *${symbol}* not found in current scan results. Try /scan first.`
      );
      return;
    }
    const result = await simulateBuy(match);
    if (result.ok && result.trade) {
      await reply(
        ctx,
        `✅ Paper BUY *${symbol}*\n` +
          `Price: $${result.trade.priceUsd.toFixed(6)}\n` +
          `Amount: ${fmtUsd(result.trade.valueUsd)}\n` +
          `Units: ${result.trade.units.toFixed(4)}`
      );
    } else {
      await reply(ctx, `❌ Buy failed: ${result.reason}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await reply(ctx, `❌ Error: ${msg}`);
  }
}

async function handleSell(ctx: Context): Promise<void> {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await reply(ctx, "Usage: `/sell SYMBOL`");
    return;
  }
  const symbol = parts[1].toUpperCase();

  const positions = getPositions();
  const pos = positions.find((p) => p.symbol.toUpperCase() === symbol);
  if (!pos) {
    await reply(ctx, `❌ No open position for *${symbol}*`);
    return;
  }

  try {
    const result = await simulateSell(pos.address, "telegram-manual");
    if (result.ok && result.trade) {
      const pnl = result.pnlUsd ?? 0;
      const emoji = pnl >= 0 ? "✅" : "🔻";
      await reply(
        ctx,
        `${emoji} Paper SELL *${symbol}*\n` +
          `Price: $${result.trade.priceUsd.toFixed(6)}\n` +
          `Proceeds: ${fmtUsd(result.trade.valueUsd)}\n` +
          `PnL: ${fmtUsd(pnl)}`
      );
    } else {
      await reply(ctx, `❌ Sell failed: ${result.reason}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await reply(ctx, `❌ Error: ${msg}`);
  }
}

async function handleWatch(ctx: Context): Promise<void> {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await reply(ctx, "Usage: `/watch WALLET_ADDRESS`");
    return;
  }
  const address = parts[1].trim();
  // Solana addresses are Base58-encoded, typically 32–44 characters
  if (address.length < 32 || address.length > 44) {
    await reply(ctx, "❌ Invalid wallet address (expected 32–44 characters).");
    return;
  }

  const wallet: WatchedWallet = {
    address,
    label: parts[2] ?? undefined,
    addedAt: Date.now(),
  };
  const added = addWatchedWallet(wallet);
  if (added) {
    await reply(ctx, `👀 Now watching wallet:\n\`${address}\``);
  } else {
    await reply(ctx, `ℹ️ Already watching \`${address}\``);
  }
}

async function handleWatches(ctx: Context): Promise<void> {
  const wallets = getWatchedWallets();
  if (wallets.length === 0) {
    await reply(
      ctx,
      "📭 No wallets being watched. Use `/watch ADDRESS` to add one."
    );
    return;
  }
  const lines = wallets.map(
    (w, i) =>
      `${i + 1}. \`${w.address}\`` +
      (w.label ? ` (${w.label})` : "") +
      `\n   Added: ${new Date(w.addedAt).toISOString()}`
  );
  await reply(ctx, `👀 *Watched Wallets*\n\n${lines.join("\n\n")}`);
}

// ── Launch / stop ─────────────────────────────────────────────────────────────

export function launchTelegramBot(): Telegraf | null {
  const token = config.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.info("[telegram] TELEGRAM_BOT_TOKEN not set – bot disabled.");
    return null;
  }

  bot = new Telegraf(token);

  bot.command("start", handleStart);
  bot.command("help", handleStart);
  bot.command("status", handleStatus);
  bot.command("positions", handlePositions);
  bot.command("cash", handleCash);
  bot.command("scan", handleScan);
  bot.command("buy", handleBuy);
  bot.command("sell", handleSell);
  bot.command("watch", handleWatch);
  bot.command("watches", handleWatches);

  bot.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[telegram] Unhandled error: ${msg}`);
  });

  bot.launch().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[telegram] Launch failed: ${msg}`);
  });

  console.info("[telegram] Bot launched.");
  return bot;
}

export function stopTelegramBot(): void {
  if (bot) {
    bot.stop("SIGTERM");
    bot = null;
  }
}
