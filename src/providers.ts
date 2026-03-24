// src/providers.ts
// Data providers: DexScreener, Helius RPC, RugCheck, and whale-signal scaffold.

import axios from "axios";
import { config } from "./config";
import { DexScreenerPair, TokenCandidate, WhaleSignal } from "./types";

// ── DexScreener ───────────────────────────────────────────────────────────────

/**
 * Fetch top Solana meme-coin pairs from DexScreener.
 * Returns the raw pair list; filtering happens in strategy.ts.
 */
export async function fetchDexScreenerPairs(
  query = "solana"
): Promise<DexScreenerPair[]> {
  try {
    const url = `${config.DEXSCREENER_BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get<{ pairs: DexScreenerPair[] | null }>(url, {
      timeout: 10_000,
    });
    return res.data?.pairs ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[providers] DexScreener fetch failed: ${msg}`);
    return [];
  }
}

/**
 * Fetch current price for a single token from DexScreener.
 * Returns null if unavailable.
 */
export async function fetchTokenPrice(
  tokenAddress: string
): Promise<number | null> {
  try {
    const url = `${config.DEXSCREENER_BASE_URL}/latest/dex/tokens/${tokenAddress}`;
    const res = await axios.get<{ pairs: DexScreenerPair[] | null }>(url, {
      timeout: 8_000,
    });
    const pairs = res.data?.pairs;
    if (!pairs || pairs.length === 0) return null;
    const best = pairs.find((p) => p.chainId === "solana") ?? pairs[0];
    return best?.priceUsd ? parseFloat(best.priceUsd) : null;
  } catch {
    return null;
  }
}

// ── Helius ────────────────────────────────────────────────────────────────────

/**
 * Perform a lightweight Helius health-check (getHealth JSON-RPC call).
 * Returns true if the RPC responds successfully.
 */
export async function heliusHealthCheck(): Promise<boolean> {
  try {
    const url = config.HELIUS_RPC_URL;
    const res = await axios.post<{ result?: string }>(
      url,
      { jsonrpc: "2.0", id: 1, method: "getHealth" },
      { timeout: 8_000 }
    );
    return res.data?.result === "ok";
  } catch {
    return false;
  }
}

/**
 * Fetch token metadata via Helius DAS API.
 * Returns null if HELIUS_API_KEY is not set or request fails.
 */
export async function fetchTokenMetadata(
  mintAddress: string
): Promise<Record<string, unknown> | null> {
  if (!config.HELIUS_API_KEY) return null;
  try {
    const url = `https://api.helius.xyz/v0/token-metadata?api-key=${config.HELIUS_API_KEY}`;
    const res = await axios.post<unknown[]>(
      url,
      { mintAccounts: [mintAddress], includeOffChain: true, disableCache: false },
      { timeout: 10_000 }
    );
    const data = res.data;
    return Array.isArray(data) && data.length > 0
      ? (data[0] as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ── RugCheck ──────────────────────────────────────────────────────────────────

/**
 * Fetch rug-check risk score for a token.
 * Returns a score 0–100 (lower = safer), or null on failure.
 */
export async function fetchRugScore(
  mintAddress: string
): Promise<number | null> {
  try {
    const url = `${config.RUGCHECK_BASE_URL}/tokens/${mintAddress}/report/summary`;
    const res = await axios.get<{ score?: number }>(url, { timeout: 8_000 });
    return res.data?.score ?? null;
  } catch {
    return null;
  }
}

// ── Whale Signal Scaffold ─────────────────────────────────────────────────────
//
// TODO: Replace the stub below with real on-chain parsing when a WebSocket
//       feed or Helius webhook is available.
// TODO: Integrate Helius enhanced transactions API to detect large swaps.
// TODO: Parse Jupiter swap instructions to identify whale buys/sells.
// TODO: Add Telegram notifications for whale signals above threshold.

/**
 * Returns simulated whale signals for watched wallets.
 * This is a stub – it always returns an empty array until real
 * on-chain parsing is wired up.
 */
export async function fetchWhaleSignals(
  walletAddresses: string[]
): Promise<WhaleSignal[]> {
  if (walletAddresses.length === 0) return [];
  // TODO: Query Helius enhanced transactions for each watched wallet.
  // Example endpoint: GET https://api.helius.xyz/v0/addresses/{address}/transactions
  return [];
}

// ── DexScreener helper ────────────────────────────────────────────────────────

/**
 * Converts a raw DexScreener pair to a TokenCandidate.
 */
export function pairToCandidate(pair: DexScreenerPair): TokenCandidate {
  const buys = pair.txns?.m5?.buys ?? pair.txns?.h1?.buys ?? 0;
  const sells = pair.txns?.m5?.sells ?? pair.txns?.h1?.sells ?? 1;
  return {
    address: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : 0,
    liquidityUsd: pair.liquidity?.usd ?? 0,
    volumeUsd24h: pair.volume?.h24 ?? 0,
    buySellRatio: sells > 0 ? buys / sells : buys > 0 ? 2 : 1,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    chainId: pair.chainId,
    confidence: 0, // scored later
    fdv: pair.fdv,
    priceChange5m: pair.priceChange?.m5,
    priceChange1h: pair.priceChange?.h1,
    txns5m: pair.txns?.m5,
  };
}
