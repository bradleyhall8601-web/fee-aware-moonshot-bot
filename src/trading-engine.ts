import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import database, { TradingSession } from './database';
import telemetryLogger from './telemetry';
import userManager from './user-manager';
import jupiterExecutor from './jupiter-executor';
import aiBrain from './ai-brain';

const bs58 = require('bs58');

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const MIN_BPS = 200;
const MAX_BPS = 800;
const REENTRY_COOLDOWN_MS = Number(process.env.REENTRY_COOLDOWN_MS || 15 * 60 * 1000);

interface Trade { mint: string; entryPrice: number; entryAmount: number; currentPrice: number; profitPct: number; riskReward: number; }
interface TradingSignal { type: 'BUY' | 'SELL'; mint: string; price: number; confidence: number; reason: string; qualityScore?: number; }
interface CandidateInput {
  mint: string; symbol?: string; name?: string; price: number; liquidity: number; volume24h: number;
  buys?: number; sells?: number; age?: number; holders?: number; confidence?: number;
  priceChange1m?: number; priceChange5m?: number; buyPressure?: number; prevVolume24h?: number;
  liquidityLockedPct?: number; mintAuthorityRevoked?: boolean; freezeAuthorityRevoked?: boolean;
  holderConcentrationPct?: number; higherHighs?: boolean; microTrendUp?: boolean;
}

type MarketMode = 'AGGRESSIVE' | 'NEUTRAL' | 'DEFENSIVE';

class TradingEngine {
  private connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com', {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
  private executionLocks = new Set<string>();
  private userCircuit = new Map<string, { failures: number; pauseUntil: number }>();
  private reentryCooldown = new Map<string, number>();
  private lastMarketSignals = new Map<string, CandidateInput>();
  private partialTakeProfitDone = new Set<string>();
  private shortTermAggression = 1;
  private lastAggressionResetDay = '';

  private async withRpcRetry<T>(opName: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let i = 1; i <= attempts; i += 1) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        telemetryLogger.error(`RPC_${opName}_FAIL attempt ${i}/${attempts}: ${msg}`, 'trading-engine', err);
        if (i < attempts) {
          await new Promise((r) => setTimeout(r, i * 1200));
        }
      }
    }
    throw new Error(`RPC_${opName}_UNAVAILABLE: ${String(lastErr)}`);
  }

  private lockKey(userId: string, tokenMint: string): string {
    return `${userId}:${tokenMint}`;
  }

  private resetDailyAggressionIfNeeded(): void {
    const now = new Date();
    const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
    if (dayKey !== this.lastAggressionResetDay) {
      this.shortTermAggression = 1;
      this.lastAggressionResetDay = dayKey;
      telemetryLogger.info('📅 DAILY_RESET short-term aggression reset', 'trading-engine');
    }
  }

  private getMarketMode(): MarketMode {
    const streak = aiBrain.getSummary().streak;
    if (streak.wins >= 3) return 'AGGRESSIVE';
    if (streak.losses >= 3) return 'DEFENSIVE';
    return 'NEUTRAL';
  }

  private cooldownKey(userId: string, tokenMint: string): string {
    return `${userId}:${tokenMint}`;
  }

  private isInCooldown(userId: string, tokenMint: string): boolean {
    const ts = this.reentryCooldown.get(this.cooldownKey(userId, tokenMint));
    return !!ts && Date.now() - ts < REENTRY_COOLDOWN_MS;
  }

  private markCooldown(userId: string, tokenMint: string): void {
    this.reentryCooldown.set(this.cooldownKey(userId, tokenMint), Date.now());
  }

  private isCircuitOpen(userId: string): boolean {
    const circuit = this.userCircuit.get(userId);
    return !!circuit && circuit.pauseUntil > Date.now();
  }

  private registerFailure(userId: string, tokenMint: string, side: 'BUY' | 'SELL', reason: string): void {
    const current = this.userCircuit.get(userId) || { failures: 0, pauseUntil: 0 };
    const failures = current.failures + 1;
    const pauseUntil = failures >= 3 ? Date.now() + 5 * 60 * 1000 : 0;
    this.userCircuit.set(userId, { failures, pauseUntil });

    this.shortTermAggression = Math.max(0.7, this.shortTermAggression - 0.05);

    const totalFails = database.incrementUserFailure(userId);
    database.recordExecutionMetric({ userId, tokenMint, side, success: false, slippageBps: 0, durationMs: 0, reason });
    telemetryLogger.warn(`❌ TRADE_FAIL user=${userId} token=${tokenMint} side=${side} reason=${reason} circuit=${failures} dbFails=${totalFails}`, 'trading-engine');
  }

  private clearFailure(userId: string): void {
    this.userCircuit.set(userId, { failures: 0, pauseUntil: 0 });
    database.clearUserFailures(userId);
  }

  private passesRugFilters(tokenData: CandidateInput): { ok: boolean; reason: string } {
    if ((tokenData.mintAuthorityRevoked ?? false) === false) return { ok: false, reason: 'mint_authority_not_revoked' };
    if ((tokenData.freezeAuthorityRevoked ?? false) === false) return { ok: false, reason: 'freeze_authority_not_revoked' };
    if ((tokenData.liquidityLockedPct || 0) < 60) return { ok: false, reason: 'liquidity_not_locked_enough' };
    if ((tokenData.holderConcentrationPct || 100) > 35) return { ok: false, reason: 'holder_concentration_too_high' };
    return { ok: true, reason: 'ok' };
  }

  private dynamicSlippageBps(tokenData: CandidateInput): number {
    const liquidityPenalty = tokenData.liquidity < 25000 ? 260 : tokenData.liquidity < 80000 ? 120 : 40;
    const volatility = Math.abs(tokenData.priceChange1m || 0) + Math.abs(tokenData.priceChange5m || 0);
    const volatilityPenalty = Math.min(380, volatility * 30);
    const pressurePenalty = (tokenData.buyPressure || 50) < 45 ? 100 : 0;

    const bps = 200 + liquidityPenalty + volatilityPenalty + pressurePenalty;
    return Math.max(MIN_BPS, Math.min(MAX_BPS, Math.round(bps)));
  }

  private computeTradeQuality(tokenData: CandidateInput, aiConfidence: number): number {
    const liquidityScore = Math.min(30, (tokenData.liquidity / 100000) * 30);
    const volumeScore = Math.min(20, (tokenData.volume24h / 150000) * 20);
    const pressureScore = Math.min(20, Math.max(0, ((tokenData.buyPressure || 50) - 40) * 0.7));
    const aiScore = Math.min(30, aiConfidence * 0.3);
    return Math.max(0, Math.min(100, liquidityScore + volumeScore + pressureScore + aiScore));
  }

  private adaptivePositionSize(baseSize: number): number {
    const summary = aiBrain.getSummary();
    const streak = summary.streak;
    const mode = this.getMarketMode();

    let multiplier = 1;
    if (summary.winRate >= 60) multiplier += Math.min(0.2, ((summary.winRate - 55) / 100));
    if (summary.winRate <= 45) multiplier -= Math.min(0.3, ((50 - summary.winRate) / 100));

    multiplier += Math.min(0.1, streak.wins * 0.02);
    multiplier -= Math.min(0.2, streak.losses * 0.04);

    if (mode === 'AGGRESSIVE') multiplier += 0.05;
    if (mode === 'DEFENSIVE') multiplier -= 0.12;

    multiplier *= this.shortTermAggression;

    return Math.max(0.5, Math.min(1.25, baseSize * multiplier));
  }

  private shouldExitByMarket(signal?: CandidateInput): { shouldExit: boolean; reason: string } {
    if (!signal) return { shouldExit: false, reason: '' };

    const volumeDrop = (signal.prevVolume24h || 0) > 0 && signal.volume24h < (signal.prevVolume24h || 0) * 0.7;
    const pressureReverse = (signal.buys || 0) < (signal.sells || 0) * 1.05 || (signal.buyPressure || 50) < 40;
    const momentumWeak = (signal.priceChange1m || 0) < -1.2 && (signal.priceChange5m || 0) < 0;
    const dumpDetected = (signal.sells || 0) > (signal.buys || 0) * 1.8 || ((signal.liquidityLockedPct || 100) < 30);

    if (dumpDetected) return { shouldExit: true, reason: 'dump_detected' };
    if (volumeDrop) return { shouldExit: true, reason: 'volume_drop' };
    if (pressureReverse) return { shouldExit: true, reason: 'buy_pressure_reversal' };
    if (momentumWeak) return { shouldExit: true, reason: 'momentum_weakening' };

    return { shouldExit: false, reason: '' };
  }

  updateMarketSignals(candidates: CandidateInput[]): void {
    for (const c of candidates) this.lastMarketSignals.set(c.mint, c);
  }

  async analyzeMoonshot(mint: string, candidate?: CandidateInput): Promise<TradingSignal | null> {
    try {
      this.resetDailyAggressionIfNeeded();
      if (!candidate) return null;
      this.lastMarketSignals.set(mint, candidate);

      const rugFilter = this.passesRugFilters(candidate);
      if (!rugFilter.ok) {
        telemetryLogger.info(`🛡️ FILTER_BLOCK mint=${mint} reason=${rugFilter.reason}`, 'trading-engine');
        return null;
      }

      const base = this.evaluateMoonshotPotential(candidate);
      if (!base) return null;

      const adjustedConfidence = aiBrain.adjustConfidence(base.confidence);
      const qualityScore = this.computeTradeQuality(candidate, adjustedConfidence);
      const shadowScore = qualityScore * 0.85 + ((candidate.higherHighs ? 1 : 0) * 10);
      database.recordShadowStrategyMetric('system', mint, qualityScore, shadowScore, shadowScore >= 75);

      if (adjustedConfidence < 65 || qualityScore < 68) return null;

      telemetryLogger.debug(`🧠 ENTRY_DECISION mint=${mint} base=${base.confidence} adjusted=${adjustedConfidence.toFixed(2)} quality=${qualityScore.toFixed(2)} reason=${base.reason}`, 'trading-engine');
      return { ...base, confidence: adjustedConfidence, qualityScore };
    } catch (err) {
      telemetryLogger.error(`Failed to analyze ${mint}`, 'trading-engine', err);
      return null;
    }
  }

  private evaluateMoonshotPotential(tokenData: CandidateInput): TradingSignal | null {
    let score = 0;
    const reasons: string[] = [];

    if (tokenData.liquidity < 10000) return null;
    score += 20; reasons.push('liquidity');

    if (tokenData.volume24h >= 5000) { score += 15; reasons.push('volume'); }
    if ((tokenData.prevVolume24h || 0) > 0 && tokenData.volume24h > (tokenData.prevVolume24h || 0)) {
      score += 8; reasons.push('rising_volume');
    }

    const ratio = (tokenData.buys || 0) / Math.max(1, tokenData.sells || 0);
    if (ratio >= 1.2) { score += 18; reasons.push('buy_pressure'); }

    if ((tokenData.microTrendUp ?? false) === true) { score += 8; reasons.push('micro_uptrend'); }
    if ((tokenData.higherHighs ?? false) === true) { score += 10; reasons.push('higher_highs'); }
    if ((tokenData.priceChange1m || 0) > 0.8) { score += 10; reasons.push('momentum_1m'); }
    if ((tokenData.priceChange5m || 0) > 1.8) { score += 10; reasons.push('momentum_5m'); }

    score += Math.min(12, tokenData.confidence || 0);
    if (score < 65) return null;

    return { type: 'BUY', mint: tokenData.mint, price: tokenData.price, confidence: Math.round(score), reason: reasons.join('|') };
  }

  private async loadUserKeypair(userId: string): Promise<Keypair> {
    const user = database.getUserById(userId);
    if (!user) throw new Error('User not found');
    const decrypted = userManager.decryptPrivateKey(user.privateKey);
    return Keypair.fromSecretKey(bs58.decode(decrypted));
  }

  private async getTokenDecimals(mint: string): Promise<number> {
    try {
      const mintInfo = await this.withRpcRetry(
        'GET_TOKEN_DECIMALS',
        () => this.connection.getParsedAccountInfo(new PublicKey(mint), 'confirmed')
      );
      const decimals = Number((mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 0);
      if (Number.isFinite(decimals) && decimals >= 0) return decimals;
    } catch {
      // fallback
    }
    return 6;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getWalletBalance(userId: string): Promise<number> {
    const user = database.getUserById(userId);
    if (!user) return 0;
    const lamports = await this.withRpcRetry(
      'GET_BALANCE',
      () => this.connection.getBalance(new PublicKey(user.walletAddress), 'confirmed')
    );
    return lamports / LAMPORTS_PER_SOL;
  }

  async withdraw(userId: string, toAddress: string, solAmount: number): Promise<string> {
    const owner = await this.loadUserKeypair(userId);
    const to = new PublicKey(toAddress);
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: to, lamports }));
    tx.feePayer = owner.publicKey;
    tx.recentBlockhash = (await this.withRpcRetry(
      'WITHDRAW_BLOCKHASH',
      () => this.connection.getLatestBlockhash('confirmed')
    )).blockhash;
    tx.sign(owner);

    const signature = await this.withRpcRetry(
      'WITHDRAW_SEND',
      () => this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 })
    );
    const conf = await this.withRpcRetry(
      'WITHDRAW_CONFIRM',
      () => this.connection.confirmTransaction(signature, 'confirmed')
    );
    if (conf.value.err) throw new Error(`Withdrawal failed: ${JSON.stringify(conf.value.err)}`);
    return signature;
  }

  async executeBuyTrade(userId: string, signal: TradingSignal, portfolioValue: number): Promise<boolean> {
    const lockKey = this.lockKey(userId, signal.mint);
    if (this.executionLocks.has(lockKey) || this.isInCooldown(userId, signal.mint)) return false;
    this.executionLocks.add(lockKey);

    const startedAt = Date.now();

    try {
      const user = database.getUserById(userId);
      const config = userManager.getUserConfig(userId);
      if (!user || !config) return false;
      if (!config.enableLiveTrading || config.emergencyStop || config.userSuspended) return false;
      if (process.env.EMERGENCY_STOP === 'true' || this.isCircuitOpen(userId)) return false;

      const open = database.getUserTradingSessions(userId).filter((s) => s.status === 'open');
      if (open.length >= (config.maxOpenTrades || 3)) return false;
      if (database.getOpenTradingSessionForToken(userId, signal.mint)) return false;

      const dailyLoss = database.getUserTradingSessions(userId)
        .filter((s) => s.status === 'closed' && (s.endedAt || 0) >= this.getDayStart())
        .reduce((sum, s) => sum + Math.min(0, s.profit || 0), 0);
      if (Math.abs(dailyLoss) >= (config.dailyLossCapUsd || 100)) return false;

      // Entry delay 10-30s and re-confirm momentum.
      const entryDelayMs = 10_000 + Math.floor(Math.random() * 20_000);
      await this.sleep(entryDelayMs);
      const reconfirm = this.lastMarketSignals.get(signal.mint);
      if (!reconfirm || (reconfirm.priceChange1m || 0) <= 0 || !reconfirm.higherHighs) {
        telemetryLogger.info(`⏳ ENTRY_ABORT user=${userId} token=${signal.mint} reason=reconfirm_failed`, 'trading-engine');
        return false;
      }

      const walletSol = await this.getWalletBalance(userId);
      const gasReserve = config.gasReserveSol || 0.02;
      if (walletSol <= gasReserve) {
        telemetryLogger.warn(`INSUFFICIENT_SOL user=${userId} balance=${walletSol.toFixed(6)} reserve=${gasReserve}`, 'trading-engine');
        return false;
      }

      const maxTradeUsd = config.maxTradeSizeUsd || 50;
      const baseUsd = Math.min(portfolioValue, config.tradeSize || portfolioValue, maxTradeUsd);
      const sizeUsd = Math.min(maxTradeUsd, this.adaptivePositionSize(baseUsd));
      const solToSpend = sizeUsd / Math.max(signal.price, 0.0000001);
      if (walletSol - solToSpend < gasReserve) {
        telemetryLogger.warn(`INSUFFICIENT_TRADE_CAPACITY user=${userId} balance=${walletSol.toFixed(6)} spend=${solToSpend.toFixed(6)} reserve=${gasReserve}`, 'trading-engine');
        return false;
      }

      const slippageBps = this.dynamicSlippageBps(reconfirm);

      const owner = await this.loadUserKeypair(userId);
      const swap = await jupiterExecutor.swapExactIn({
        owner,
        inputMint: SOL_MINT,
        outputMint: signal.mint,
        amount: Math.floor(solToSpend * LAMPORTS_PER_SOL),
        slippageBps,
      });

      const entryAmount = Number(swap.outputAmount);
      database.createTradingSession({
        userId,
        tokenMint: signal.mint,
        entryPrice: signal.price,
        entryAmount,
        entryTxSig: swap.signature,
        status: 'open',
        startedAt: Date.now(),
      });

      const impliedOutSol = entryAmount * signal.price;
      const slipBps = Math.max(0, ((solToSpend - impliedOutSol) / Math.max(solToSpend, 1e-9)) * 10000);
      database.recordExecutionMetric({ userId, tokenMint: signal.mint, side: 'BUY', success: true, slippageBps: slipBps, durationMs: Date.now() - startedAt, reason: `entry:${signal.reason}` });

      telemetryLogger.info(`🟢 ENTRY user=${userId} token=${signal.mint} quality=${(signal.qualityScore || 0).toFixed(1)} conf=${signal.confidence.toFixed(1)} slippage=${slippageBps}bps reason=${signal.reason} tx=${swap.signature}`, 'trading-engine');
      this.clearFailure(userId);
      this.markCooldown(userId, signal.mint);
      this.shortTermAggression = Math.min(1.2, this.shortTermAggression + 0.01);
      return true;
    } catch (err) {
      this.registerFailure(userId, signal.mint, 'BUY', err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.executionLocks.delete(lockKey);
    }
  }

  async manageTrades(userId: string, prices: Map<string, number>): Promise<void> {
    const config = userManager.getUserConfig(userId);
    if (!config || !config.enableLiveTrading || config.emergencyStop || config.userSuspended) return;
    if (process.env.EMERGENCY_STOP === 'true' || this.isCircuitOpen(userId)) return;

    const open = database.getUserTradingSessions(userId).filter((s) => s.status === 'open');
    for (const session of open) {
      const price = prices.get(session.tokenMint);
      if (!price) continue;

      const pct = ((price - session.entryPrice) / session.entryPrice) * 100;
      const earlyTp = pct >= Math.max(4, (config.profitTargetPct || 20) * 0.25);
      const hardTakeProfit = pct >= (config.profitTargetPct || 20);
      const stopLoss = price <= session.entryPrice * (1 - (config.trailingStopPct || 12) / 100);
      const weakMomentumExit = pct > 0 && pct < 2;

      // partial TP: sell 50% early, trail remainder.
      if (earlyTp && !this.partialTakeProfitDone.has(session.id)) {
        await this.executePartialTakeProfit(session, price, 0.5, 'partial_take_profit');
        this.partialTakeProfitDone.add(session.id);
        continue;
      }

      const marketSignal = this.lastMarketSignals.get(session.tokenMint);
      const marketExit = this.shouldExitByMarket(marketSignal);
      if (hardTakeProfit || stopLoss || weakMomentumExit || marketExit.shouldExit) {
        await this.closeTrade(session, price, marketExit.shouldExit ? marketExit.reason : (pct >= 0 ? 'momentum_exit' : 'stop_exit'));
      }
    }
  }

  private async getTokenBalance(owner: PublicKey, mint: string): Promise<{ amountUi: number; decimals: number; amountBaseUnits: number }> {
    const decimals = await this.getTokenDecimals(mint);
    const response = await this.withRpcRetry(
      'GET_TOKEN_BALANCE',
      () => this.connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) }, 'confirmed')
    );
    let amountUi = 0;

    for (const acc of response.value) {
      const parsed = (acc.account.data as any).parsed?.info?.tokenAmount;
      if (!parsed) continue;
      amountUi += Number(parsed.uiAmount || 0);
    }

    const amountBaseUnits = Math.floor(amountUi * Math.pow(10, decimals));
    return { amountUi, decimals, amountBaseUnits };
  }

  private async executePartialTakeProfit(session: TradingSession, price: number, fraction: number, reason: string): Promise<void> {
    const owner = await this.loadUserKeypair(session.userId);
    const tokenBalance = await this.getTokenBalance(owner.publicKey, session.tokenMint);
    const sellBaseUnits = Math.floor(tokenBalance.amountBaseUnits * fraction);
    if (sellBaseUnits <= 0) return;

    const signal = this.lastMarketSignals.get(session.tokenMint);
    const slippageBps = this.dynamicSlippageBps(signal || { mint: session.tokenMint, price, liquidity: 20000, volume24h: 0 });

    const swap = await jupiterExecutor.swapExactIn({
      owner,
      inputMint: session.tokenMint,
      outputMint: SOL_MINT,
      amount: sellBaseUnits,
      slippageBps,
    });

    const newEntryAmount = Math.max(0, session.entryAmount * (1 - fraction));
    database.updateTradingSessionEntryAmount(session.id, newEntryAmount);
    database.recordExecutionMetric({ userId: session.userId, tokenMint: session.tokenMint, side: 'SELL', success: true, slippageBps, durationMs: Date.now() - session.startedAt, reason });

    telemetryLogger.info(`🟡 PARTIAL_EXIT user=${session.userId} token=${session.tokenMint} fraction=${fraction} reason=${reason} tx=${swap.signature}`, 'trading-engine');
  }

  private async closeTrade(session: TradingSession, price: number, reason: string): Promise<void> {
    const lockKey = this.lockKey(session.userId, session.tokenMint);
    if (this.executionLocks.has(lockKey)) return;
    this.executionLocks.add(lockKey);

    try {
      const owner = await this.loadUserKeypair(session.userId);
      const tokenBalance = await this.getTokenBalance(owner.publicKey, session.tokenMint);
      if (tokenBalance.amountBaseUnits <= 0) {
        telemetryLogger.warn(`⚠️ EXIT_SKIP user=${session.userId} token=${session.tokenMint} reason=no_balance`, 'trading-engine');
        return;
      }

      const signal = this.lastMarketSignals.get(session.tokenMint);
      const slippageBps = this.dynamicSlippageBps(signal || { mint: session.tokenMint, price, liquidity: 20000, volume24h: 0 });
      const swap = await jupiterExecutor.swapExactIn({ owner, inputMint: session.tokenMint, outputMint: SOL_MINT, amount: tokenBalance.amountBaseUnits, slippageBps });

      const profit = (price - session.entryPrice) * tokenBalance.amountUi;
      const profitPct = ((price - session.entryPrice) / session.entryPrice) * 100;
      database.closeTradingSession(session.id, price, tokenBalance.amountUi, profit, profitPct, swap.signature);
      database.recordExecutionMetric({ userId: session.userId, tokenMint: session.tokenMint, side: 'SELL', success: true, slippageBps, durationMs: Date.now() - session.startedAt, reason });

      aiBrain.record({ mint: session.tokenMint, profitPct, durationMs: Date.now() - session.startedAt, entryConfidence: 70, timestamp: Date.now() });

      telemetryLogger.info(`🔴 EXIT user=${session.userId} token=${session.tokenMint} reason=${reason} pnl=${profitPct.toFixed(2)}% holdMs=${Date.now() - session.startedAt} tx=${swap.signature}`, 'trading-engine');
      this.clearFailure(session.userId);
      this.markCooldown(session.userId, session.tokenMint);
      this.shortTermAggression = profitPct > 0 ? Math.min(1.25, this.shortTermAggression + 0.02) : Math.max(0.7, this.shortTermAggression - 0.03);
    } catch (err) {
      this.registerFailure(session.userId, session.tokenMint, 'SELL', err instanceof Error ? err.message : String(err));
    } finally {
      this.executionLocks.delete(lockKey);
    }
  }

  getExecutionMetrics(userId: string) {
    return database.getExecutionMetricsSummary(userId);
  }

  private getDayStart(): number {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now.getTime();
  }
}

export default new TradingEngine();
