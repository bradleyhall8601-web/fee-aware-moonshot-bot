import axios from "axios";
import { config } from "./config";
import { DexPair } from "./types";

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  fdv?: number;
  marketCap?: number;
  priceUsd?: string;
  priceChange?: { m5?: number };
  txns?: { m5?: { buys?: number; sells?: number } };
  volume?: { m5?: number };
  liquidity?: { usd?: number };
  baseToken?: { address?: string; symbol?: string };
}

interface DexSearchResponse {
  pairs?: DexScreenerPair[];
}

interface DexTokenProfile {
  tokenAddress?: string;
}

const MAX_SEARCH_CANDIDATES = 300;

function normalizeDexPair(raw: DexScreenerPair): DexPair | null {
  if (!raw?.pairAddress || !raw.baseToken?.address || !raw.baseToken?.symbol) {
    return null;
  }

  return {
    pairAddress: raw.pairAddress,
    mint: raw.baseToken.address,
    symbol: raw.baseToken.symbol,
    dex: raw.dexId ?? "unknown",
    liquidityUsd: Number(raw.liquidity?.usd ?? 0),
    volumeM5Usd: Number(raw.volume?.m5 ?? 0),
    priceUsd: Number(raw.priceUsd ?? 0),
    pairCreatedAt: Number(raw.pairCreatedAt ?? 0),
    fdvUsd: raw.fdv ? Number(raw.fdv) : undefined,
    marketCapUsd: raw.marketCap ? Number(raw.marketCap) : undefined,
    txnsM5: Number((raw.txns?.m5?.buys ?? 0) + (raw.txns?.m5?.sells ?? 0)),
    buysM5: Number(raw.txns?.m5?.buys ?? 0),
    sellsM5: Number(raw.txns?.m5?.sells ?? 0),
    priceChangeM5Pct: Number(raw.priceChange?.m5 ?? 0)
  };
}

async function fetchBroadSolanaPairs(): Promise<DexPair[]> {
  const queries =
    config.watchlistMints.length > 0
      ? config.watchlistMints
      : ["SOL", "USDC", "RAY", "new", "pump", "meme", "moonshot"];
  const output: DexPair[] = [];

  for (const query of queries) {
    const response = await axios.get<DexSearchResponse>("https://api.dexscreener.com/latest/dex/search", {
      params: { q: query },
      timeout: 10_000
    });

    for (const rawPair of response.data.pairs ?? []) {
      if (rawPair.chainId !== "solana") {
        continue;
      }
      const normalized = normalizeDexPair(rawPair);
      if (normalized) {
        output.push(normalized);
      }
    }
  }

  const deduped = new Map<string, DexPair>();
  for (const pair of output) {
    deduped.set(pair.pairAddress, pair);
  }
  return [...deduped.values()];
}

async function fetchPairsForTokenAddresses(addresses: string[]): Promise<DexPair[]> {
  const output: DexPair[] = [];

  for (const address of addresses) {
    try {
      const response = await axios.get<DexSearchResponse>(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { timeout: 10_000 }
      );

      for (const rawPair of response.data.pairs ?? []) {
        if (rawPair.chainId !== "solana") {
          continue;
        }
        const normalized = normalizeDexPair(rawPair);
        if (normalized) {
          output.push(normalized);
        }
      }
    } catch {
      // Skip address-level failures and continue discovery.
    }
  }

  return output;
}

async function fetchNewestTokenAddresses(limit = 60): Promise<string[]> {
  try {
    const response = await axios.get<DexTokenProfile[]>("https://api.dexscreener.com/token-profiles/latest/v1", {
      timeout: 10_000
    });
    const deduped = new Set<string>();
    for (const profile of response.data ?? []) {
      if (!profile?.tokenAddress) {
        continue;
      }
      deduped.add(profile.tokenAddress);
      if (deduped.size >= limit) {
        break;
      }
    }
    return [...deduped];
  } catch {
    return [];
  }
}

export async function fetchLatestSolanaPairs(): Promise<DexPair[]> {
  try {
    const [broad, newestTokenAddresses] = await Promise.all([
      fetchBroadSolanaPairs(),
      fetchNewestTokenAddresses()
    ]);

    const newestPairs = await fetchPairsForTokenAddresses(newestTokenAddresses);
    const combined = [...broad, ...newestPairs];
    const maxAgeMs = config.maxPairAgeHours * 60 * 60 * 1000;

    const deduped = new Map<string, DexPair>();
    for (const pair of combined) {
      deduped.set(pair.pairAddress, pair);
    }

    return [...deduped.values()]
      .filter((pair) => pair.pairCreatedAt > 0 && Date.now() - pair.pairCreatedAt <= maxAgeMs)
      .sort((a, b) => b.pairCreatedAt - a.pairCreatedAt)
      .slice(0, MAX_SEARCH_CANDIDATES);
  } catch {
    return [];
  }
}

export async function scanDexScreenerPairs(): Promise<DexPair[]> {
  return fetchLatestSolanaPairs();
}
