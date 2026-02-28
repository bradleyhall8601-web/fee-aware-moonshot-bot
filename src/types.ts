/** Raw DexScreener pair object */
export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv?: number;
  pairCreatedAt: number; // unix ms
}

/** Jupiter quote response (v6) */
export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  slippageBps: number;
  routePlan: unknown[];
  contextSlot: number;
  timeTaken: number;
}

/** An open or closed trading position */
export interface Position {
  mint: string;
  symbol: string;
  pairAddress: string;
  entryPriceUsd: number;
  highWatermarkUsd: number;
  sizeUsd: number;
  entryTime: number;
  momentumFailCount: number;
}

/** A completed trade record */
export interface Trade {
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  sizeUsd: number;
  realizedPnlUsd: number;
  entryTime: number;
  exitTime: number;
  exitReason: 'profit_target' | 'trailing_stop' | 'momentum_fail' | 'manual';
}
