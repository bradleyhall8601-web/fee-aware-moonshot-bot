import { config } from "./config";
import { filterCandidates } from "./filter";
import { logger } from "./logger";
import { PaperTrader } from "./paper";
import { scanDexScreenerPairs } from "./scanner";
import { executeSwap } from "./swapper";

export class MoonshotBot {
  constructor(private readonly paperTrader: PaperTrader) {}

  async runCycle(): Promise<void> {
    const monitored = this.paperTrader.monitorOpenPositions();
    const closed = this.paperTrader.evaluateExits(config.profitTargetPct, config.trailingStopPct);
    const pairs = await scanDexScreenerPairs();
    const candidates = filterCandidates(pairs);

    let opened = 0;
    for (const candidate of candidates) {
      if (this.paperTrader.openPaperPosition(candidate)) {
        await executeSwap(candidate);
        opened += 1;
      }
    }

    const state = this.paperTrader.getState();
    state.lastCycleAtMs = Date.now();

    logger.info(
      {
        monitored,
        closed,
        scanned: pairs.length,
        candidates: candidates.length,
        opened,
        openPositions: state.positions.length,
        paperBalanceUsd: Number(state.paperBalanceUsd.toFixed(2))
      },
      "Cycle complete"
    );
  }
}
