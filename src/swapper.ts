import { createJupiterApiClient, QuoteResponse } from "@jup-ag/api";
import { Connection, Keypair, TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import { config } from "./config";
import { env } from "./env";
import { logger } from "./logger";

const jupiter = createJupiterApiClient({ basePath: env.JUPITER_API_URL });

function fakeDryRunSignature(): TransactionSignature {
  return `DRYRUN_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  inAmountLamports: number,
  slippageBps = config.slippageBps
): Promise<QuoteResponse> {
  return jupiter.quoteGet({
    inputMint,
    outputMint,
    amount: inAmountLamports,
    slippageBps
  }) as Promise<QuoteResponse>;
}

export function isPriceImpactAcceptable(quote: QuoteResponse): boolean {
  const priceImpact = Number(quote.priceImpactPct ?? 0);
  return Number.isFinite(priceImpact) && priceImpact <= config.maxPriceImpactPct;
}

export async function executeSwapFromQuote(
  quote: QuoteResponse,
  payerKeypair: Keypair,
  rpcEndpoint: string,
  jupiterApiUrl: string,
  slippageBps: number
): Promise<string | null> {
  if (!isPriceImpactAcceptable(quote)) {
    const priceImpact = Number(quote.priceImpactPct ?? 0);
    throw new Error(`Swap blocked by price impact gate: ${priceImpact.toFixed(2)}%`);
  }

  if (env.DRY_RUN) {
    const signature = fakeDryRunSignature();
    logger.info(
      {
        mint: quote.outputMint,
        inAmount: quote.inAmount
      },
      "DRY_RUN: would submit swap"
    );
    return signature;
  }

  const client = createJupiterApiClient({ basePath: jupiterApiUrl });
  const swapPayload = await client.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: payerKeypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true
    }
  });

  if (!swapPayload.swapTransaction) {
    throw new Error("Jupiter returned empty swap transaction");
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapPayload.swapTransaction, "base64"));
  tx.sign([payerKeypair]);

  const connection = new Connection(rpcEndpoint, "confirmed");
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });
  const blockhash = await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight
    },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(`Swap confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  logger.info({ signature }, "Live swap confirmed");
  return signature;
}

export async function executeSwap(
  inputMint: string,
  outputMint: string,
  inAmountLamports: number,
  slippageBps: number,
  payerKeypair: Keypair,
  rpcEndpoint: string,
  jupiterApiUrl: string
): Promise<{ signature: string; outAmount?: string }> {
  const quote = await getQuote(inputMint, outputMint, inAmountLamports, slippageBps);
  const signature = await executeSwapFromQuote(quote, payerKeypair, rpcEndpoint, jupiterApiUrl, slippageBps);
  if (!signature) {
    throw new Error("Swap signature missing");
  }
  return { signature, outAmount: quote.outAmount };
}
