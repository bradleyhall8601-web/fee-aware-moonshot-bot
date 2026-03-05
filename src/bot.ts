import { Keypair } from "@solana/web3.js";
import { config } from "./config";
import { env, hasWallet, isDryRun, isLiveEnabled, isMonitorOnlyLiveMode } from "./env";
import { filterCandidates } from "./filter";
import { logger } from "./logger";
import { PaperTrader } from "./paper";
import { getSolBalance, getSolPriceUsd } from "./rpc";
import { evaluateEntryRisk, evaluatePositionAction } from "./risk";
import { fetchLatestSolanaPairs } from "./scanner";
import { executeSwapFromQuote, getQuote, isPriceImpactAcceptable } from "./swapper";
import { DexPair } from "./types";
import { getWalletKeypair, getWalletPubkey } from "./wallet";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

function estimateFeeCostUsd(sizeUsd: number): number {
  return Number((sizeUsd * 0.003 + config.networkFeeUsdEstimate).toFixed(6));
}

function usdToLamports(usd: number, solUsd: number): number {
  const safePrice = solUsd > 0 ? solUsd : config.solUsdFallback;
  return Math.max(1, Math.floor((usd / safePrice) * 1_000_000_000));
}

export interface MoonshotBotOptions {
  persistState: () => Promise<void>;
  fetchPairs?: () => Promise<DexPair[]>;
  filterPairs?: (pairs: DexPair[]) => DexPair[];
  quoteFn?: typeof getQuote;
  executeSwapFromQuoteFn?: typeof executeSwapFromQuote;
}

export class MoonshotBot {
  private readonly seenPairQueue: string[];
  private readonly seenPairSet: Set<string>;

  constructor(
    private readonly trader: PaperTrader,
    private readonly options: MoonshotBotOptions
  ) {
    this.seenPairQueue = [...this.trader.getState().seenPairs];
    this.seenPairSet = new Set(this.seenPairQueue);
  }

  private async recordState(): Promise<void> {
    const state = this.trader.getState();
    state.exposureUsd = this.trader.getExposureUsd();
    state.seenPairs = [...this.seenPairQueue];
    state.updatedAtMs = Date.now();
    await this.options.persistState();
  }

  async updateWalletSnapshot(): Promise<boolean> {
    const hasWalletIdentity = Boolean(env.WALLET_PUBKEY || env.WALLET_PRIVATE_KEY || env.WALLET_KEYPAIR_PATH);
    if (!hasWalletIdentity && !config.enableLiveTrading) {
      return false;
    }

    try {
      const pubkey = getWalletPubkey();
      const [solBalance, solUsd] = await Promise.all([getSolBalance(pubkey), getSolPriceUsd()]);
      this.trader.getState().lastWalletSnapshot = {
        solBalance,
        solUsd,
        walletUsd: solBalance * solUsd,
        updatedAtMs: Date.now()
      };
      return true;
    } catch (error) {
      logger.warn({ err: error }, "Wallet snapshot update failed; keeping previous snapshot");
      return false;
    }
  }

  private getSignerWallet(): Keypair {
    const wallet = getWalletKeypair();
    if (!wallet) {
      throw new Error("Live swap requires WALLET_PRIVATE_KEY or WALLET_KEYPAIR_PATH");
    }
    return wallet;
  }

  async managePositionsTick(): Promise<void> {
    const snapshotUpdated = await this.updateWalletSnapshot();
    if (snapshotUpdated) {
      await this.recordState();
    }
    const monitored = this.trader.monitorOpenPositions();

    let partials = 0;
    let closed = 0;

    for (const position of [...this.trader.getPositions()]) {
      const action = evaluatePositionAction(position, position.lastPriceUsd);
      if (!action) {
        continue;
      }

      if (action === "partial_take_profit") {
        const feeUsd = estimateFeeCostUsd(position.remainingSizeUsd * 0.5);
        let signature: string | undefined;

        if (isLiveEnabled() && hasWallet) {
          try {
            const amountRawHalf = position.amountRaw ? (BigInt(position.amountRaw) / 2n).toString() : undefined;
            const quote = await (this.options.quoteFn ?? getQuote)(
              position.mint,
              WSOL_MINT,
              Number(amountRawHalf ?? Math.max(1, Math.floor(position.remainingTokens * 500_000))),
              config.slippageBps
            );
            const out = await (this.options.executeSwapFromQuoteFn ?? executeSwapFromQuote)(
              quote,
              this.getSignerWallet(),
              env.RPC_URL,
              env.JUPITER_API_URL,
              config.slippageBps
            );
            signature = out ?? undefined;
          } catch (error) {
            logger.error({ err: error, mint: position.mint }, "Partial sell failed; skipping mint");
            continue;
          }
        }

        const updated = this.trader.applyPartialSell(position.mint, position.lastPriceUsd, feeUsd, signature);
        if (updated) {
          partials += 1;
          await this.recordState();
        }
        continue;
      }

      const reason = action === "exit_trailing_stop" ? "trailing_stop" : "momentum_loss";
      const feeUsd = estimateFeeCostUsd(position.remainingSizeUsd);
      let signature: string | undefined;

      if (isLiveEnabled() && hasWallet) {
        try {
          const quote = await (this.options.quoteFn ?? getQuote)(
            position.mint,
            WSOL_MINT,
            Number(position.amountRaw ?? Math.max(1, Math.floor(position.remainingTokens * 1_000_000))),
            config.slippageBps
          );
          const out = await (this.options.executeSwapFromQuoteFn ?? executeSwapFromQuote)(
            quote,
            this.getSignerWallet(),
            env.RPC_URL,
            env.JUPITER_API_URL,
            config.slippageBps
          );
          signature = out ?? undefined;
        } catch (error) {
          logger.error({ err: error, mint: position.mint }, "Exit swap failed; skipping mint");
          continue;
        }
      }

      const trade = this.trader.closePosition(position.mint, position.lastPriceUsd, reason, feeUsd, signature);
      if (trade) {
        closed += 1;
        await this.recordState();
      }
    }

    logger.info({ monitored, partials, closed }, "Positions managed");
  }

  private trackSeenPair(pairAddress: string): void {
    if (this.seenPairSet.has(pairAddress)) {
      return;
    }
    this.seenPairSet.add(pairAddress);
    this.seenPairQueue.push(pairAddress);
    while (this.seenPairQueue.length > config.maxSeenPairs) {
      const removed = this.seenPairQueue.shift();
      if (removed) {
        this.seenPairSet.delete(removed);
      }
    }
  }

  async scanAndEnterTick(): Promise<void> {
    await this.managePositionsTick();

    const pairs = await (this.options.fetchPairs ?? fetchLatestSolanaPairs)();
    const unseenPairs = pairs.filter((pair) => !this.seenPairSet.has(pair.pairAddress));
    unseenPairs.forEach((pair) => this.trackSeenPair(pair.pairAddress));
    if (unseenPairs.length > 0) {
      await this.recordState();
    }

    const candidates = (this.options.filterPairs ?? filterCandidates)(unseenPairs);
    let opened = 0;

    for (const candidate of candidates) {
      const snapshot = this.trader.getState().lastWalletSnapshot;
      const riskWalletUsd = isLiveEnabled() ? snapshot.walletUsd : this.trader.getState().paperBalanceUsd;
      const decision = evaluateEntryRisk({
        walletUsd: riskWalletUsd,
        currentExposureUsd: this.trader.getExposureUsd(),
        openPositions: this.trader.getOpenCount()
      });

      if (!decision.allowed || decision.sizeUsd <= 0) {
        continue;
      }

      const feeUsd = estimateFeeCostUsd(decision.sizeUsd);
      let signature: string | undefined;
      let outAmountRaw: string | undefined;

      if (isLiveEnabled()) {
        if (isMonitorOnlyLiveMode()) {
          logger.info({ mint: candidate.mint }, "Monitor-only mode: skipping live entry swap");
          continue;
        }

        const inLamports = usdToLamports(decision.sizeUsd, snapshot.solUsd || config.solUsdFallback);

        try {
          const quote = await (this.options.quoteFn ?? getQuote)(
            WSOL_MINT,
            candidate.mint,
            inLamports,
            config.slippageBps
          );
          if (!isPriceImpactAcceptable(quote)) {
            logger.info({ mint: candidate.mint, priceImpactPct: quote.priceImpactPct }, "Live entry blocked by price impact");
            continue;
          }

          if (isDryRun()) {
            logger.info(
              {
                inputMint: quote.inputMint,
                outputMint: quote.outputMint,
                inAmount: quote.inAmount,
                mint: candidate.mint
              },
              "DRY_RUN: would submit swap"
            );
            continue;
          }

          if (!hasWallet) {
            logger.error({ mint: candidate.mint }, "Live entry skipped: signer wallet unavailable");
            continue;
          }

          signature = await (this.options.executeSwapFromQuoteFn ?? executeSwapFromQuote)(
            quote,
            this.getSignerWallet(),
            env.RPC_URL,
            env.JUPITER_API_URL,
            config.slippageBps
          ) ?? undefined;
          outAmountRaw = quote.outAmount;
          logger.info({ mint: candidate.mint, signature }, "Live entry swap submitted");
        } catch (error) {
          logger.error({ err: error, mint: candidate.mint }, "Live entry failed; skipping mint");
          continue;
        }
      }

      const openedPosition = this.trader.openPosition(candidate, decision.sizeUsd, feeUsd, signature, outAmountRaw);
      if (openedPosition) {
        opened += 1;
        await this.recordState();
      }
    }

    const state = this.trader.getState();
    state.lastCycleAtMs = Date.now();

    logger.info(
      {
        scanned: pairs.length,
        unseen: unseenPairs.length,
        candidates: candidates.length,
        opened,
        openPositions: state.positions.length,
        exposureUsd: Number(state.exposureUsd.toFixed(2)),
        totalPnlUsd: Number(state.stats.totalPnlUsd.toFixed(2)),
        liveTrading: config.enableLiveTrading,
        walletSnapshot: state.lastWalletSnapshot
      },
      "Cycle complete"
    );
  }

  async healthTick(): Promise<void> {
    const state = this.trader.getState();
    logger.info(
      {
        openPositions: state.positions.length,
        tradeCount: state.stats.tradeCount,
        totalPnlUsd: Number(state.stats.totalPnlUsd.toFixed(2)),
        seenPairs: state.seenPairs.length,
        walletSnapshot: state.lastWalletSnapshot,
        liveTrading: config.enableLiveTrading
      },
      "Health tick"
    );
  }
}
