import axios from 'axios';
import { DexPair } from './types';
import { logger } from './logger';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

/** Fetch pairs for a list of token mint addresses from DexScreener. */
export async function fetchPairsByMints(mints: string[]): Promise<DexPair[]> {
  if (mints.length === 0) return [];

  // DexScreener accepts up to 30 addresses per call, comma-separated
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) {
    chunks.push(mints.slice(i, i + 30));
  }

  const results: DexPair[] = [];
  for (const chunk of chunks) {
    try {
      const url = `${DEXSCREENER_BASE}/tokens/${chunk.join(',')}`;
      const res = await axios.get<{ pairs: DexPair[] | null }>(url, { timeout: 10_000 });
      const pairs = res.data?.pairs;
      if (Array.isArray(pairs)) {
        results.push(...pairs);
      }
    } catch (err) {
      logger.warn({ err }, 'DexScreener fetchPairsByMints error');
    }
  }
  return results;
}

/** Search DexScreener for recent Solana pairs. */
export async function searchSolanaPairs(query: string): Promise<DexPair[]> {
  try {
    const url = `${DEXSCREENER_BASE}/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get<{ pairs: DexPair[] | null }>(url, { timeout: 10_000 });
    const pairs = res.data?.pairs;
    return Array.isArray(pairs) ? pairs.filter((p) => p.chainId === 'solana') : [];
  } catch (err) {
    logger.warn({ err }, 'DexScreener searchSolanaPairs error');
    return [];
  }
}
