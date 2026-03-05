import fs from "node:fs";
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";
import { env } from "./env";

function loadSecretFromPath(path: string): Uint8Array {
  const raw = fs.readFileSync(path, "utf8").trim();
  const parsed = JSON.parse(raw) as number[];
  return Uint8Array.from(parsed);
}

export function getWalletKeypair(): Keypair | null {
  if (env.WALLET_PRIVATE_KEY) {
    try {
      return Keypair.fromSecretKey(bs58.decode(env.WALLET_PRIVATE_KEY));
    } catch {
      return null;
    }
  }

  if (env.WALLET_KEYPAIR_PATH) {
    try {
      return Keypair.fromSecretKey(loadSecretFromPath(env.WALLET_KEYPAIR_PATH));
    } catch {
      return null;
    }
  }

  return null;
}

export function getWalletPubkey(): PublicKey {
  const keypair = getWalletKeypair();
  if (keypair) {
    return keypair.publicKey;
  }

  if (env.WALLET_PUBKEY) {
    return new PublicKey(env.WALLET_PUBKEY);
  }

  throw new Error("WALLET_PUBKEY, WALLET_PRIVATE_KEY, or WALLET_KEYPAIR_PATH is required");
}
