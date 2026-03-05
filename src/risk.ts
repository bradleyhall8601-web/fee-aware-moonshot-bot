export function profitOrLossPct(entryPriceUsd: number, currentPriceUsd: number): number {
    if (entryPriceUsd <= 0) {
        return 0;
    }
    return ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100;
}
