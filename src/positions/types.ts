export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  priceChange: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

export interface Position {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  pairAddress: string;

  entryPrice: number;
  entryTime: number;
  /** SOL spent (including estimated fees) */
  sizeSol: number;
  /** Raw token units received at entry */
  tokenAmount: number;
  entryTxSig?: string;

  /** Current price from latest DexScreener poll */
  currentPrice: number;
  /** Highest price observed since entry (for trailing stop) */
  peakPrice: number;

  /** Whether the take-profit partial sell has been executed */
  halfSold: boolean;
  halfSoldPrice?: number;
  halfSoldTime?: number;
  halfSoldTxSig?: string;
  /** Remaining token units after partial sell */
  remainingTokenAmount: number;

  status: "open" | "closed";
  closeReason?: string;
  closedPrice?: number;
  closedTime?: number;
  closeTxSig?: string;

  realizedPnlSol?: number;
  paper: boolean;
}

export interface Trade {
  id: string;
  positionId: string;
  tokenMint: string;
  tokenSymbol: string;
  pairAddress: string;
  type: "buy" | "sell_half" | "sell_all";
  price: number;
  sizeSol: number;
  tokenAmount: number;
  time: number;
  txSig?: string;
  /** Estimated fee in SOL */
  feeSol: number;
  paper: boolean;
}

export interface PersistentStore {
  positions: Position[];
  trades: Trade[];
}
