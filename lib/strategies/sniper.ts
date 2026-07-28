import { clamp, finalize, present, ratio, type ScoreResult } from './common';

export interface SniperInput {
  liquidityUsd: number; volume5mUsd: number; priceChange5m: number; priceChange1h: number;
  buyCount5m: number; sellCount5m: number; poolAgeMs: number; fieldsComplete: number;
  mintAuthorityRevoked: boolean | null; freezeAuthorityRevoked: boolean | null;
  top1HolderPct: number | null; top10HolderPct: number | null; creatorSellPct: number | null;
  routeAvailable: boolean | null; priceImpactPct: number | null; slippagePct: number | null;
  providerHealthy: boolean;
}

export function computeSniperScore(input: SniperInput): ScoreResult {
  const missing: string[] = [];
  const ageMinutes = input.poolAgeMs / 60_000;
  const pressure = ratio(input.buyCount5m, input.buyCount5m + input.sellCount5m) * 100;
  const components: Record<string, number> = {
    liquidity: clamp((input.liquidityUsd / 75_000) * 12, 0, 12),
    freshness: ageMinutes <= 5 ? 12 : ageMinutes <= 15 ? 8 : ageMinutes <= 60 ? 3 : 0,
    buyPressure: clamp(((pressure - 45) / 30) * 14, 0, 14),
    volumeVelocity: clamp((input.volume5mUsd / 50_000) * 10, 0, 10),
    earlyMomentum: input.priceChange5m > 0 ? clamp((input.priceChange5m / 20) * 10, 0, 10) : 0,
    authorities: 0,
    holderDistribution: 0,
    routeQuality: 0,
    dataQuality: clamp(input.fieldsComplete * 8, 0, 8),
    penalties: 0,
  };

  if (!present(input.mintAuthorityRevoked)) missing.push('mintAuthorityRevoked');
  if (!present(input.freezeAuthorityRevoked)) missing.push('freezeAuthorityRevoked');
  components.authorities = (input.mintAuthorityRevoked ? 8 : 0) + (input.freezeAuthorityRevoked ? 8 : 0);

  if (!present(input.top1HolderPct)) missing.push('top1HolderPct');
  if (!present(input.top10HolderPct)) missing.push('top10HolderPct');
  if (input.top1HolderPct !== null) components.holderDistribution += clamp(((35 - input.top1HolderPct) / 30) * 6, 0, 6);
  if (input.top10HolderPct !== null) components.holderDistribution += clamp(((80 - input.top10HolderPct) / 60) * 4, 0, 4);

  if (!present(input.routeAvailable)) missing.push('routeAvailable');
  if (!present(input.priceImpactPct)) missing.push('priceImpactPct');
  components.routeQuality = input.routeAvailable ? 4 : 0;
  if (input.priceImpactPct !== null) components.routeQuality += clamp(((8 - input.priceImpactPct) / 8) * 4, 0, 4);

  if (!present(input.creatorSellPct)) missing.push('creatorSellPct');
  if (input.creatorSellPct !== null && input.creatorSellPct > 10) components.penalties -= 12;
  if (input.priceChange5m > 35) components.penalties -= clamp((input.priceChange5m - 35) / 3, 0, 10);
  if (input.slippagePct !== null && input.slippagePct > 5) components.penalties -= 6;
  if (!input.providerHealthy) components.penalties -= 8;
  return finalize(components, missing, 'sniper-serverless-v1');
}
