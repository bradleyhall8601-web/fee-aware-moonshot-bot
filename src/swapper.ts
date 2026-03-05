import fs from "node:fs/promises";
import { createJupiterApiClient, QuoteResponse } from "@jup-ag/api";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey, TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import { config } from "./config";
import { env } from "./env";
import { logger } from "./logger";
import { SwapExecutionResult } from "./types";

export interface SwapRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
}

export interface LiveTradingContext {
  wallet: Keypair;
  connection: Connection;
  jupiterApi: ReturnType<typeof createJupiterApiClient>;
}

function parsePrivateKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (trimmed.startsWith("[")) {
    const values = JSON.parse(trimmed) as number[];
    return Uint8Array.from(values);
  }
  return bs58.decode(trimmed);
}

export async function loadWalletKeypair(): Promise<Keypair> {
  if (env.WALLET_KEYPAIR_PATH) {
    const raw = await fs.readFile(env.WALLET_KEYPAIR_PATH, "utf8");
    const bytes = parsePrivateKey(raw);
    return Keypair.fromSecretKey(bytes);
  }

  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error("Missing wallet credentials");
  }

  return Keypair.fromSecretKey(parsePrivateKey(env.WALLET_PRIVATE_KEY));
}

export async function createLiveTradingContext(): Promise<LiveTradingContext> {
  const wallet = await loadWalletKeypair();
  const connection = new Connection(env.RPC_URL, "confirmed");
  const jupiterApi = createJupiterApiClient({ basePath: env.JUPITER_API_URL });
  return { wallet, connection, jupiterApi };
}

function fakeDryRunSignature(): TransactionSignature {
  return `DRYRUN_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function executeLiveSwap(
  ctx: LiveTradingContext,
  request: SwapRequest,
  options?: {
    dryRun?: boolean;
    maxPriceImpactPct?: number;
    slippageBps?: number;
    feeUsdEstimate?: number;
  }
): Promise<SwapExecutionResult> {
  const dryRun = options?.dryRun ?? config.dryRun;
  const maxPriceImpactPct = options?.maxPriceImpactPct ?? config.maxPriceImpactPct;
  const slippageBps = options?.slippageBps ?? config.slippageBps;
  const feeUsdEstimate = options?.feeUsdEstimate ?? config.networkFeeUsdEstimate;

  const quoteResponse = await ctx.jupiterApi.quoteGet({
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    amount: Number(request.amount),
    slippageBps
  });

  const priceImpactPct = Number(quoteResponse.priceImpactPct ?? 0);
  if (priceImpactPct > maxPriceImpactPct) {
    throw new Error(
      `Quote price impact ${priceImpactPct.toFixed(2)}% exceeds max ${maxPriceImpactPct.toFixed(2)}%`
    );
  }

  const swapResponse = await ctx.jupiterApi.swapPost({
    swapRequest: {
      quoteResponse: quoteResponse as QuoteResponse,
      userPublicKey: ctx.wallet.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      wrapAndUnwrapSol: true
    }
  });

  if (!swapResponse.swapTransaction) {
    throw new Error("Jupiter swap transaction was empty");
  }

  const txBuffer = Buffer.from(swapResponse.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuffer);
  tx.sign([ctx.wallet]);

  if (dryRun) {
    const simulation = await ctx.connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true
    });
    if (simulation.value.err) {
      throw new Error(`Dry-run simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    const txSig = fakeDryRunSignature();
    logger.info({ txSig }, "Dry-run simulated successfully; transaction not sent");
    return {
      txSig,
      dryRun: true,
      feeUsd: feeUsdEstimate,
      quotePriceImpactPct: priceImpactPct,
      inAmount: quoteResponse.inAmount,
      outAmount: quoteResponse.outAmount
    };
  }

  const txSig = await ctx.connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });
  const latestBlockhash = await ctx.connection.getLatestBlockhash("confirmed");
  const confirmation = await ctx.connection.confirmTransaction(
    {
      signature: txSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(`Swap confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return {
    txSig,
    dryRun: false,
    feeUsd: feeUsdEstimate,
    quotePriceImpactPct: priceImpactPct,
    inAmount: quoteResponse.inAmount,
    outAmount: quoteResponse.outAmount
  };
}
