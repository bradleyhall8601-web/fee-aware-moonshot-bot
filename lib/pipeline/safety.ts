import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { env } from '../env';
import type { MarketCandidate, SafetyEnrichment } from './types';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2q9VdmuAqZLh5a2uM8uFQ2nYh';

type MintFacts = {
  decimals: number;
  supplyRaw: bigint;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
};

async function fetchMintFacts(mint: string): Promise<MintFacts> {
  const e = env();
  const connection = new Connection(e.SOLANA_RPC_URL, 'confirmed');
  const info = await getMint(connection, new PublicKey(mint), 'confirmed');
  return {
    decimals: info.decimals,
    supplyRaw: info.supply,
    mintAuthorityRevoked: info.mintAuthority === null,
    freezeAuthorityRevoked: info.freezeAuthority === null,
  };
}

async function fetchHolderFacts(mint: string, totalSupplyRaw: bigint): Promise<{
  top1HolderPct: number;
  top10HolderPct: number;
  holderCount: number;
}> {
  const key = env().HELIUS_API_KEY?.trim();
  if (!key) throw new Error('HELIUS_API_KEY not configured');

  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'moonshot-holder-distribution',
      method: 'getTokenAccounts',
      params: { mint, limit: 1000 },
    }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Helius holder request failed: ${response.status}`);
  const body = await response.json() as any;
  if (body.error) throw new Error(`Helius holder error: ${body.error.message ?? 'unknown'}`);

  const amounts = (body?.result?.token_accounts ?? [])
    .map((row: any) => {
      try { return BigInt(String(row.amount ?? '0')); } catch { return 0n; }
    })
    .filter((amount: bigint) => amount > 0n)
    .sort((a: bigint, b: bigint) => (a > b ? -1 : a < b ? 1 : 0));

  const supply = Number(totalSupplyRaw);
  if (!Number.isFinite(supply) || supply <= 0) throw new Error('Invalid mint supply');
  const pct = (value: bigint) => Math.min(100, Math.max(0, (Number(value) / supply) * 100));

  return {
    top1HolderPct: pct(amounts[0] ?? 0n),
    top10HolderPct: pct(amounts.slice(0, 10).reduce((sum: bigint, value: bigint) => sum + value, 0n)),
    holderCount: amounts.length,
  };
}

async function fetchSellRoute(candidate: MarketCandidate, decimals: number): Promise<{
  routeAvailable: boolean;
  priceImpactPct: number | null;
  slippagePct: number;
  outAmount?: string;
}> {
  if (candidate.priceUsd <= 0) throw new Error('Cannot size quote without a positive price');
  const e = env();
  const tokensForTenDollars = Math.max(1, 10 / candidate.priceUsd);
  const amount = BigInt(Math.max(1, Math.floor(tokensForTenDollars * 10 ** Math.min(decimals, 12))));
  const url = new URL(`${e.JUPITER_API_URL.replace(/\/$/, '')}/quote`);
  url.searchParams.set('inputMint', candidate.mint);
  url.searchParams.set('outputMint', USDC_MINT);
  url.searchParams.set('amount', amount.toString());
  url.searchParams.set('slippageBps', '100');
  url.searchParams.set('restrictIntermediateTokens', 'true');

  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'MoonShotForge/3.0' },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!response.ok) return { routeAvailable: false, priceImpactPct: null, slippagePct: 1 };
  const body = await response.json() as any;
  const routeAvailable = Boolean(body?.outAmount && Array.isArray(body?.routePlan) && body.routePlan.length > 0);
  const impact = Number(body?.priceImpactPct);
  return {
    routeAvailable,
    priceImpactPct: Number.isFinite(impact) ? impact * 100 : null,
    slippagePct: 1,
    outAmount: body?.outAmount ? String(body.outAmount) : undefined,
  };
}

export async function enrichSafety(candidate: MarketCandidate): Promise<SafetyEnrichment> {
  const missing: string[] = [];
  const evidence: Record<string, unknown> = {};

  let mintFacts: MintFacts | null = null;
  try {
    mintFacts = await fetchMintFacts(candidate.mint);
    evidence.mint = {
      decimals: mintFacts.decimals,
      supplyRaw: mintFacts.supplyRaw.toString(),
    };
  } catch (error) {
    missing.push('mintAuthorityRevoked', 'freezeAuthorityRevoked');
    evidence.mintError = error instanceof Error ? error.message : String(error);
  }

  let top1HolderPct: number | null = null;
  let top10HolderPct: number | null = null;
  if (mintFacts) {
    try {
      const holders = await fetchHolderFacts(candidate.mint, mintFacts.supplyRaw);
      top1HolderPct = holders.top1HolderPct;
      top10HolderPct = holders.top10HolderPct;
      evidence.holders = holders;
    } catch (error) {
      missing.push('top1HolderPct', 'top10HolderPct');
      evidence.holderError = error instanceof Error ? error.message : String(error);
    }
  } else {
    missing.push('top1HolderPct', 'top10HolderPct');
  }

  let routeAvailable: boolean | null = null;
  let priceImpactPct: number | null = null;
  let slippagePct: number | null = null;
  if (mintFacts) {
    try {
      const route = await fetchSellRoute(candidate, mintFacts.decimals);
      routeAvailable = route.routeAvailable;
      priceImpactPct = route.priceImpactPct;
      slippagePct = route.slippagePct;
      evidence.route = route;
    } catch (error) {
      missing.push('routeAvailable', 'priceImpactPct', 'slippagePct');
      evidence.routeError = error instanceof Error ? error.message : String(error);
    }
  } else {
    missing.push('routeAvailable', 'priceImpactPct', 'slippagePct');
  }

  // Creator sell history and transaction-level unique-wallet counts require a
  // provider with indexed history. They remain explicitly unknown rather than
  // being guessed from transaction counts.
  missing.push('creatorSellPct', 'uniqueWallets5m');

  return {
    mintAuthorityRevoked: mintFacts?.mintAuthorityRevoked ?? null,
    freezeAuthorityRevoked: mintFacts?.freezeAuthorityRevoked ?? null,
    top1HolderPct,
    top10HolderPct,
    creatorSellPct: null,
    routeAvailable,
    priceImpactPct,
    slippagePct,
    uniqueWallets5m: null,
    providerHealthy: Boolean(mintFacts && routeAvailable !== null),
    missing: [...new Set(missing)],
    evidence,
  };
}
