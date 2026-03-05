export type ExitReason = "profit_target" | "trailing_stop" | "momentum_loss";

export interface WalletSnapshot {
  solBalance: number;
  solUsd: number;
  walletUsd: number;
  updatedAtMs: number;
}

export interface Position {
  pairAddress: string;
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  lastPriceUsd: number;
  highWatermarkUsd: number;
  sizeUsd: number;
  remainingSizeUsd: number;
  amountTokens: number;
  remainingTokens: number;
  amountRaw?: string;
  momentumFailCount: number;
  hasTakenProfit: boolean;
  realizedPartialPnlUsd: number;
  partialExitTime?: number;
  entryTxSig?: string;
  lastPartialTxSig?: string;
  openedAtMs: number;
}

export interface Trade {
  mint: string;
  symbol: string;
  pairAddress: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  sizeUsd: number;
  isPartial: boolean;
  realizedPnlUsd: number;
  realizedPartialPnlUsd?: number;
  partialExitTime?: number;
  openedAtMs: number;
  closedAtMs: number;
  reason: ExitReason;
  entryTxSig?: string;
  exitTxSig?: string;
}

export interface DexPair {
  pairAddress: string;
  mint: string;
  symbol: string;
  dex: string;
  liquidityUsd: number;
  volumeM5Usd: number;
  priceUsd: number;
  pairCreatedAt: number;
  fdvUsd?: number;
  marketCapUsd?: number;
  txnsM5: number;
  buysM5: number;
  sellsM5: number;
  priceChangeM5Pct: number;
  priceImpactPct?: number;
}

export interface BotStats {
  tradeCount: number;
  totalPnlUsd: number;
}

export interface BotState {
  positions: Position[];
  closedTrades: Trade[];
  paperBalanceUsd: number;
  exposureUsd: number;
  stats: BotStats;
  seenPairs: string[];
  lastWalletSnapshot: WalletSnapshot;
  lastCycleAtMs: number;
  updatedAtMs: number;
}

export interface SwapExecutionResult {
  signature: string;
  dryRun: boolean;
  feeUsd: number;
  quotePriceImpactPct: number;
  inAmount: string;
  outAmount: string;
}
