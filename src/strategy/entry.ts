import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { DexPair, Position, Trade } from "../positions/types.js";
import { upsertPosition, recordTrade } from "../positions/store.js";
import { getQuote, getSwapInstructions, estimateJupiterFeeSol, getPriceImpact } from "../jupiter.js";
import { loadKeypair, buildAndSendSwap, estimateNetworkFeeSol } from "../solana.js";

/** SOL mint address */
const SOL_LAMPORTS = 1e9;

/**
 * Compute all-in cost in SOL for a trade, logging details.
 */
async function computeAllInCost(feeSol: number, priorityFeeSol: number): Promise<number> {
  const networkFee = await estimateNetworkFeeSol();
  const total = networkFee + priorityFeeSol + feeSol;
  logger.info(
    { networkFee, priorityFeeSol, jupiterFee: feeSol, totalFeeSol: total },
    "All-in fee estimate"
  );
  return total;
}

/**
 * Enter a position for the given pair.
 * In paper mode: simulates fill at DexScreener price.
 * In live mode: executes swap via Jupiter + Solana RPC.
 */
export async function enterPosition(pair: DexPair): Promise<Position | null> {
  const tokenMint = pair.baseToken.address;
  const tokenSymbol = pair.baseToken.symbol;
  const priceUsd = parseFloat(pair.priceUsd ?? "0");

  if (priceUsd <= 0) {
    logger.warn({ pair: pair.pairAddress }, "Cannot enter: priceUsd is 0");
    return null;
  }

  const sizeSol = config.POSITION_SIZE_SOL;
  const amountLamports = BigInt(Math.round(sizeSol * SOL_LAMPORTS));

  let feeSol = 0;
  let tokenAmount = 0;
  let txSig: string | undefined;

  if (!config.ENABLE_LIVE_TRADING) {
    // ── Paper mode ──────────────────────────────────────────────────
    // Simulate token amount with slippage
    const slippageMultiplier = 1 - config.SLIPPAGE_BPS / 10_000;
    // Rough conversion: SOL / priceInSOL = tokens. We approximate using USD price.
    // This is a simulation — actual amounts would depend on SOL/USD price.
    tokenAmount = (sizeSol / priceUsd) * slippageMultiplier * 1e6; // assume 6 decimals
    feeSol = 0.000005; // conservative paper fee estimate
    logger.info(
      { tokenSymbol, sizeSol, tokenAmount, feeSol },
      "[PAPER] Simulated entry"
    );
  } else {
    // ── Live mode ───────────────────────────────────────────────────
    try {
      const quote = await getQuote(config.INPUT_MINT, tokenMint, amountLamports);
      const priceImpact = getPriceImpact(quote);
      if (priceImpact > 0.05) {
        logger.warn({ priceImpact }, "Price impact too high, skipping entry");
        return null;
      }

      const jupiterFee = estimateJupiterFeeSol(quote);
      const priorityFeeSol = (config.PRIORITY_FEE_MICRO_LAMPORTS ?? 0) / 1e12;
      await computeAllInCost(jupiterFee, priorityFeeSol);

      const keypair = loadKeypair();
      const swapIx = await getSwapInstructions(quote, keypair.publicKey.toBase58());
      txSig = await buildAndSendSwap(swapIx, keypair);

      tokenAmount = Number(quote.outAmount);
      feeSol = jupiterFee + priorityFeeSol;
    } catch (err) {
      logger.error({ err }, "Live entry failed");
      return null;
    }
  }

  const now = Date.now();
  const posId = uuidv4();
  const position: Position = {
    id: posId,
    tokenMint,
    tokenSymbol,
    pairAddress: pair.pairAddress,
    entryPrice: priceUsd,
    entryTime: now,
    sizeSol,
    tokenAmount,
    entryTxSig: txSig,
    currentPrice: priceUsd,
    peakPrice: priceUsd,
    halfSold: false,
    remainingTokenAmount: tokenAmount,
    status: "open",
    paper: !config.ENABLE_LIVE_TRADING,
  };

  upsertPosition(position);

  const trade: Trade = {
    id: uuidv4(),
    positionId: posId,
    tokenMint,
    tokenSymbol,
    pairAddress: pair.pairAddress,
    type: "buy",
    price: priceUsd,
    sizeSol,
    tokenAmount,
    time: now,
    txSig,
    feeSol,
    paper: !config.ENABLE_LIVE_TRADING,
  };
  recordTrade(trade);

  logger.info(
    { tokenSymbol, positionId: posId, priceUsd, sizeSol, paper: position.paper },
    "Position opened"
  );
  return position;
}
