// src/types.ts
// Shared type definitions for the fee-aware moonshot bot

export interface TokenCandidate {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  liquidityUsd: number;
  volumeUsd24h: number;
  buySellRatio: number;
  dexId: string;
  pairAddress: string;
  chainId: string;
  confidence: number;
  fdv?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  txns5m?: { buys: number; sells: number };
  marketCap?: number;
}

export interface Position {
  symbol: string;
  address: string;
  entryPriceUsd: number;
  currentPriceUsd: number;
  units: number;
  costUsd: number;
  currentValueUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  highWaterMarkUsd: number;
  openedAt: number;
}

export interface TradeRecord {
  id: string;
  type: "buy" | "sell";
  symbol: string;
  address: string;
  priceUsd: number;
  units: number;
  valueUsd: number;
  timestamp: number;
  reason?: string;
  pnlUsd?: number;
}

export interface WatchedWallet {
  address: string;
  label?: string;
  addedAt: number;
}

export interface BotState {
  cashUsd: number;
  positions: Record<string, Position>;
  trades: TradeRecord[];
  watchedWallets: WatchedWallet[];
  startedAt: number;
  lastScanAt?: number;
  // Legacy fields kept for debug.ts compatibility
  lastMode: string;
  lastEntryBlockedReasons: string[];
  solBalance: number;
  pnl: number;
  lastSeenLiquidityUsdByPool: Record<string, number>;
  updatedAtMs: number;
}

export interface WhaleSignal {
  wallet: string;
  tokenAddress: string;
  action: "buy" | "sell";
  valueUsd: number;
  timestamp: number;
  confidence: number;
}

export interface HealthStatus {
  ok: boolean;
  helius: boolean;
  dexscreener: boolean;
  postgres: boolean;
  timestamp: string;
  cashUsd: number;
  openPositions: number;
  mode: string;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd: number };
  volume?: { h24: number; h6: number; h1: number; m5: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  fdv?: number;
  priceChange?: { m5?: number; h1?: number; h24?: number };
}
