import { clamp, finalize, present, ratio, type ScoreResult } from './common';

export interface RideInput {
  liquidityUsd: number; volume5mUsd: number; volume5mPrevUsd: number | null;
  buyCount5m: number; sellCount5m: number; poolAgeMs: number;
  priceChange5m: number; priceChange1h: number; priceChange24h: number;
  top1HolderPct: number | null; creatorDumpFlag: boolean | null;
  routeAvailable: boolean | null; priceImpactPct: number | null;
  marketRegimeScore: number; fieldsComplete: number;
}

export function computeRideScore(input: RideInput): ScoreResult {
  const missing: string[] = [];
  const pressure = ratio(input.buyCount5m, input.buyCount5m + input.sellCount5m) * 100;
  const acceleration = input.volume5mPrevUsd && input.volume5mPrevUsd > 0 ? input.volume5mUsd / input.volume5mPrevUsd : null;
  if (acceleration === null) missing.push('volume5mPrevUsd');
  const ageMinutes = input.poolAgeMs / 60_000;
  const aligned = input.priceChange5m > 0 && input.priceChange1h > 0 && input.priceChange24h > 0;
  const components: Record<string, number> = {
    liquidityQuality: clamp((input.liquidityUsd / 250_000) * 14, 0, 14),
    sustainedVolume: acceleration === null ? clamp((input.volume5mUsd / 75_000) * 8, 0, 8) : clamp(((acceleration - .7) / 2.3) * 12, 0, 12),
    buyPressure: clamp(((pressure - 45) / 30) * 12, 0, 12),
    sustainedMomentum: input.priceChange1h > 0 ? clamp((input.priceChange1h / 25) * 18, 0, 18) : 0,
    trendDurability: aligned ? 12 : input.priceChange5m > 0 && input.priceChange1h > 0 ? 7 : 0,
    maturity: ageMinutes >= 120 ? 8 : ageMinutes >= 30 ? 6 : ageMinutes >= 15 ? 3 : 0,
    holderDistribution: 0,
    routeQuality: 0,
    marketRegime: clamp((input.marketRegimeScore / 100) * 8, 0, 8),
    dataQuality: clamp(input.fieldsComplete * 8, 0, 8),
    penalties: 0,
  };
  if (!present(input.top1HolderPct)) missing.push('top1HolderPct');
  if (input.top1HolderPct !== null) components.holderDistribution = clamp(((35 - input.top1HolderPct) / 30) * 8, 0, 8);
  if (!present(input.routeAvailable)) missing.push('routeAvailable');
  if (!present(input.priceImpactPct)) missing.push('priceImpactPct');
  components.routeQuality = input.routeAvailable ? 4 : 0;
  if (input.priceImpactPct !== null) components.routeQuality += clamp(((8 - input.priceImpactPct) / 8) * 4, 0, 4);
  if (!present(input.creatorDumpFlag)) missing.push('creatorDumpFlag');
  if (input.creatorDumpFlag) components.penalties -= 12;
  if (input.priceChange5m > 40 || input.priceChange1h > 120) components.penalties -= 10;
  return finalize(components, missing, 'ride-serverless-v1');
}
