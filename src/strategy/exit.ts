import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { DexPair, Position, Trade } from "../positions/types.js";
import { upsertPosition, recordTrade } from "../positions/store.js";
import { getQuote, getSwapInstructions } from "../jupiter.js";
import { loadKeypair, buildAndSendSwap } from "../solana.js";

export type ExitReason =
  | "stop_loss"
  | "take_profit_half"
  | "runner_trail_stop"
  | "momentum_exit"
  | "manual";

export interface ExitDecision {
  action: "none" | "sell_half" | "sell_all";
  reason?: ExitReason;
}

/**
 * Compute current unrealized P&L percentage relative to entry.
 */
export function calcPnlPct(position: Position): number {
  if (position.entryPrice === 0) return 0;
  return ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
}

/**
 * Decide what exit action to take based on current state.
 * Does NOT mutate the position.
 */
export function decideExit(position: Position, pair: DexPair): ExitDecision {
  const pnlPct = calcPnlPct(position);
  const price = position.currentPrice;

  // ── Hard stop loss ───────────────────────────────────────────────
  if (pnlPct <= -config.STOP_LOSS_PCT) {
    return { action: "sell_all", reason: "stop_loss" };
  }

  // ── Take-profit partial sell (only if not already done) ──────────
  if (!position.halfSold && pnlPct >= config.TAKE_PROFIT_LOCK_PCT) {
    return { action: "sell_half", reason: "take_profit_half" };
  }

  // ── Runner management (post half-sell) ──────────────────────────
  if (position.halfSold) {
    // Trailing stop from peak
    const trailPct =
      ((position.peakPrice - price) / position.peakPrice) * 100;
    if (trailPct >= config.RUNNER_TRAIL_STOP_PCT) {
      return { action: "sell_all", reason: "runner_trail_stop" };
    }

    // Momentum exit: 5m price red
    if (config.MOMENTUM_EXIT_IF_5M_RED) {
      const change5m = pair.priceChange?.m5 ?? 0;
      if (change5m <= 0) {
        return { action: "sell_all", reason: "momentum_exit" };
      }
    }
  }

  return { action: "none" };
}

/**
 * Execute a sell (paper or live) and update the position.
 */
async function executeSell(
  position: Position,
  fraction: number, // 0..1, portion of remainingTokenAmount to sell
  reason: ExitReason,
  isFinalSell: boolean
): Promise<void> {
  const tokenAmount = Math.floor(position.remainingTokenAmount * fraction);
  const price = position.currentPrice;
  const tokenMint = position.tokenMint;
  let txSig: string | undefined;
  let feeSol = 0.000005;

  if (config.ENABLE_LIVE_TRADING) {
    try {
      const amountUnits = BigInt(tokenAmount);
      const quote = await getQuote(tokenMint, config.INPUT_MINT, amountUnits);
      const keypair = loadKeypair();
      const swapIx = await getSwapInstructions(quote, keypair.publicKey.toBase58());
      txSig = await buildAndSendSwap(swapIx, keypair);
      feeSol = 0.000005;
    } catch (err) {
      logger.error({ err, reason }, "Live sell failed");
      return;
    }
  }

  const now = Date.now();
  const tradeType = isFinalSell ? "sell_all" : "sell_half";
  const sizeSol = (tokenAmount / position.tokenAmount) * position.sizeSol;

  const trade: Trade = {
    id: uuidv4(),
    positionId: position.id,
    tokenMint,
    tokenSymbol: position.tokenSymbol,
    pairAddress: position.pairAddress,
    type: tradeType,
    price,
    sizeSol,
    tokenAmount,
    time: now,
    txSig,
    feeSol,
    paper: !config.ENABLE_LIVE_TRADING,
  };
  recordTrade(trade);

  // Update position in-place
  if (tradeType === "sell_half") {
    position.halfSold = true;
    position.halfSoldPrice = price;
    position.halfSoldTime = now;
    position.halfSoldTxSig = txSig;
    position.remainingTokenAmount = position.remainingTokenAmount - tokenAmount;
    upsertPosition(position);
    logger.info(
      {
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        reason,
        price,
        pnlPct: calcPnlPct(position).toFixed(2),
      },
      "Sold 50% to lock profit"
    );
  } else {
    position.status = "closed";
    position.closeReason = reason;
    position.closedPrice = price;
    position.closedTime = now;
    position.closeTxSig = txSig;

    // Compute total realized P&L, including any prior partial sell proceeds.
    const totalOriginalTokens = position.tokenAmount;
    const alreadySoldFraction =
      totalOriginalTokens > 0
        ? 1 - position.remainingTokenAmount / totalOriginalTokens
        : 0;
    const halfSoldProceeds =
      position.halfSold && position.halfSoldPrice != null
        ? alreadySoldFraction * position.sizeSol * (position.halfSoldPrice / position.entryPrice)
        : 0;
    const finalFraction =
      totalOriginalTokens > 0 ? position.remainingTokenAmount / totalOriginalTokens : 0;
    const finalProceeds =
      finalFraction * position.sizeSol * (price / position.entryPrice);
    position.realizedPnlSol = halfSoldProceeds + finalProceeds - position.sizeSol;
    upsertPosition(position);
    logger.info(
      {
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        reason,
        price,
        realizedPnlSol: position.realizedPnlSol?.toFixed(6),
      },
      "Position closed"
    );
  }
}

/**
 * Process exits for a position given the latest DexScreener pair data.
 * Updates the position object in place.
 */
export async function processExit(position: Position, pair: DexPair): Promise<void> {
  const latestPrice = parseFloat(pair.priceUsd ?? String(position.currentPrice));
  position.currentPrice = latestPrice;
  if (latestPrice > position.peakPrice) {
    position.peakPrice = latestPrice;
  }

  const decision = decideExit(position, pair);

  if (decision.action === "none") {
    upsertPosition(position); // persist updated price/peak
    return;
  }

  const sellFraction = config.TAKE_PROFIT_LOCK_SELL_PCT / 100;

  if (decision.action === "sell_half") {
    await executeSell(position, sellFraction, decision.reason!, false);
  } else if (decision.action === "sell_all") {
    await executeSell(position, 1, decision.reason!, true);
  }
}
