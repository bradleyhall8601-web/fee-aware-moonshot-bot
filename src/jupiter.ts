import axios from "axios";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { withRetry } from "./utils/retry.js";

const client = axios.create({
  baseURL: config.QUOTE_API_BASE,
  timeout: 15_000,
});

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: unknown[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface SwapInstructionsRequest {
  quoteResponse: JupiterQuote;
  userPublicKey: string;
  /**
   * Priority fee in lamports.
   * - Provide a `number` to set an explicit fixed fee in lamports.
   * - Provide the object form to let Jupiter auto-set the fee at a
   *   given priority level (e.g. "medium", "high", "veryHigh") up to
   *   a `maxLamports` cap.
   * Leave undefined to skip priority fees.
   */
  prioritizationFeeLamports?: number | { priorityLevelWithMaxLamports: { maxLamports: number; priorityLevel: string } };
  dynamicComputeUnitLimit?: boolean;
  asLegacyTransaction?: boolean;
}

export interface SwapInstructionsResponse {
  tokenLedgerInstruction?: unknown;
  computeBudgetInstructions: unknown[];
  setupInstructions: unknown[];
  swapInstruction: unknown;
  cleanupInstruction?: unknown;
  addressLookupTableAddresses: string[];
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  simulationError?: string | null;
}

/**
 * Get a swap quote from Jupiter.
 * @param inputMint  - input token mint address
 * @param outputMint - output token mint address
 * @param amountLamports - input amount in lamports (smallest unit)
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: bigint
): Promise<JupiterQuote> {
  logger.debug({ inputMint, outputMint, amountLamports: String(amountLamports) }, "Jupiter getQuote");
  return withRetry(async () => {
    const res = await client.get<JupiterQuote>("/quote", {
      params: {
        inputMint,
        outputMint,
        amount: String(amountLamports),
        slippageBps: config.SLIPPAGE_BPS,
      },
    });
    return res.data;
  });
}

/**
 * Get swap instructions from Jupiter for a previously obtained quote.
 */
export async function getSwapInstructions(
  quoteResponse: JupiterQuote,
  userPublicKey: string
): Promise<SwapInstructionsResponse> {
  logger.debug({ userPublicKey }, "Jupiter getSwapInstructions");
  const body: SwapInstructionsRequest = {
    quoteResponse,
    userPublicKey,
    dynamicComputeUnitLimit: true,
  };

  if (config.PRIORITY_FEE_MICRO_LAMPORTS !== undefined) {
    body.prioritizationFeeLamports = config.PRIORITY_FEE_MICRO_LAMPORTS;
  }

  return withRetry(async () => {
    const res = await client.post<SwapInstructionsResponse>(
      "/swap-instructions",
      body
    );
    return res.data;
  });
}

/** Convert a Jupiter quote to an estimated fee in SOL (rough estimate). */
export function estimateJupiterFeeSol(quote: JupiterQuote): number {
  if (quote.platformFee) {
    // platform fee is in input token units; approximate to SOL
    return Number(quote.platformFee.amount) / 1e9;
  }
  return 0;
}

/** Price impact as a decimal (e.g. 0.005 = 0.5%). */
export function getPriceImpact(quote: JupiterQuote): number {
  return parseFloat(quote.priceImpactPct) / 100;
}
