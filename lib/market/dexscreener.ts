import type { MarketCandidate } from '../pipeline/types';

const BASE = 'https://api.dexscreener.com';
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function getJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'MoonShotForge/3.0' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`DexScreener ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

function number(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePair(pair: any, sources: string[]): MarketCandidate | null {
  if (pair?.chainId !== 'solana') return null;
  const mint = String(pair?.baseToken?.address ?? '');
  const pairAddress = String(pair?.pairAddress ?? '');
  if (!SOLANA_ADDRESS.test(mint) || !pairAddress) return null;

  const pairCreatedAt = number(pair.pairCreatedAt) || Date.now();
  const socialCount = Array.isArray(pair?.info?.socials) ? pair.info.socials.length : 0;
  const websiteCount = Array.isArray(pair?.info?.websites) ? pair.info.websites.length : 0;

  return {
    chainId: 'solana',
    mint,
    pairAddress,
    dexId: String(pair.dexId ?? 'unknown'),
    symbol: String(pair?.baseToken?.symbol ?? 'UNKNOWN').slice(0, 32),
    name: String(pair?.baseToken?.name ?? 'Unknown').slice(0, 120),
    url: String(pair.url ?? ''),
    priceUsd: number(pair.priceUsd),
    liquidityUsd: number(pair?.liquidity?.usd),
    marketCapUsd: number(pair.marketCap),
    fdvUsd: number(pair.fdv),
    pairCreatedAt,
    poolAgeMs: Math.max(0, Date.now() - pairCreatedAt),
    volume5mUsd: number(pair?.volume?.m5),
    volume1hUsd: number(pair?.volume?.h1),
    volume24hUsd: number(pair?.volume?.h24),
    buys5m: number(pair?.txns?.m5?.buys),
    sells5m: number(pair?.txns?.m5?.sells),
    buys1h: number(pair?.txns?.h1?.buys),
    sells1h: number(pair?.txns?.h1?.sells),
    priceChange5m: number(pair?.priceChange?.m5),
    priceChange1h: number(pair?.priceChange?.h1),
    priceChange24h: number(pair?.priceChange?.h24),
    hasSocials: socialCount + websiteCount > 0,
    source: [...new Set(sources)],
    raw: pair as Record<string, unknown>,
  };
}

function chooseBestPair(current: MarketCandidate | undefined, next: MarketCandidate): MarketCandidate {
  if (!current) return next;
  if (next.liquidityUsd > current.liquidityUsd) return next;
  return { ...current, source: [...new Set([...current.source, ...next.source])] };
}

export async function discoverCandidates(limit = 35): Promise<MarketCandidate[]> {
  const rawPairs: Array<{ pair: any; source: string }> = [];

  const searches = ['pump.fun', 'raydium sol', 'solana meme'];
  const searchResults = await Promise.allSettled(
    searches.map(async query => {
      const data = await getJson<any>(`${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
      return (data?.pairs ?? []).map((pair: any) => ({ pair, source: `search:${query}` }));
    }),
  );
  for (const result of searchResults) if (result.status === 'fulfilled') rawPairs.push(...result.value);

  const discoveryFeeds = await Promise.allSettled([
    getJson<any[]>(`${BASE}/token-profiles/latest/v1`).then(items => ({ items, source: 'profiles' })),
    getJson<any[]>(`${BASE}/token-boosts/latest/v1`).then(items => ({ items, source: 'boosts' })),
    getJson<any[]>(`${BASE}/token-boosts/top/v1`).then(items => ({ items, source: 'boosts-top' })),
  ]);

  const mints = new Map<string, Set<string>>();
  for (const result of discoveryFeeds) {
    if (result.status !== 'fulfilled') continue;
    for (const item of Array.isArray(result.value.items) ? result.value.items : []) {
      if (item?.chainId !== 'solana') continue;
      const address = String(item?.tokenAddress ?? '');
      if (!SOLANA_ADDRESS.test(address)) continue;
      if (!mints.has(address)) mints.set(address, new Set());
      mints.get(address)!.add(result.value.source);
      if (mints.size >= 60) break;
    }
  }

  const mintList = [...mints.keys()];
  for (let i = 0; i < mintList.length; i += 30) {
    const batch = mintList.slice(i, i + 30);
    try {
      const data = await getJson<any>(`${BASE}/latest/dex/tokens/${batch.join(',')}`);
      for (const pair of data?.pairs ?? []) {
        const address = String(pair?.baseToken?.address ?? '');
        rawPairs.push({ pair, source: [...(mints.get(address) ?? ['tokens'])].join('+') });
      }
    } catch {
      // Other feeds still produce usable candidates.
    }
  }

  const byMint = new Map<string, MarketCandidate>();
  for (const row of rawPairs) {
    const normalized = normalizePair(row.pair, [row.source]);
    if (!normalized) continue;
    byMint.set(normalized.mint, chooseBestPair(byMint.get(normalized.mint), normalized));
  }

  return [...byMint.values()]
    .filter(c => c.priceUsd > 0 && c.liquidityUsd >= 2_500 && c.volume5mUsd > 0)
    .sort((a, b) => {
      const aMomentum = a.volume5mUsd * Math.max(0.1, (a.buys5m + 1) / (a.sells5m + 1));
      const bMomentum = b.volume5mUsd * Math.max(0.1, (b.buys5m + 1) / (b.sells5m + 1));
      return bMomentum - aMomentum;
    })
    .slice(0, limit);
}

export async function fetchPricesByMint(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const unique = [...new Set(mints.filter(mint => SOLANA_ADDRESS.test(mint)))];
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30);
    const data = await getJson<any>(`${BASE}/latest/dex/tokens/${batch.join(',')}`);
    const best = new Map<string, { price: number; liquidity: number }>();
    for (const pair of data?.pairs ?? []) {
      if (pair?.chainId !== 'solana') continue;
      const mint = String(pair?.baseToken?.address ?? '');
      const price = number(pair?.priceUsd);
      const liquidity = number(pair?.liquidity?.usd);
      const current = best.get(mint);
      if (price > 0 && (!current || liquidity > current.liquidity)) best.set(mint, { price, liquidity });
    }
    for (const [mint, row] of best) prices.set(mint, row.price);
  }
  return prices;
}
