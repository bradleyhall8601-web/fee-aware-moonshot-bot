import { config } from "./config";
import { Position } from "./types";

export interface EntryDecision {
    allowed: boolean;
    reason?: string;
    perTradeUsd: number;
    spendCapUsd: number;
    remainingBudgetUsd: number;
    sizeUsd: number;
}

export function profitOrLossPct(entryPriceUsd: number, currentPriceUsd: number): number {
    if (entryPriceUsd <= 0) {
        return 0;
    }
    return ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100;
}

export function manageStopLoss(currentPrice: number, purchasePrice: number): boolean {
    const lossPercentage = (purchasePrice - currentPrice) / purchasePrice;
    return lossPercentage >= 0.05;
}

export function monitorFallback(currentCondition: number, fallbackCondition: number): boolean {
    return currentCondition <= fallbackCondition;
}

export function isTrailingStopBreached(position: Position, currentPriceUsd: number): boolean {
    const stopPrice = position.highWatermarkUsd * (1 - config.trailingStopPct / 100);
    return currentPriceUsd <= stopPrice;
}

export function isProfitTargetReached(position: Position, currentPriceUsd: number): boolean {
    return profitOrLossPct(position.entryPriceUsd, currentPriceUsd) >= config.profitTargetPct;
}

export type PositionAction = "partial_take_profit" | "exit_trailing_stop" | "exit_momentum_loss" | null;

export function evaluatePositionAction(position: Position, currentPriceUsd: number): PositionAction {
    if (!position.hasTakenProfit && isProfitTargetReached(position, currentPriceUsd)) {
        return "partial_take_profit";
    }

    if (isTrailingStopBreached(position, currentPriceUsd)) {
        return "exit_trailing_stop";
    }

    if (position.hasTakenProfit && position.momentumFailCount > 0) {
        return "exit_momentum_loss";
    }

    if (position.momentumFailCount >= config.maxMomentumFailCount) {
        return "exit_momentum_loss";
    }

    return null;
}

export function perTradeUsd(walletUsd: number): number {
    if (!config.sizingLadder) {
        return 10;
    }
    return walletUsd < 100 ? 5 : 10;
}

export function evaluateEntryRisk(params: {
    walletUsd: number;
    currentExposureUsd: number;
    openPositions: number;
}): EntryDecision {
    const spendableWalletUsd = Math.max(0, params.walletUsd - config.gasReserveUsd);
    const spendCapUsd = Math.min(config.walletSpendCapUsd, spendableWalletUsd);
    const remainingBudgetUsd = spendCapUsd - Math.max(0, params.currentExposureUsd) - config.networkFeeUsdEstimate;
    const ladderSizeUsd = perTradeUsd(params.walletUsd);
    const sizeUsd = Math.max(0, Math.min(ladderSizeUsd, remainingBudgetUsd));

    if (params.openPositions >= config.maxConcurrentPositions) {
        return {
            allowed: false,
            reason: "max_positions",
            perTradeUsd: ladderSizeUsd,
            spendCapUsd,
            remainingBudgetUsd,
            sizeUsd: 0
        };
    }

    if (remainingBudgetUsd <= 0) {
        return {
            allowed: false,
            reason: "budget_exhausted",
            perTradeUsd: ladderSizeUsd,
            spendCapUsd,
            remainingBudgetUsd,
            sizeUsd: 0
        };
    }

    if (sizeUsd < config.minTradeUsd) {
        return {
            allowed: false,
            reason: "below_min_trade",
            perTradeUsd: ladderSizeUsd,
            spendCapUsd,
            remainingBudgetUsd,
            sizeUsd: 0
        };
    }

    return {
        allowed: sizeUsd > 0,
        reason: sizeUsd > 0 ? undefined : "size_zero",
        perTradeUsd: ladderSizeUsd,
        spendCapUsd,
        remainingBudgetUsd,
        sizeUsd
    };
}
