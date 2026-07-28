export type StrategyName = 'SNIPER' | 'SCALP' | 'RIDE';

export interface MarketCandidate {
  chainId: 'solana';
  mint: string;
  pairAddress: string;
  dexId: string;
  symbol: string;
  name: string;
  url: string;
  priceUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  pairCreatedAt: number;
  poolAgeMs: number;
  volume5mUsd: number;
  volume1hUsd: number;
  volume24hUsd: number;
  buys5m: number;
  sells5m: number;
  buys1h: number;
  sells1h: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  hasSocials: boolean;
  source: string[];
  raw: Record<string, unknown>;
}

export interface SafetyEnrichment {
  mintAuthorityRevoked: boolean | null;
  freezeAuthorityRevoked: boolean | null;
  top1HolderPct: number | null;
  top10HolderPct: number | null;
  creatorSellPct: number | null;
  routeAvailable: boolean | null;
  priceImpactPct: number | null;
  slippagePct: number | null;
  uniqueWallets5m: number | null;
  providerHealthy: boolean;
  missing: string[];
  evidence: Record<string, unknown>;
}

export interface StrategyEvaluation {
  strategy: StrategyName;
  score: number;
  qualified: boolean;
  threshold: number;
  incomplete: boolean;
  missing: string[];
  rejectionCodes: string[];
  components: Record<string, number>;
  version: string;
}

export interface CandidateEvaluation {
  candidateId: string;
  signalId: string;
  candidate: MarketCandidate;
  safety: SafetyEnrichment;
  scores: StrategyEvaluation[];
  winner: StrategyEvaluation | null;
  rejectionCodes: string[];
  valid: boolean;
  observedAt: string;
}

export interface StrategyConfig {
  strategy: StrategyName;
  minScore: number;
  paperNotionalUsd: number;
  stopLossPct: number;
  takeProfitPct: number;
  trailActivatePct: number;
  trailingPct: number;
  maxHoldMinutes: number;
  maxDailyEntries: number;
  maxDailyEntriesPerMint: number;
}
