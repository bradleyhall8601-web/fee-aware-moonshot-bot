import { config } from "./config";
import { filterCandidates } from "./filter";
import { logger } from "./logger";
import { PaperTrader } from "./paper";
import { evaluatePositionAction } from "./risk";
import { scanDexScreenerPairs } from "./scanner";
import { executeLiveSwap, LiveTradingContext } from "./swapper";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

function estimateFeeCostUsd(baseSizeUsd: number): number {
  const variableFee = baseSizeUsd * 0.003;
  return Number((variableFee + config.networkFeeUsdEstimate).toFixed(6));
}

function computeLadderSizeUsd(openCount: number): number {
  if (!config.sizingLadder) {
    return Math.min(10, config.walletSpendCapUsd);
  }

  if (openCount <= 0) return 10;
  if (openCount === 1) return 6;
  return 4;
}

export interface MoonshotBotOptions {
  liveTradingContext?: LiveTradingContext;
  persistState: () => Promise<void>;
}

export class MoonshotBot {
  constructor(
    private readonly paperTrader: PaperTrader,
    private readonly options: MoonshotBotOptions
  ) {}

  private get isLiveEnabled(): boolean {
    return config.enableLiveTrading && Boolean(this.options.liveTradingContext);
  }

  async runCycle(): Promise<void> {
    const monitored = this.paperTrader.monitorOpenPositions();

    let closed = 0;
    let partials = 0;
    for (const position of [...this.paperTrader.getPositions()]) {
      const action = evaluatePositionAction(position, position.lastPriceUsd);
      if (!action) {
        continue;
      }

      if (action === "partial_take_profit") {
        const partialSizeRaw = position.amountRaw ? (BigInt(position.amountRaw) / 2n).toString() : undefined;
        let feeUsd = estimateFeeCostUsd(position.sizeUsd * 0.5);
        let txSig: string | undefined;

        if (this.isLiveEnabled) {
          try {
            const result = await executeLiveSwap(
              this.options.liveTradingContext as LiveTradingContext,
              {
                inputMint: position.mint,
                outputMint: WSOL_MINT,
                amount: partialSizeRaw ?? String(Math.max(1, Math.floor(position.amountTokens * 500_000)))
              },
              {
                dryRun: config.dryRun,
                maxPriceImpactPct: config.maxPriceImpactPct,
                slippageBps: config.slippageBps,
                feeUsdEstimate: feeUsd
              }
            );
            feeUsd = result.feeUsd;
            txSig = result.txSig;
            logger.info({ mint: position.mint, txSig, dryRun: result.dryRun }, "Partial sell executed");
          } catch (error) {
            logger.error({ err: error, mint: position.mint }, "Partial sell failed; keeping full position");
            continue;
          }
        }

        const updated = this.paperTrader.applyPartialSell(position.mint, position.lastPriceUsd, feeUsd, txSig);
        if (updated) {
          partials += 1;
          await this.options.persistState();
        }
        continue;
      }

      const reason = action === "exit_trailing_stop" ? "trailing_stop" : "momentum_loss";
      let feeUsd = estimateFeeCostUsd(position.sizeUsd);
      let txSig: string | undefined;

      if (this.isLiveEnabled) {
        try {
          const result = await executeLiveSwap(
            this.options.liveTradingContext as LiveTradingContext,
            {
              inputMint: position.mint,
              outputMint: WSOL_MINT,
              amount: position.amountRaw ?? String(Math.max(1, Math.floor(position.amountTokens * 1_000_000)))
            },
            {
              dryRun: config.dryRun,
              maxPriceImpactPct: config.maxPriceImpactPct,
              slippageBps: config.slippageBps,
              feeUsdEstimate: feeUsd
            }
          );
          feeUsd = result.feeUsd;
          txSig = result.txSig;
          logger.info({ mint: position.mint, txSig, dryRun: result.dryRun }, "Exit swap executed");
        } catch (error) {
          logger.error({ err: error, mint: position.mint }, "Exit swap failed; skipping this mint");
          continue;
        }
      }

      const trade = this.paperTrader.closePosition(position.mint, position.lastPriceUsd, reason, feeUsd, txSig);
      if (trade) {
        closed += 1;
        await this.options.persistState();
      }
    }

    const pairs = await scanDexScreenerPairs();
    const candidates = filterCandidates(pairs);

    const currentOpen = this.paperTrader.getPositions().length;
    const currentExposure = this.paperTrader.getPositions().reduce((acc, position) => acc + position.sizeUsd, 0);
    const remainingSlots = Math.max(0, config.maxConcurrentPositions - currentOpen);
    const remainingCapUsd = Math.max(0, config.walletSpendCapUsd - currentExposure);

    let opened = 0;
    for (const candidate of candidates.slice(0, remainingSlots)) {
      if ((candidate.priceImpactPct ?? 0) > config.maxPriceImpactPct) {
        continue;
      }

      const intendedSizeUsd = computeLadderSizeUsd(this.paperTrader.getPositions().length);
      const buyUsd = Math.max(0, Math.min(intendedSizeUsd, remainingCapUsd));
      if (buyUsd <= 0) {
        continue;
      }

      let feeUsd = estimateFeeCostUsd(buyUsd);
      let entryTxSig: string | undefined;
      let amountRaw: string | undefined;

      if (this.isLiveEnabled) {
        try {
          const inLamports = Math.max(1, Math.floor((buyUsd / config.solPriceUsdEstimate) * 1_000_000_000));
          const result = await executeLiveSwap(
            this.options.liveTradingContext as LiveTradingContext,
            {
              inputMint: WSOL_MINT,
              outputMint: candidate.mint,
              amount: String(inLamports)
            },
            {
              dryRun: config.dryRun,
              maxPriceImpactPct: config.maxPriceImpactPct,
              slippageBps: config.slippageBps,
              feeUsdEstimate: feeUsd
            }
          );
          feeUsd = result.feeUsd;
          entryTxSig = result.txSig;
          amountRaw = result.outAmount;
          logger.info({ mint: candidate.mint, txSig: result.txSig, dryRun: result.dryRun }, "Entry swap executed");
        } catch (error) {
          logger.error({ err: error, mint: candidate.mint }, "Live entry failed; skipping mint");
          continue;
        }
      }

      const openedPosition = this.paperTrader.openPaperPosition(candidate, buyUsd, feeUsd, entryTxSig, amountRaw);
      if (openedPosition) {
        opened += 1;
        await this.options.persistState();
      }
    }

    const state = this.paperTrader.getState();
    state.lastCycleAtMs = Date.now();

    logger.info(
      {
        monitored,
        closed,
        partials,
        scanned: pairs.length,
        candidates: candidates.length,
        opened,
        openPositions: state.positions.length,
        paperBalanceUsd: Number(state.paperBalanceUsd.toFixed(2)),
        realizedPnlUsd: Number(state.realizedPnlUsd.toFixed(2)),
        liveTrading: this.isLiveEnabled,
        dryRun: config.dryRun
      },
      "Cycle complete"
    );
  }
}
