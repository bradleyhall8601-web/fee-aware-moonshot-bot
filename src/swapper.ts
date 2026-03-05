import { createJupiterApiClient, QuoteResponse } from "@jup-ag/api";
import { TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import { config } from "./config";
import { env } from "./env";
import { logger } from "./logger";
import { getConnection } from "./rpc";
import { getWalletKeypair } from "./wallet";

const jupiter = createJupiterApiClient({ basePath: env.JUPITER_API_URL });

function fakeDryRunSignature(): TransactionSignature {
  return `DRYRUN_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  inAmountLamports: number,
  slippageBps: number
): Promise<QuoteResponse> {
  return jupiter.quoteGet({
    inputMint,
    outputMint,
    amount: inAmountLamports,
    slippageBps
  }) as Promise<QuoteResponse>;
}

export async function executeSwap(
  inputMint: string,
  outputMint: string,
  inAmountLamports: number,
  slippageBps: number
): Promise<{ signature: string; outAmount?: string }> {
  const wallet = getWalletKeypair();
  if (!wallet) {
    logger.warn("Live swap blocked: wallet is monitor-only (no keypair)");
    throw new Error("Live swap requires WALLET_PRIVATE_KEY or WALLET_KEYPAIR_PATH");
  }

  const quote = await getQuote(inputMint, outputMint, inAmountLamports, slippageBps);
  const priceImpact = Number(quote.priceImpactPct ?? 0);
  if (priceImpact > config.maxPriceImpactPct) {
    throw new Error(`Swap blocked by price impact gate: ${priceImpact.toFixed(2)}%`);
  }

  const swapPayload = await jupiter.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true
    }
  });

  if (!swapPayload.swapTransaction) {
    throw new Error("Jupiter returned empty swap transaction");
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapPayload.swapTransaction, "base64"));
  tx.sign([wallet]);

  if (config.dryRun) {
    const simulation = await getConnection().simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true
    });
    if (simulation.value.err) {
      throw new Error(`Dry-run simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const signature = fakeDryRunSignature();
    logger.info({ signature, inputMint, outputMint, inAmountLamports }, "DRY_RUN swap simulated");
    return { signature, outAmount: quote.outAmount };
  }

  const signature = await getConnection().sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });
  const blockhash = await getConnection().getLatestBlockhash("confirmed");
  const confirmation = await getConnection().confirmTransaction(
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
  return { signature, outAmount: quote.outAmount };
}
