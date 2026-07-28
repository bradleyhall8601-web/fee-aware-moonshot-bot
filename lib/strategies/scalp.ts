import { clamp, finalize, present, ratio, type ScoreResult } from './common';

export interface ScalpInput {
  liquidityUsd: number; volume5mUsd: number; volume5mPrevUsd: number | null;
  buyCount5m: number; sellCount5m: number; priceChange5m: number; priceChange1h: number;
  top1HolderPct: number | null; routeAvailable: boolean | null; priceImpactPct: number | null;
  slippagePct: number | null; marketRegimeScore: number; fieldsComplete: number; isExhausted: boolean;
}

export function computeScalpScore(input: ScalpInput): ScoreResult {
  const missing: string[] = [];
  const pressure = ratio(input.buyCount5m, input.buyCount5m + input.sellCount5m) * 100;
  const acceleration = input.volume5mPrevUsd && input.volume5mPrevUsd > 0 ? input.volume5mUsd / input.volume5mPrevUsd : null;
  if (acceleration === null) missing.push('volume5mPrevUsd');
  const components: Record<string, number> = {
    liquidityStability: clamp((input.liquidityUsd / 125_000) * 12, 0, 12),
    volumeAcceleration: acceleration === null ? clamp((input.volume5mUsd / 35_000) * 10, 0, 10) : clamp(((acceleration - .8) / 2.2) * 15, 0, 15),
    buyPressure: clamp(((pressure - 45) / 30) * 14, 0, 14),
    shortMomentum: input.priceChange5m > 0 ? clamp((input.priceChange5m / 15) * 15, 0, 15) : 0,
    trendAlignment: input.priceChange5m > 0 && input.priceChange1h > 0 ? 8 : input.priceChange5m > 0 ? 3 : 0,
    routeQuality: 0,
    priceImpact: 0,
    holderDistribution: 0,
    marketRegime: clamp((input.marketRegimeScore / 100) * 10, 0, 10),
    dataQuality: clamp(input.fieldsComplete * 6, 0, 6),
    penalties: input.isExhausted ? -10 : 0,
  };
  if (!present(input.routeAvailable)) missing.push('routeAvailable');
  components.routeQuality = input.routeAvailable ? 12 : 0;
  if (!present(input.priceImpactPct)) missing.push('priceImpactPct');
  if (input.priceImpactPct !== null) components.priceImpact = clamp(((8 - input.priceImpactPct) / 8) * 8, 0, 8);
  if (!present(input.top1HolderPct)) missing.push('top1HolderPct');
  if (input.top1HolderPct !== null) components.holderDistribution = clamp(((35 - input.top1HolderPct) / 30) * 8, 0, 8);
  if (input.slippagePct !== null && input.slippagePct > 5) components.penalties -= 5;
  if (input.priceChange5m < -3) components.penalties -= 10;
  return finalize(components, missing, 'scalp-serverless-v1');
}
