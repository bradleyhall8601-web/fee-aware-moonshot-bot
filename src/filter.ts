import { config } from "./config";
import { DexPair } from "./types";

export function filterCandidates(pairs: DexPair[]): DexPair[] {
  return pairs.filter(
    (pair) =>
      Number.isFinite(pair.pairCreatedAt) &&
      pair.pairCreatedAt > 0 &&
      Date.now() - pair.pairCreatedAt <= config.maxPairAgeHours * 60 * 60 * 1000 &&
      pair.liquidityUsd >= config.minLiquidityUsd &&
      pair.volumeM5Usd >= config.minVolumeM5Usd &&
      pair.volumeM5Usd <= config.maxVolumeM5Usd &&
      pair.txnsM5 >= config.minTxnsM5 &&
      pair.txnsM5 <= config.maxTxnsM5 &&
      pair.buysM5 >= config.minBuysM5 &&
      pair.buysM5 <= config.maxBuysM5 &&
      pair.sellsM5 >= config.minSellsM5 &&
      pair.sellsM5 <= config.maxSellsM5 &&
      (pair.fdvUsd === undefined || pair.fdvUsd <= config.maxFdvUsd) &&
      (!config.requirePriceUpM5 || pair.priceChangeM5Pct > 0) &&
      (pair.fdvUsd === undefined || pair.liquidityUsd >= pair.fdvUsd * 0.03) &&
      pair.sellsM5 <= pair.buysM5 * 1.5
  );
}
