import axios from "axios";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { RateLimiter } from "./utils/rateLimit.js";
import { withRetry } from "./utils/retry.js";
import { DexPair } from "./positions/types.js";

const limiter = new RateLimiter(config.DEXSCREENER_RATE_LIMIT_RPM);

const client = axios.create({
  baseURL: config.DEXSCREENER_BASE,
  timeout: 10_000,
});

/** Fetch all Solana pairs for a given token address. */
export async function fetchTokenPairs(tokenAddress: string): Promise<DexPair[]> {
  await limiter.acquire();
  const url = `/token-pairs/v1/solana/${tokenAddress}`;
  logger.debug({ url }, "DexScreener fetchTokenPairs");
  return withRetry(async () => {
    const res = await client.get<{ pairs: DexPair[] | null }>(url);
    return res.data.pairs ?? [];
  });
}

/** Search DexScreener for pairs matching a query string. */
export async function searchPairs(query: string): Promise<DexPair[]> {
  await limiter.acquire();
  const url = `/latest/dex/search`;
  logger.debug({ url, query }, "DexScreener search");
  return withRetry(async () => {
    const res = await client.get<{ pairs: DexPair[] | null }>(url, {
      params: { q: query },
    });
    return (res.data.pairs ?? []).filter((p) => p.chainId === "solana");
  });
}

/**
 * Discovery strategy:
 * 1. If WATCHLIST_MINTS is set, fetch each mint's pairs.
 * 2. Otherwise run multiple keyword searches and merge unique pairs.
 */
export async function discoverCandidates(): Promise<DexPair[]> {
  const seen = new Set<string>();
  const results: DexPair[] = [];

  function merge(pairs: DexPair[]) {
    for (const p of pairs) {
      if (!seen.has(p.pairAddress)) {
        seen.add(p.pairAddress);
        results.push(p);
      }
    }
  }

  const watchlist = config.WATCHLIST_MINTS
    ? config.WATCHLIST_MINTS.split(",").map((m) => m.trim()).filter(Boolean)
    : [];

  if (watchlist.length > 0) {
    for (const mint of watchlist) {
      try {
        const pairs = await fetchTokenPairs(mint);
        merge(pairs);
      } catch (err) {
        logger.warn({ mint, err }, "Failed to fetch watchlist mint");
      }
    }
  } else {
    // Broad keyword search fallback
    const keywords = ["SOL", "USDC", "Raydium", "meme", "pump"];
    for (const kw of keywords) {
      try {
        const pairs = await searchPairs(kw);
        merge(pairs);
      } catch (err) {
        logger.warn({ kw, err }, "Failed keyword search");
      }
    }
  }

  logger.info({ count: results.length }, "Discovered candidate pairs");
  return results;
}
