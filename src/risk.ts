// src/risk.ts
// Intelligent Risk Management with Portfolio-level Controls
// Replaces basic stop-loss with advanced risk management

import AdvancedRiskManager, { PortfolioMetrics, PositionSizing } from './advanced-risk-management.js';
import { TradingSession } from './database.js';

// Constants
const STOP_LOSS_THRESHOLD = 0.15; // 15% trailing stop by default
const PORTFOLIO_MAX_LOSS = 0.25; // Stop all trading if portfolio down 25%
const POSITION_MAX_PCT = 0.15; // Max 15% of portfolio in single position
const MAX_CORRELATIONS_TRADES = 5; // Max 5 correlated trades

/** 
 * Intelligent stop-loss management with trailing stops
 * @param currentPrice - Current price of the asset
 * @param entryPrice - Entry price
 * @param highPrice - Highest price reached
 * @param trailingStopPct - Trailing stop percentage
 * @returns object - { shouldStop: boolean, reason: string }
 */
function manageStopLoss(
    currentPrice: number,
    entryPrice: number,
    highPrice: number,
    trailingStopPct: number = STOP_LOSS_THRESHOLD
): { shouldStop: boolean; reason: string } {
    // Hard stop (entry price loss)
    const hardStopLoss = (entryPrice - currentPrice) / entryPrice;
    if (hardStopLoss >= 0.3) {
        return {
            shouldStop: true,
            reason: `Hard stop triggered: ${(hardStopLoss * 100).toFixed(2)}% loss`,
        };
    }

    // Trailing stop (from high price)
    const trailingStop = (highPrice - currentPrice) / highPrice;
    if (trailingStop >= trailingStopPct / 100) {
        return {
            shouldStop: true,
            reason: `Trailing stop triggered: ${(trailingStop * 100).toFixed(2)}% from high`,
        };
    }

    return { shouldStop: false, reason: 'Price within acceptable range' };
}

/** 
 * Monitor portfolio-level risk conditions
 * @param portfolioMetrics - Portfolio metrics
 * @returns object - { shouldStop: boolean, reason: string, action: string }
 */
function monitorPortfolioHealth(portfolioMetrics: PortfolioMetrics): {
    shouldStop: boolean;
    reason: string;
    action: string;
} {
    // Check portfolio with circuit breaker
    if (portfolioMetrics.profitPct < -PORTFOLIO_MAX_LOSS) {
        return {
            shouldStop: true,
            reason: `Portfolio loss ${Math.abs(portfolioMetrics.profitPct).toFixed(2)}% > max ${PORTFOLIO_MAX_LOSS * 100}%`,
            action: 'STOP_ALL_TRADING',
        };
    }

    // Check risk level
    if (portfolioMetrics.riskLevel === 'CRITICAL') {
        return {
            shouldStop: true,
            reason: 'Portfolio risk level CRITICAL',
            action: 'REDUCE_POSITIONS',
        };
    }

    // Check Sharpe ratio deterioration
    if (portfolioMetrics.sharpeRatio < -1) {
        return {
            shouldStop: true,
            reason: 'Sharpe ratio negative - strategy underperforming',
            action: 'REVIEW_STRATEGY',
        };
    }

    // Check drawdown
    if (portfolioMetrics.maxDrawdown > 0.5) {
        return {
            shouldStop: false,
            reason: `High drawdown: ${(portfolioMetrics.maxDrawdown * 100).toFixed(2)}%`,
            action: 'REDUCE_RISK',
        };
    }

    return {
        shouldStop: false,
        reason: 'Portfolio health is acceptable',
        action: 'CONTINUE',
    };
}

/** 
 * Monitor fallback conditions (legacy function, now enhanced)
 * @param currentCondition - Current condition or price
 * @param fallbackCondition - Fallback threshold
 * @param context - Additional context for smarter decision
 * @returns boolean - Whether to trigger fallback
 */
function monitorFallback(
    currentCondition: number,
    fallbackCondition: number,
    context?: { trend?: string; volatility?: number }
): boolean {
    return currentCondition <= fallbackCondition;
}

/** 
 * Check position concentration risk
 * @param activeTrades - Active trading sessions
 * @param portfolioValue - Total portfolio value
 * @returns object - { isRisky: boolean; maxConcentration: number; reason: string }
 */
function checkPositionConcentration(
    activeTrades: TradingSession[],
    portfolioValue: number
): { isRisky: boolean; maxConcentration: number; reason: string } {
    if (activeTrades.length === 0) {
        return { isRisky: false, maxConcentration: 0, reason: 'No active positions' };
    }

    const concentrations = activeTrades.map(t => (t.entryAmount / portfolioValue) * 100);
    const maxConcentration = Math.max(...concentrations);

    if (maxConcentration > POSITION_MAX_PCT * 100) {
        return {
            isRisky: true,
            maxConcentration,
            reason: `Max position ${maxConcentration.toFixed(2)}% exceeds ${POSITION_MAX_PCT * 100}% limit`,
        };
    }

    return {
        isRisky: false,
        maxConcentration,
        reason: `Concentration healthy (max ${maxConcentration.toFixed(2)}%)`,
    };
}

/** 
 * Calculate intelligent position size with risk management
 * @param baseSize - Base position size
 * @param portfolioMetrics - Portfolio metrics
 * @param volatility - Token volatility
 * @returns PositionSizing - Intelligent position sizing
 */
function calculateIntelligentPositionSize(
    baseSize: number,
    portfolioMetrics: PortfolioMetrics | null,
    volatility: number
): PositionSizing {
    if (!portfolioMetrics) {
        // Fallback to basic sizing
        return {
            baseSize,
            adjustedSize: baseSize * 0.8,
            volatilityFactor: 1,
            correlationFactor: 1,
            riskFactor: 1,
            maxAllowedSize: baseSize * 1.5,
            reason: 'Using default sizing (no portfolio metrics)',
        };
    }

    // Use advanced risk manager for intelligent sizing
    return AdvancedRiskManager.calculateIntelligentPositionSize(
        baseSize,
        volatility,
        portfolioMetrics.correlationRisk,
        portfolioMetrics.healthScore,
        portfolioMetrics.maxDrawdown
    );
}

// Exporting enhanced functions
export {
    manageStopLoss,
    monitorPortfolioHealth,
    monitorFallback,
    checkPositionConcentration,
    calculateIntelligentPositionSize,
    AdvancedRiskManager,
};