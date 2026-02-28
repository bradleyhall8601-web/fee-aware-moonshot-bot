import { manageStopLoss, monitorFallback, isTrailingStopBreached, isProfitTargetReached } from '../risk';
import { Position } from '../types';

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    mint: '0xmint',
    symbol: 'TEST',
    pairAddress: '0xpair',
    entryPriceUsd: 1.0,
    highWatermarkUsd: 1.2,
    sizeUsd: 100,
    entryTime: Date.now() - 60_000,
    momentumFailCount: 0,
    ...overrides,
  };
}

describe('manageStopLoss', () => {
  it('triggers when loss >= 5%', () => {
    expect(manageStopLoss(0.94, 1.0)).toBe(true);  // 6% loss
    expect(manageStopLoss(0.95, 1.0)).toBe(true);  // exactly 5% loss
  });

  it('does not trigger when loss < 5%', () => {
    expect(manageStopLoss(0.96, 1.0)).toBe(false);
    expect(manageStopLoss(1.0, 1.0)).toBe(false);
    expect(manageStopLoss(1.1, 1.0)).toBe(false);
  });
});

describe('monitorFallback', () => {
  it('triggers when current <= fallback', () => {
    expect(monitorFallback(100, 100)).toBe(true);
    expect(monitorFallback(99, 100)).toBe(true);
  });

  it('does not trigger when current > fallback', () => {
    expect(monitorFallback(101, 100)).toBe(false);
  });
});

describe('isTrailingStopBreached', () => {
  it('triggers when price drops >= TRAILING_STOP_PCT from high-watermark', () => {
    // TRAILING_STOP_PCT default = 15%
    // highWatermark = 1.2, so stop at 1.2 * (1 - 0.15) = 1.02
    const pos = makePosition({ highWatermarkUsd: 1.2 });
    expect(isTrailingStopBreached(pos, 1.0)).toBe(true);  // drop ~16.7%
  });

  it('does not trigger when drawdown is within threshold', () => {
    const pos = makePosition({ highWatermarkUsd: 1.2 });
    expect(isTrailingStopBreached(pos, 1.1)).toBe(false); // drop ~8.3%
  });
});

describe('isProfitTargetReached', () => {
  it('triggers when gain >= PROFIT_TARGET_PCT', () => {
    // PROFIT_TARGET_PCT default = 30%
    const pos = makePosition({ entryPriceUsd: 1.0 });
    expect(isProfitTargetReached(pos, 1.31)).toBe(true);  // 31% gain
    expect(isProfitTargetReached(pos, 1.30)).toBe(true);  // exactly 30%
  });

  it('does not trigger when gain is below target', () => {
    const pos = makePosition({ entryPriceUsd: 1.0 });
    expect(isProfitTargetReached(pos, 1.29)).toBe(false);
    expect(isProfitTargetReached(pos, 1.0)).toBe(false);
  });
});
