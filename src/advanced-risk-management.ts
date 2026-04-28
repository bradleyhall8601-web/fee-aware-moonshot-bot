// src/advanced-risk-management.ts
// Intelligent portfolio and risk management with correlation analysis

import database, { TradingSession } from './database.js';
import telemetryLogger from './telemetry.js';

export interface PortfolioMetrics {
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  profitPct: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  correlationRisk: number;
  concentrationRisk: number;
  activeTradesCount: number;
  burnRate: number; // Loss per hour if downtrend continues
  healthScore: number; // 0-100, higher is better
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export interface PositionSizing {
  baseSize: number;
  adjustedSize: number;
  volatilityFactor: number;
  correlationFactor: number;
  riskFactor: number;
  maxAllowedSize: number;
  reason: string;
}

class AdvancedRiskManager {
  /**
   * Calculate portfolio metrics for intelligent decision making
   */
  static calculatePortfolioMetrics(
    userId: string,
    activeTrades: TradingSession[],
    portfolioValue: number
  ): PortfolioMetrics {
    const metrics = database.getPerformanceMetrics(userId) as any;
    const tradingSessions = database.getUserTradingSessions(userId);

    // Calculate basic metrics
    const totalInvested = activeTrades.reduce((sum, t) => sum + t.entryAmount, 0);
    const totalValue = portfolioValue;
    const totalProfit = metrics?.totalProfit || 0;
    const profitPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(tradingSessions);

    // Calculate Sharpe ratio (risk-adjusted returns)
    const sharpeRatio = this.calculateSharpeRatio(tradingSessions, activeTrades);

    // Calculate volatility
    const volatility = this.calculatePortfolioVolatility(tradingSessions);

    // Calculate correlation risk (diversification)
    const correlationRisk = this.evaluateCorrelationRisk(activeTrades);

    // Calculate concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(activeTrades, portfolioValue);

    // Calculate burn rate
    const burnRate = this.calculateBurnRate(tradingSessions);

    // Generate health score
    const healthScore = this.generateHealthScore(
      maxDrawdown,
      sharpeRatio,
      volatility,
      correlationRisk,
      concentrationRisk
    );

    // Determine risk level
    const riskLevel = this.determineRiskLevel(healthScore, volatility, maxDrawdown);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      healthScore,
      correlationRisk,
      concentrationRisk,
      profitPct,
      maxDrawdown
    );

    return {
      totalValue,
      totalInvested,
      totalProfit,
      profitPct,
      maxDrawdown,
      sharpeRatio,
      volatility,
      correlationRisk,
      concentrationRisk,
      activeTradesCount: activeTrades.length,
      burnRate,
      healthScore,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Calculate max drawdown from equity curve
   */
  static calculateMaxDrawdown(tradingSessions: TradingSession[]): number {
    if (tradingSessions.length === 0) return 0;

    let cumulativeProfit = 0;
    let peak = 0;
    let maxDD = 0;

    for (const session of tradingSessions) {
      cumulativeProfit += session.profit || 0;
      if (cumulativeProfit > peak) {
        peak = cumulativeProfit;
      }
      const drawdown = (peak - cumulativeProfit) / (peak || 1);
      maxDD = Math.max(maxDD, drawdown);
    }

    return Math.round(maxDD * 10000) / 100;
  }

  /**
   * Calculate Sharpe Ratio (returns vs volatility)
   */
  static calculateSharpeRatio(tradingSessions: TradingSession[], activeTrades: TradingSession[]): number {
    const returns = tradingSessions
      .filter(t => t.status === 'closed')
      .map(t => (t.profit || 0) / (t.entryAmount || 1));

    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const riskFreeRate = 0.02; // 2% annual
    const sharpeRatio = stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;

    return Math.round(sharpeRatio * 100) / 100;
  }

  /**
   * Calculate portfolio volatility
   */
  static calculatePortfolioVolatility(tradingSessions: TradingSession[]): number {
    const profitLosses = tradingSessions.map((t, i, arr) => {
      if (i === 0) return 0;
      return (arr[i].profit || 0) - (arr[i - 1].profit || 0);
    });

    if (profitLosses.length === 0) return 0;

    const mean = profitLosses.reduce((a, b) => a + b) / profitLosses.length;
    const variance = profitLosses.reduce((sum, pl) => sum + Math.pow(pl - mean, 2), 0) / profitLosses.length;
    const volatility = Math.sqrt(variance);

    return Math.round(volatility * 100) / 100;
  }

  /**
   * Evaluate correlation risk (how diversified the portfolio is)
   * Lower is better (good diversification)
   */
  static evaluateCorrelationRisk(activeTrades: TradingSession[]): number {
    if (activeTrades.length <= 1) return 0; // No correlation risk with 1 trade

    // Simple heuristic: all same token = 100, mixed = lower
    const tokens = new Set(activeTrades.map(t => t.tokenMint));
    const concentration = (tokens.size / activeTrades.length);

    // Convert to risk score (0-100)
    const correlationRisk = (1 - concentration) * 100;

    return Math.round(correlationRisk);
  }

  /**
   * Calculate concentration risk (percentage of portfolio in largest position)
   */
  static calculateConcentrationRisk(activeTrades: TradingSession[], portfolioValue: number): number {
    if (activeTrades.length === 0) return 0;

    const largestPosition = Math.max(...activeTrades.map(t => t.entryAmount));
    const concentrationPct = (largestPosition / portfolioValue) * 100;

    return Math.round(concentrationPct);
  }

  /**
   * Calculate burn rate (how fast is portfolio losing value)
   */
  static calculateBurnRate(tradingSessions: TradingSession[]): number {
    const recentLosses = tradingSessions
      .filter(t => (t.profit || 0) < 0)
      .slice(-5); // Last 5 losses

    if (recentLosses.length === 0) return 0;

    const totalLoss = Math.abs(recentLosses.reduce((sum, t) => sum + (t.profit || 0), 0));
    const burnRate = totalLoss / recentLosses.length; // Loss per trade

    return Math.round(burnRate * 100) / 100;
  }

  /**
   * Generate overall health score (0-100)
   */
  static generateHealthScore(
    maxDrawdown: number,
    sharpeRatio: number,
    volatility: number,
    correlationRisk: number,
    concentrationRisk: number
  ): number {
    let score = 100;

    // Penalize for drawdown
    score -= Math.min(maxDrawdown * 50, 30);

    // Reward for positive Sharpe ratio
    score += Math.min(Math.max(sharpeRatio * 10, 0), 20);

    // Penalize for high volatility
    score -= Math.min(volatility, 20);

    // Penalize for correlation risk
    score -= Math.min(correlationRisk / 5, 15);

    // Penalize for concentration
    score -= Math.min(concentrationRisk / 2, 20);

    return Math.max(Math.round(score), 0);
  }

  /**
   * Determine risk level based on metrics
   */
  static determineRiskLevel(
    healthScore: number,
    volatility: number,
    maxDrawdown: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (healthScore >= 80 && volatility < 10 && maxDrawdown < 10) {
      return 'LOW';
    } else if (healthScore >= 60 && volatility < 30 && maxDrawdown < 25) {
      return 'MEDIUM';
    } else if (healthScore >= 40 && volatility < 50 && maxDrawdown < 50) {
      return 'HIGH';
    }
    return 'CRITICAL';
  }

  /**
   * Generate smart recommendations
   */
  static generateRecommendations(
    healthScore: number,
    correlationRisk: number,
    concentrationRisk: number,
    profitPct: number,
    maxDrawdown: number
  ): string[] {
    const recommendations: string[] = [];

    if (healthScore < 50) {
      recommendations.push('⚠️ Portfolio health declining - reduce position sizes');
    }

    if (concentrationRisk > 30) {
      recommendations.push('📊 Concentration risk high - diversify into more tokens');
    }

    if (correlationRisk > 70) {
      recommendations.push('🔗 Low diversification - tokens moving together, increase variety');
    }

    if (profitPct > 30) {
      recommendations.push('💰 Take profits - consider closing some winning positions');
    }

    if (maxDrawdown > 25) {
      recommendations.push('📉 Significant drawdown detected - review trading strategy');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Portfolio looks healthy - continue current strategy');
    }

    return recommendations;
  }

  /**
   * Calculate intelligent position size based on multiple factors
   */
  static calculateIntelligentPositionSize(
    baseSize: number,
    portfolioVolatility: number,
    correlationRisk: number,
    currentHealthScore: number,
    maxDrawdown: number
  ): PositionSizing {
    let adjustedSize = baseSize;
    let volatilityFactor = 1;
    let correlationFactor = 1;
    let riskFactor = 1;
    const reasons: string[] = [];

    // Volatility adjustment (reduce size for high volatility)
    volatilityFactor = Math.max(0.5, 1 - portfolioVolatility / 100);
    adjustedSize *= volatilityFactor;

    if (volatilityFactor < 1) {
      reasons.push(`Volatility high (${(portfolioVolatility * 100).toFixed(1)}%) - reduced by ${((1 - volatilityFactor) * 100).toFixed(0)}%`);
    }

    // Correlation risk adjustment
    correlationFactor = Math.max(0.7, 1 - correlationRisk / 100);
    adjustedSize *= correlationFactor;

    if (correlationFactor < 1) {
      reasons.push(`Low diversification - reduced by ${((1 - correlationFactor) * 100).toFixed(0)}%`);
    }

    // Health score adjustment
    riskFactor = Math.max(0.5, currentHealthScore / 100);
    adjustedSize *= riskFactor;

    if (riskFactor < 1) {
      reasons.push(`Portfolio health score ${currentHealthScore}/100 - reduced by ${((1 - riskFactor) * 100).toFixed(0)}%`);
    }

    // Maximum position limit
    const maxAllowedSize = baseSize * 1.5;

    return {
      baseSize: Math.round(baseSize * 100) / 100,
      adjustedSize: Math.round(adjustedSize * 100) / 100,
      volatilityFactor: Math.round(volatilityFactor * 100) / 100,
      correlationFactor: Math.round(correlationFactor * 100) / 100,
      riskFactor: Math.round(riskFactor * 100) / 100,
      maxAllowedSize: Math.round(maxAllowedSize * 100) / 100,
      reason: reasons.join(' + ') || 'Optimal conditions',
    };
  }
}

export default AdvancedRiskManager;
