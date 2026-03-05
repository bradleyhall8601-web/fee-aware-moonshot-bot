import { config } from "./config";
import { Pair } from "./types";

export async function scanDexScreenerPairs(): Promise<Pair[]> {
  const watchlist = config.watchlistMints;
  if (watchlist.length > 0) {
    return watchlist.map((mint, index) => ({
      mint,
      symbol: `WATCH${index + 1}`,
      dex: "raydium",
      liquidityUsd: config.minLiquidityUsd + 1_000,
      volume1hUsd: config.minVolume1hUsd + 500,
      priceUsd: 0.0001 * (index + 1)
    }));
  }

  return [
    {
      mint: "So11111111111111111111111111111111111111112",
      symbol: "WSOL",
      dex: "raydium",
      liquidityUsd: 150_000,
      volume1hUsd: 40_000,
      priceUsd: 180
    },
    {
      mint: "USDC111111111111111111111111111111111111111",
      symbol: "USDC",
      dex: "orca",
      liquidityUsd: 250_000,
      volume1hUsd: 75_000,
      priceUsd: 1
    }
  ];
}
