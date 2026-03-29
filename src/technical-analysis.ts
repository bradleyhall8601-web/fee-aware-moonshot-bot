// src/technical-analysis.ts
// Advanced technical analysis with multiple indicators

import telemetryLogger from './telemetry';

export interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface TechnicalIndicators {
  rsi: number | null;
  macd: { line: number; signal: number; histogram: number } | null;
  bollingerBands: { upper: number; middle: number; lower: number } | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  momentum: number | null;
  volatility: number; // 0-100
  slope: number; // Price trend slope
  overbought: boolean;
  oversold: boolean;
}

class TechnicalAnalysis {
  /**
   * Calculate RSI (Relative Strength Index)
   * RSI > 70 = Overbought, RSI < 30 = Oversold
   */
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // Neutral if insufficient data

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100; // All gains
    if (avgGain === 0) return 0; // All losses

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return Math.round(rsi * 100) / 100;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { line: number; signal: number; histogram: number } | null {
    if (prices.length < slowPeriod) return null;

    const ema12 = this.calculateEMA(prices, fastPeriod);
    const ema26 = this.calculateEMA(prices, slowPeriod);

    if (!ema12 || !ema26) return null;

    const macdLine = ema12 - ema26;

    // Calculate signal line (EMA of MACD)
    const macdValues = [];
    for (let i = slowPeriod - 1; i < prices.length; i++) {
      const fast = this.calculateEMA(prices.slice(0, i + 1), fastPeriod);
      const slow = this.calculateEMA(prices.slice(0, i + 1), slowPeriod);
      if (fast && slow) {
        macdValues.push(fast - slow);
      }
    }

    const signalLine = this.calculateEMA(macdValues, signalPeriod) || 0;
    const histogram = macdLine - signalLine;

    return {
      line: Math.round(macdLine * 10000) / 10000,
      signal: Math.round(signalLine * 10000) / 10000,
      histogram: Math.round(histogram * 10000) / 10000,
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  static calculateBollingerBands(prices: number[], period: number = 20, stdDevs: number = 2): { upper: number; middle: number; lower: number } | null {
    if (prices.length < period) return null;

    const recentPrices = prices.slice(-period);
    const middle = recentPrices.reduce((a, b) => a + b) / period;

    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: Math.round((middle + stdDevs * stdDev) * 10000) / 10000,
      middle: Math.round(middle * 10000) / 10000,
      lower: Math.round((middle - stdDevs * stdDev) * 10000) / 10000,
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  static calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;
    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);
    return Math.round((sum / period) * 10000) / 10000;
  }

  /**
   * Calculate Exponential Moving Average
   */
  static calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
    }

    return Math.round(ema * 10000) / 10000;
  }

  /**
   * Calculate Momentum (ROC - Rate of Change)
   */
  static calculateMomentum(prices: number[], period: number = 12): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const previous = prices[prices.length - period - 1];
    const momentum = ((current - previous) / previous) * 100;
    return Math.round(momentum * 100) / 100;
  }

  /**
   * Calculate Volatility (coefficient of variation)
   * Returns 0-100 scale (higher = more volatile)
   */
  static calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 50; // Neutral

    const mean = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100;

    return Math.min(cv, 100); // Cap at 100
  }

  /**
   * Calculate price slope / trend strength
   */
  static calculateSlope(prices: number[]): number {
    if (prices.length < 2) return 0;

    const n = prices.length;
    const xMean = (n - 1) / 2;
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (prices[i] - prices[0]);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    return Math.round(slope * 10000) / 10000;
  }

  /**
   * Comprehensive technical analysis
   */
  static analyzeToken(priceHistory: PricePoint[]): TechnicalIndicators {
    if (priceHistory.length === 0) {
      return {
        rsi: null,
        macd: null,
        bollingerBands: null,
        sma20: null,
        sma50: null,
        ema12: null,
        ema26: null,
        momentum: null,
        volatility: 50,
        slope: 0,
        overbought: false,
        oversold: false,
      };
    }

    const prices = priceHistory.map(p => p.price);

    const rsi = this.calculateRSI(prices, 14);
    const macd = this.calculateMACD(prices);
    const bb = this.calculateBollingerBands(prices, 20, 2);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const momentum = this.calculateMomentum(prices, 12);
    const volatility = this.calculateVolatility(prices);
    const slope = this.calculateSlope(prices);

    return {
      rsi,
      macd,
      bollingerBands: bb,
      sma20,
      sma50,
      ema12,
      ema26,
      momentum,
      volatility,
      slope,
      overbought: rsi > 70,
      oversold: rsi < 30,
    };
  }

  /**
   * Generate trading signal from indicators
   * Returns -1 (sell), 0 (hold), or 1 (buy)
   */
  static generateSignal(indicators: TechnicalIndicators): number {
    let signal = 0;
    let signals = [];

    // RSI signals
    if (indicators.rsi && indicators.rsi < 30) {
      signals.push(1); // Oversold = potential buy
    } else if (indicators.rsi && indicators.rsi > 70) {
      signals.push(-1); // Overbought = potential sell
    }

    // MACD signals
    if (indicators.macd) {
      if (indicators.macd.histogram > 0 && indicators.macd.line > indicators.macd.signal) {
        signals.push(1); // Bullish crossover
      } else if (indicators.macd.histogram < 0 && indicators.macd.line < indicators.macd.signal) {
        signals.push(-1); // Bearish crossover
      }
    }

    // Momentum signals
    if (indicators.momentum && indicators.momentum > 2) {
      signals.push(1); // Positive momentum
    } else if (indicators.momentum && indicators.momentum < -2) {
      signals.push(-1); // Negative momentum
    }

    // Bollinger Bands signals
    if (indicators.bollingerBands) {
      const currentPrice = 0; // Would need current price here
      // Could add logic for price touching bands
    }

    // Average signals
    if (signals.length > 0) {
      signal = signals.reduce((a, b) => a + b) / signals.length;
    }

    return Math.round(signal);
  }
}

export default TechnicalAnalysis;
