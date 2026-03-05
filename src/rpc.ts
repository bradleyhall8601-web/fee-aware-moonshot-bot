import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "./config";
import { env } from "./env";

let connection: Connection | undefined;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.RPC_URL, "confirmed");
  }
  return connection;
}

export async function getSolBalance(pubkey: PublicKey): Promise<number> {
  const lamports = await getConnection().getBalance(pubkey, "confirmed");
  return lamports / 1_000_000_000;
}

export async function getSolPriceUsd(): Promise<number> {
  if (env.BIRDEYE_API_KEY) {
    try {
      const response = await axios.get("https://public-api.birdeye.so/defi/price", {
        params: { address: "So11111111111111111111111111111111111111112" },
        headers: {
          "x-api-key": env.BIRDEYE_API_KEY,
          "x-chain": "solana"
        },
        timeout: 10_000
      });
      const value = Number(response.data?.data?.value ?? 0);
      if (value > 0) {
        return value;
      }
    } catch {
      // fall through to fallback providers
    }
  }

  try {
    const response = await axios.get("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112", {
      timeout: 10_000
    });
    const firstPrice = Number(response.data?.pairs?.[0]?.priceUsd ?? 0);
    if (firstPrice > 0) {
      return firstPrice;
    }
  } catch {
    // final fallback below
  }

  return config.solUsdFallback;
}
