// src/jupiter-aggregator.ts
// Jupiter swap execution for live trading

import axios from 'axios';
import telemetryLogger from './telemetry';

const JUPITER_API = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
  slippageBps: number;
}

export interface SwapResult {
  success: boolean;
  txSignature?: string;
  inputAmount: number;
  outputAmount: number;
  priceImpactPct: number;
  error?: string;
}

class JupiterAggregator {
  async getQuote(
    inputMint: string,
    outputMint: string,
    amountLamports: number,
    slippageBps = 100
  ): Promise<JupiterQuote | null> {
    try {
      const res = await axios.get(`${JUPITER_API}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount: amountLamports,
          slippageBps,
          onlyDirectRoutes: false,
          asLegacyTransaction: false,
        },
        timeout: 10000,
      });
      return res.data;
    } catch (err) {
      telemetryLogger.warn(`Jupiter quote failed: ${inputMint} -> ${outputMint}`, 'jupiter');
      return null;
    }
  }

  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string
  ): Promise<string | null> {
    try {
      const res = await axios.post(
        `${JUPITER_API}/swap`,
        {
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        },
        { timeout: 15000 }
      );
      return res.data?.swapTransaction || null;
    } catch (err) {
      telemetryLogger.warn('Jupiter swap transaction failed', 'jupiter');
      return null;
    }
  }

  async getPriceImpact(
    inputMint: string,
    outputMint: string,
    amountLamports: number
  ): Promise<number> {
    const quote = await this.getQuote(inputMint, outputMint, amountLamports);
    if (!quote) return 999;
    return parseFloat(quote.priceImpactPct) * 100;
  }

  async buyToken(
    tokenMint: string,
    solAmountLamports: number,
    walletPublicKey: string,
    slippageBps = 100
  ): Promise<SwapResult> {
    const quote = await this.getQuote(SOL_MINT, tokenMint, solAmountLamports, slippageBps);
    if (!quote) {
      return { success: false, inputAmount: 0, outputAmount: 0, priceImpactPct: 0, error: 'Quote failed' };
    }

    const priceImpact = parseFloat(quote.priceImpactPct) * 100;
    const maxImpact = parseFloat(process.env.MAX_PRICE_IMPACT_PCT || '5');
    if (priceImpact > maxImpact) {
      return { success: false, inputAmount: 0, outputAmount: 0, priceImpactPct: priceImpact, error: `Price impact too high: ${priceImpact.toFixed(2)}%` };
    }

    // In production, sign and send the transaction here
    // For now, return the quote details (actual execution requires keypair)
    telemetryLogger.info(`[LIVE] Jupiter BUY quote: ${solAmountLamports / 1e9} SOL -> ${parseInt(quote.outAmount) / 1e6} tokens, impact=${priceImpact.toFixed(2)}%`, 'jupiter');

    return {
      success: true,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpactPct: priceImpact,
    };
  }

  async sellToken(
    tokenMint: string,
    tokenAmountRaw: number,
    walletPublicKey: string,
    slippageBps = 1200
  ): Promise<SwapResult> {
    const quote = await this.getQuote(tokenMint, SOL_MINT, tokenAmountRaw, slippageBps);
    if (!quote) {
      return { success: false, inputAmount: 0, outputAmount: 0, priceImpactPct: 0, error: 'Quote failed' };
    }

    const priceImpact = parseFloat(quote.priceImpactPct) * 100;
    telemetryLogger.info(`[LIVE] Jupiter SELL quote: ${tokenAmountRaw} tokens -> ${parseInt(quote.outAmount) / 1e9} SOL, impact=${priceImpact.toFixed(2)}%`, 'jupiter');

    return {
      success: true,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpactPct: priceImpact,
    };
  }
}

export default new JupiterAggregator();
