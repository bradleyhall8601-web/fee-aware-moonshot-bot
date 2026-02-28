import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { SwapInstructionsResponse } from "./jupiter.js";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(config.SOLANA_RPC_URL, "confirmed");
  }
  return _connection;
}

/**
 * Load keypair from WALLET_PRIVATE_KEY env var.
 * Supports both base58 string and JSON array formats.
 * NEVER logs the private key.
 */
export function loadKeypair(): Keypair {
  const raw = config.WALLET_PRIVATE_KEY;
  if (!raw) {
    throw new Error("WALLET_PRIVATE_KEY is not set");
  }
  try {
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (err) {
    throw new Error(`Failed to parse WALLET_PRIVATE_KEY: ${String(err)}`);
  }
}

/** Estimate network fee in SOL (conservative constant if RPC fails). */
export async function estimateNetworkFeeSol(): Promise<number> {
  try {
    const conn = getConnection();
    const { feeCalculator } = await conn.getRecentBlockhash();
    return (feeCalculator.lamportsPerSignature * 3) / 1e9;
  } catch {
    return 0.000005; // ~5000 lamports conservative estimate
  }
}

/** Get SOL balance for a wallet. */
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  const conn = getConnection();
  const lamports = await conn.getBalance(publicKey);
  return lamports / 1e9;
}

/**
 * Build a VersionedTransaction from Jupiter swap instructions and send it.
 * Returns the transaction signature.
 */
export async function buildAndSendSwap(
  swapInstructions: SwapInstructionsResponse,
  keypair: Keypair
): Promise<string> {
  const conn = getConnection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");

  // Deserialize instructions
  const deserializeInstruction = (ix: unknown): TransactionInstruction => {
    const i = ix as {
      programId: string;
      accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
      data: string;
    };
    return new TransactionInstruction({
      programId: new PublicKey(i.programId),
      keys: i.accounts.map(
        (a): AccountMeta => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        })
      ),
      data: Buffer.from(i.data, "base64"),
    });
  };

  const instructions: TransactionInstruction[] = [
    ...swapInstructions.computeBudgetInstructions.map(deserializeInstruction),
    ...swapInstructions.setupInstructions.map(deserializeInstruction),
    deserializeInstruction(swapInstructions.swapInstruction),
  ];

  if (swapInstructions.cleanupInstruction) {
    instructions.push(deserializeInstruction(swapInstructions.cleanupInstruction));
  }

  // Fetch address lookup tables
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  for (const address of swapInstructions.addressLookupTableAddresses) {
    const altResult = await conn.getAddressLookupTable(new PublicKey(address));
    if (altResult.value) {
      addressLookupTableAccounts.push(altResult.value);
    }
  }

  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(addressLookupTableAccounts);

  const tx = new VersionedTransaction(message);
  tx.sign([keypair]);

  logger.info({ publicKey: keypair.publicKey.toBase58() }, "Sending transaction");
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  logger.info({ sig }, "Transaction sent, awaiting confirmation");
  const latestBlockhash = await conn.getLatestBlockhash("confirmed");
  await conn.confirmTransaction(
    { signature: sig, ...latestBlockhash },
    "confirmed"
  );
  logger.info({ sig }, "Transaction confirmed");
  return sig;
}
