export interface GodModeInput {
  liquidity: number;
  volume24h: number;
  buys: number;
  sells: number;
  ageHours: number;
  priceChange5m: number;
  confidence: number;
}

export interface GodModeScore {
  score: number;
  reasons: string[];
  blocked: boolean;
}

class GodModeEngine {
  score(input: GodModeInput): GodModeScore {
    let score = 0;
    const reasons: string[] = [];
    let blocked = false;

    if (input.liquidity < 10000) {
      blocked = true;
      reasons.push('low_liquidity');
    } else {
      score += 20;
      reasons.push('liquidity_ok');
    }

    if (input.volume24h >= 5000) {
      score += 15;
      reasons.push('volume_ok');
    }

    const ratio = input.buys / Math.max(1, input.sells);
    if (ratio >= 1.2) {
      score += 15;
      reasons.push('buy_pressure_ok');
    }

    if (input.ageHours <= 24) {
      score += 10;
      reasons.push('fresh_token');
    }

    if (input.priceChange5m > 0) {
      score += 10;
      reasons.push('momentum_ok');
    }

    score += Math.min(30, Math.max(0, input.confidence));
    return { score: Math.max(0, Math.min(100, score)), reasons, blocked };
  }

  shouldEnter(score: GodModeScore): boolean {
    return !score.blocked && score.score >= 75;
  }
}

export default new GodModeEngine();
