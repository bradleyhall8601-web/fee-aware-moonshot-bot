// src/token-scoring-engine.ts
// Comprehensive token scoring combining technical, security, and market analysis

import TechnicalAnalysis, { TechnicalIndicators } from './technical-analysis';
import SecurityAnalyzer, { SecurityAnalysis } from './security-analysis';
import telemetryLogger from './telemetry';

type SecurityScore = SecurityAnalysis;

export interface TokenScore {
  mint: string;
  symbol: string;
  name: string;
  overallScore: number; // 0-100
  technicalScore: number;
  securityScore: number;
  marketScore: number;
  sentimentScore: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-100
  analysis: {
    technical: TechnicalIndicators | null;
    security: SecurityScore | null;
    market: MarketAnalysis;
  };
  risks: string[];
  opportunities: string[];
  targetPrice?: number;
  stopLoss?: number;
}

export interface MarketAnalysis {
  volumeTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  liquidityHealth: 'STRONG' | 'ADEQUATE' | 'WEAK';
  buyPressure: number; // 0-100, higher = more buying
  sellPressure: number; // 0-100, higher = more selling
  priceImpact: number; // percentage
}

class TokenScoringEngine {
  /**
   * Comprehensive token analysis and scoring
   */
  static scoreToken(
    tokenData: any,
    priceHistory: any[],
    marketMetrics: any
  ): TokenScore {
    const technicalAnalysis = this.analyzeTechnical(priceHistory);
    const securityAnalysis = SecurityAnalyzer.analyzeToken(tokenData);
    const marketAnalysis = this.analyzeMarket(tokenData, marketMetrics);

    // Calculate component scores
    const technicalScore = this.calculateTechnicalScore(technicalAnalysis);
    const securityScore = securityAnalysis.overallScore;
    const marketScore = this.calculateMarketScore(marketAnalysis, tokenData);
    const sentimentScore = this.calculateSentimentScore(tokenData);

    // Weighted overall score
    const overallScore = this.calculateWeightedScore(
      technicalScore,
      securityScore,
      marketScore,
      sentimentScore,
      {
        technical: 0.25,
        security: 0.35, // Security weighted more heavily
        market: 0.25,
        sentiment: 0.15,
      }
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(overallScore, securityAnalysis.riskLevel);

    // Calculate confidence
    const confidence = this.calculateConfidence(tokenData, technicalAnalysis);

    // Identify risks and opportunities
    const risks = this.identifyRisks(tokenData, technicalAnalysis, securityAnalysis);
    const opportunities = this.identifyOpportunities(tokenData, technicalAnalysis, marketAnalysis);

    // Calculate price targets
    const { targetPrice, stopLoss } = this.calculatePriceTargets(
      tokenData,
      technicalAnalysis
    );

    return {
      mint: tokenData.mint,
      symbol: tokenData.symbol || 'UNKNOWN',
      name: tokenData.name || 'Unknown Token',
      overallScore: Math.round(overallScore),
      technicalScore: Math.round(technicalScore),
      securityScore: Math.round(securityScore),
      marketScore: Math.round(marketScore),
      sentimentScore: Math.round(sentimentScore),
      recommendation,
      confidence,
      analysis: {
        technical: technicalAnalysis,
        security: securityAnalysis,
        market: marketAnalysis,
      },
      risks,
      opportunities,
      targetPrice,
      stopLoss,
    };
  }

  /**
   * Analyze technical indicators
   */
  static analyzeTechnical(priceHistory: any[]): TechnicalIndicators | null {
    if (!priceHistory || priceHistory.length < 2) {
      return null;
    }

    return TechnicalAnalysis.analyzeToken(priceHistory);
  }

  /**
   * Calculate technical score (0-100)
   */
  static calculateTechnicalScore(indicators: TechnicalIndicators | null): number {
    if (!indicators) return 50;

    let score = 50;

    // RSI analysis
    if (indicators.rsi) {
      if (indicators.rsi > 50 && indicators.rsi < 70) {
        score += 15; // Strong uptrend
      } else if (indicators.rsi > 70) {
        score -= 15; // Overbought
      } else if (indicators.rsi > 30 && indicators.rsi < 50) {
        score += 5; // Mild uptrend
      } else if (indicators.rsi < 30) {
        score += 10; // Oversold = potential bounce
      }
    }

    // MACD analysis
    if (indicators.macd) {
      if (indicators.macd.histogram > 0 && indicators.macd.line > indicators.macd.signal) {
        score += 15; // Bullish
      } else if (indicators.macd.histogram < 0) {
        score -= 10; // Bearish
      }
    }

    // Bollinger Bands analysis
    if (indicators.bollingerBands) {
      // TODO: Add price at bands analysis
    }

    // Volatility consideration
    if (indicators.volatility < 30) {
      score += 5; // Low volatility preferred for stability
    } else if (indicators.volatility > 70) {
      score -= 5; // Very high volatility risky
    }

    // Slope (trend) analysis
    if (indicators.slope > 0.01) {
      score += 10; // Uptrend
    } else if (indicators.slope < -0.01) {
      score -= 10; // Downtrend
    }

    return Math.max(Math.min(score, 100), 0);
  }

  /**
   * Analyze market conditions
   */
  static analyzeMarket(tokenData: any, marketMetrics: any): MarketAnalysis {
    const volume24h = tokenData.volume24h || 0;
    const volume7d = tokenData.volume7d || 0;
    const volatility = tokenData.volatility || 50;
    const liquidity = tokenData.liquidity || 0;
    const buys = tokenData.buys || 0;
    const sells = tokenData.sells || 0;
    const priceChange = tokenData.priceChange24h || 0;

    // Volume trend
    let volumeTrend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
    if (volume24h > volume7d / 7 * 1.2) {
      volumeTrend = 'INCREASING';
    } else if (volume24h < volume7d / 7 * 0.8) {
      volumeTrend = 'DECREASING';
    }

    // Volatility level
    let volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (volatility < 25) {
      volatilityLevel = 'LOW';
    } else if (volatility > 60) {
      volatilityLevel = 'HIGH';
    }

    // Liquidity health
    let liquidityHealth: 'STRONG' | 'ADEQUATE' | 'WEAK' = 'ADEQUATE';
    if (liquidity > 100000) {
      liquidityHealth = 'STRONG';
    } else if (liquidity < 10000) {
      liquidityHealth = 'WEAK';
    }

    // Buy/sell pressure
    const totalTrades = buys + sells;
    const buyPressure = totalTrades > 0 ? (buys / totalTrades) * 100 : 50;
    const sellPressure = 100 - buyPressure;

    // Price impact estimation
    const avgTradeSize = totalTrades > 0 ? volume24h / totalTrades : liquidity;
    const priceImpact = (avgTradeSize / liquidity) * 100;

    return {
      volumeTrend,
      volatilityLevel,
      liquidityHealth,
      buyPressure: Math.round(buyPressure),
      sellPressure: Math.round(sellPressure),
      priceImpact: Math.round(priceImpact),
    };
  }

  /**
   * Calculate market score (0-100)
   */
  static calculateMarketScore(market: MarketAnalysis, tokenData: any): number {
    let score = 50;

    // Volume trend
    if (market.volumeTrend === 'INCREASING') {
      score += 15;
    } else if (market.volumeTrend === 'DECREASING') {
      score -= 10;
    }

    // Volatility
    if (market.volatilityLevel === 'MEDIUM') {
      score += 10;
    } else if (market.volatilityLevel === 'HIGH') {
      score -= 5;
    } else if (market.volatilityLevel === 'LOW') {
      score += 5;
    }

    // Liquidity
    if (market.liquidityHealth === 'STRONG') {
      score += 15;
    } else if (market.liquidityHealth === 'WEAK') {
      score -= 15;
    }

    // Buy pressure
    if (market.buyPressure > 60) {
      score += 10;
    } else if (market.buyPressure < 40) {
      score -= 10;
    }

    // Price impact
    if (market.priceImpact < 5) {
      score += 5;
    } else if (market.priceImpact > 20) {
      score -= 10;
    }

    return Math.max(Math.min(score, 100), 0);
  }

  /**
   * Calculate sentiment score based on social and market signals
   */
  static calculateSentimentScore(tokenData: any): number {
    let score = 50;

    // Social metrics (if available)
    const twitterFollowers = tokenData.twitterFollowers || 0;
    const discordMembers = tokenData.discordMembers || 0;
    const redditMentions = tokenData.redditMentions || 0;

    if (twitterFollowers > 10000) score += 15;
    if (discordMembers > 5000) score += 15;
    if (redditMentions > 100) score += 10;

    // Community health indicators
    const engagementRate = tokenData.engagementRate || 0;
    if (engagementRate > 5) score += 10;

    // Price momentum
    const priceChange = tokenData.priceChange24h || 0;
    if (priceChange > 20) score += 10;
    if (priceChange > 100) score += 10;
    if (priceChange < -30) score -= 20;

    return Math.max(Math.min(score, 100), 0);
  }

  /**
   * Calculate weighted overall score
   */
  static calculateWeightedScore(
    technical: number,
    security: number,
    market: number,
    sentiment: number,
    weights: { technical: number; security: number; market: number; sentiment: number }
  ): number {
    return (
      technical * weights.technical +
      security * weights.security +
      market * weights.market +
      sentiment * weights.sentiment
    );
  }

  /**
   * Generate trading recommendation
   */
  static generateRecommendation(
    score: number,
    riskLevel: string
  ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    // Adjust recommendation based on security risk
    const riskAdjustment = riskLevel === 'CRITICAL' ? -30 : riskLevel === 'HIGH_RISK' ? -15 : 0;
    const adjustedScore = score + riskAdjustment;

    if (adjustedScore >= 85) {
      return 'STRONG_BUY';
    } else if (adjustedScore >= 70) {
      return 'BUY';
    } else if (adjustedScore >= 50) {
      return 'HOLD';
    } else if (adjustedScore >= 35) {
      return 'SELL';
    }

    return 'STRONG_SELL';
  }

  /**
   * Calculate confidence level
   */
  static calculateConfidence(tokenData: any, technical: TechnicalIndicators | null): number {
    let confidence = 50;

    // Data availability
    if (tokenData.volume24h) confidence += 10;
    if (tokenData.liquidity) confidence += 10;
    if (technical) confidence += 15;
    if (tokenData.ageHours && tokenData.ageHours > 24) confidence += 10;

    return Math.min(confidence, 100);
  }

  /**
   * Identify specific risks
   */
  static identifyRisks(
    tokenData: any,
    technical: TechnicalIndicators | null,
    security: SecurityScore
  ): string[] {
    const risks: string[] = [];

    // Security risks
    risks.push(...security.redFlags);

    // Technical risks
    if (technical && technical.overbought) {
      risks.push('⚠️ Overbought conditions - potential pullback');
    }
    if (technical && technical.oversold) {
      risks.push('📊 Oversold - exercise caution on entry');
    }

    // Market risks
    if (tokenData.volatility > 70) {
      risks.push('📈 High volatility - larger price swings');
    }
    if (!tokenData.liquidityLocked) {
      risks.push('💧 Liquidity not locked - withdrawal risk');
    }

    return [...new Set(risks)].slice(0, 5); // Dedupe and limit to 5
  }

  /**
   * Identify specific opportunities
   */
  static identifyOpportunities(
    tokenData: any,
    technical: TechnicalIndicators | null,
    market: MarketAnalysis
  ): string[] {
    const opportunities: string[] = [];

    // Technical opportunities
    if (technical && technical.oversold && technical.rsi && technical.rsi < 25) {
      opportunities.push('🚀 Oversold bounce opportunity');
    }
    if (technical && technical.momentum && technical.momentum > 10) {
      opportunities.push('📈 Strong positive momentum');
    }

    // Market opportunities
    if (market.buyPressure > 70) {
      opportunities.push('💰 Strong buyer interest');
    }
    if (market.volumeTrend === 'INCREASING') {
      opportunities.push('📊 Volume increasing - participation growing');
    }

    // Token-specific opportunities
    if (tokenData.ageHours && tokenData.ageHours < 24) {
      opportunities.push('⭐ New token - early-stage potential');
    }

    return opportunities.slice(0, 3);
  }

  /**
   * Calculate price targets and stops
   */
  static calculatePriceTargets(
    tokenData: any,
    technical: TechnicalIndicators | null
  ): { targetPrice?: number; stopLoss?: number } {
    const currentPrice = tokenData.price || 0;

    if (!currentPrice || !technical) {
      return {};
    }

    // Take profit target based on volatility
    const riskReward = 2; // 2:1 risk reward
    let targetPrice = currentPrice * (1 + technical.volatility / 50 * riskReward);

    // Stop loss
    let stopLoss = currentPrice * (1 - technical.volatility / 50);

    return {
      targetPrice: Math.round(targetPrice * 1000000) / 1000000, // 6 decimals for Solana
      stopLoss: Math.round(stopLoss * 1000000) / 1000000,
    };
  }
}

export default TokenScoringEngine;
