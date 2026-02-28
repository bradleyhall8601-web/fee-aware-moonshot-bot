import axios from 'axios';
import { JupiterQuote } from './types';
import { env } from './env';
import { logger } from './logger';

/** SOL mint address (wrapped SOL) */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Fetch a Jupiter v6 swap quote.
 * @param inputMint  - Source token mint
 * @param outputMint - Destination token mint
 * @param amountLamports - Amount in smallest denomination (lamports for SOL, base units for SPL)
 * @returns Quote or null on failure
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
): Promise<JupiterQuote | null> {
  try {
    const url =
      `${env.JUPITER_API_URL}/quote` +
      `?inputMint=${inputMint}` +
      `&outputMint=${outputMint}` +
      `&amount=${amountLamports}` +
      `&slippageBps=${env.SLIPPAGE_BPS}`;

    const res = await axios.get<JupiterQuote>(url, { timeout: 10_000 });
    return res.data;
  } catch (err) {
    logger.warn({ err, inputMint, outputMint }, 'Jupiter getQuote failed');
    return null;
  }
}

/** Returns true if the price impact is within the configured threshold. */
export function isPriceImpactAcceptable(quote: JupiterQuote): boolean {
  return (quote.priceImpactPct ?? 0) <= env.MAX_PRICE_IMPACT_PCT;
}

/**
 * Calculate the effective fee cost in USD given a price impact percentage and trade size.
 * This is used for paper-trade accounting — we deduct this from realized PnL.
 */
export function estimateFeeCostUsd(sizeUsd: number, priceImpactPct: number): number {
  // Price impact + a flat 0.1% DEX fee assumption
  const DEX_FEE_PCT = 0.1;
  return sizeUsd * ((priceImpactPct + DEX_FEE_PCT) / 100);
}
