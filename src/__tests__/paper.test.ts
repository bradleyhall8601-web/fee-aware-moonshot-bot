import { PaperTrader, evaluateExit } from '../paper';
import { Position } from '../types';

describe('PaperTrader', () => {
  let trader: PaperTrader;

  beforeEach(() => {
    trader = new PaperTrader(1_000);
  });

  it('opens a position and deducts balance', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 0.01, 50, 0);
    expect(trader.openPositions).toHaveLength(1);
    expect(trader.balanceUsd).toBe(950);
  });

  it('deducts entry fee from balance', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 0.01, 50, 2);
    expect(trader.balanceUsd).toBe(948); // 1000 - 50 - 2
  });

  it('does not open duplicate positions', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 0.01, 50, 0);
    trader.openPosition('mint1', 'TEST', 'pair1', 0.01, 50, 0);
    expect(trader.openPositions).toHaveLength(1);
  });

  it('updates the high-watermark on price increase', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    trader.updatePrice('mint1', 1.5);
    const pos = trader.openPositions[0];
    expect(pos.highWatermarkUsd).toBe(1.5);
  });

  it('does not lower the high-watermark on price decrease', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    trader.updatePrice('mint1', 1.5);
    trader.updatePrice('mint1', 0.8);
    const pos = trader.openPositions[0];
    expect(pos.highWatermarkUsd).toBe(1.5);
  });

  it('closes a profitable position and credits balance', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    const trade = trader.closePosition('mint1', 1.3, 'profit_target', 0);
    expect(trade).toBeDefined();
    expect(trade!.realizedPnlUsd).toBeCloseTo(30, 4);
    expect(trader.balanceUsd).toBeCloseTo(1_030, 4);
    expect(trader.openPositions).toHaveLength(0);
    expect(trader.closedTrades).toHaveLength(1);
  });

  it('closes a losing position and deducts from balance', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    const trade = trader.closePosition('mint1', 0.8, 'trailing_stop', 0);
    expect(trade!.realizedPnlUsd).toBeCloseTo(-20, 4);
    expect(trader.balanceUsd).toBeCloseTo(980, 4);
  });

  it('deducts exit fee from realized PnL', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    const trade = trader.closePosition('mint1', 1.3, 'profit_target', 2);
    expect(trade!.realizedPnlUsd).toBeCloseTo(28, 4); // 30 - 2
  });

  it('returns correct summary stats', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    trader.closePosition('mint1', 1.3, 'profit_target', 0);
    trader.openPosition('mint2', 'FOO', 'pair2', 2.0, 50, 0);

    const summary = trader.summary();
    expect(summary.openCount).toBe(1);
    expect(summary.tradeCount).toBe(1);
    expect(summary.totalPnlUsd).toBeCloseTo(30, 4);
  });

  it('caps position size to available balance', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 2_000, 0); // more than balance
    expect(trader.openPositions[0].sizeUsd).toBe(1_000);
    expect(trader.balanceUsd).toBe(0);
  });

  it('increments momentum fail counter', () => {
    trader.openPosition('mint1', 'TEST', 'pair1', 1.0, 100, 0);
    trader.incrementMomentumFail('mint1');
    trader.incrementMomentumFail('mint1');
    expect(trader.openPositions[0].momentumFailCount).toBe(2);
  });
});

describe('evaluateExit', () => {
  function makePos(overrides: Partial<Position> = {}): Position {
    return {
      mint: 'mint1',
      symbol: 'TEST',
      pairAddress: 'pair1',
      entryPriceUsd: 1.0,
      highWatermarkUsd: 1.3,
      sizeUsd: 100,
      entryTime: Date.now() - 60_000,
      momentumFailCount: 0,
      ...overrides,
    };
  }

  it('returns profit_target when gain >= PROFIT_TARGET_PCT (30%)', () => {
    const pos = makePos({ entryPriceUsd: 1.0 });
    expect(evaluateExit(pos, 1.31)).toBe('profit_target');
  });

  it('returns trailing_stop when drawdown >= TRAILING_STOP_PCT (15%)', () => {
    // high = 1.3, stop at 1.3 * 0.85 = 1.105
    const pos = makePos({ highWatermarkUsd: 1.3 });
    expect(evaluateExit(pos, 1.0)).toBe('trailing_stop');
  });

  it('returns momentum_fail when counter >= MAX_MOMENTUM_FAIL_COUNT (3)', () => {
    // highWatermark = entryPrice so no trailing stop is active
    const pos = makePos({ entryPriceUsd: 1.0, highWatermarkUsd: 1.0, momentumFailCount: 3 });
    expect(evaluateExit(pos, 1.0)).toBe('momentum_fail');
  });

  it('returns null when no exit condition met', () => {
    const pos = makePos({ entryPriceUsd: 1.0, highWatermarkUsd: 1.1 });
    expect(evaluateExit(pos, 1.05)).toBeNull();
  });
});
