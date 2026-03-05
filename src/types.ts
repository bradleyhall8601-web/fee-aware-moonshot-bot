export type ExitReason = "profit_target" | "trailing_stop" | "momentum_loss";

export interface Position {
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  lastPriceUsd: number;
  highWatermarkUsd: number;
  sizeUsd: number;
  amountTokens: number;
  amountRaw?: string;
  momentumFailCount: number;
  partialTaken: boolean;
  realizedPartialPnlUsd: number;
  entryTxSig?: string;
  lastPartialTxSig?: string;
  openedAtMs: number;
}

export interface Trade {
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  sizeUsd: number;
  realizedPnlUsd: number;
  openedAtMs: number;
  closedAtMs: number;
  reason: ExitReason;
  entryTxSig?: string;
  exitTxSig?: string;
}

export interface Pair {
  mint: string;
  symbol: string;
  dex: string;
  liquidityUsd: number;
  volume1hUsd: number;
  priceUsd: number;
  priceImpactPct?: number;
}

export interface BotState {
  positions: Position[];
  closedTrades: Trade[];
  closedPositions: number;
  paperBalanceUsd: number;
  realizedPnlUsd: number;
  lastCycleAtMs: number;
}

export interface SwapExecutionResult {
  txSig: string;
  dryRun: boolean;
  feeUsd: number;
  quotePriceImpactPct: number;
  inAmount: string;
  outAmount: string;
}
