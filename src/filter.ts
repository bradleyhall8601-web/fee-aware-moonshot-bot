import { config } from "./config";
import { Pair } from "./types";

export function filterCandidates(pairs: Pair[]): Pair[] {
  return pairs.filter(
    (pair) =>
      pair.liquidityUsd >= config.minLiquidityUsd &&
      pair.volume1hUsd >= config.minVolume1hUsd &&
      pair.volume1hUsd <= config.maxVolume1hUsd
  );
}
