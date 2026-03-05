export interface Position {
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  lastPriceUsd: number;
  amount: number;
  openedAtMs: number;
}

export interface Pair {
  mint: string;
  symbol: string;
  dex: string;
  liquidityUsd: number;
  volume1hUsd: number;
  priceUsd: number;
}

export interface BotState {
  positions: Position[];
  closedPositions: number;
  paperBalanceUsd: number;
  lastCycleAtMs: number;
}
