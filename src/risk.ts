import { config } from "./config";
import { Position } from "./types";

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
    if (!position.partialTaken && isProfitTargetReached(position, currentPriceUsd)) {
        return "partial_take_profit";
    }

    if (isTrailingStopBreached(position, currentPriceUsd)) {
        return "exit_trailing_stop";
    }

    if (position.partialTaken && position.momentumFailCount > 0) {
        return "exit_momentum_loss";
    }

    if (position.momentumFailCount >= config.maxMomentumFailCount) {
        return "exit_momentum_loss";
    }

    return null;
}
