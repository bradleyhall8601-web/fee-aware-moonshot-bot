import { passesFilter } from '../filter';
import { DexPair } from '../types';

/** Build a minimal valid DexPair that passes all default filter criteria */
function makePair(overrides: Partial<DexPair> = {}): DexPair {
  const now = Date.now();
  return {
    chainId: 'solana',
    dexId: 'raydium',
    pairAddress: '0xpair',
    baseToken: { address: '0xbase', name: 'TestToken', symbol: 'TEST' },
    quoteToken: { address: '0xquote', name: 'USD Coin', symbol: 'USDC' },
    priceUsd: '0.001',
    txns: {
      m5: { buys: 10, sells: 3 },
      h1: { buys: 150, sells: 30 },  // buys/sells pass MIN_BUYS=100, MIN_SELLS=1, MAX_SELLS=100
      h6: { buys: 400, sells: 100 },
      h24: { buys: 800, sells: 200 },
    },
    volume: { m5: 100, h1: 5_000, h6: 20_000, h24: 80_000 },
    priceChange: { m5: 2, h1: 5, h6: 10, h24: 20 },
    liquidity: { usd: 50_000, base: 1_000_000, quote: 50_000 },
    fdv: 100_000,
    pairCreatedAt: now - 3_600_000, // 1 hour ago
    ...overrides,
  };
}

describe('passesFilter', () => {
  it('accepts a valid pair', () => {
    expect(passesFilter(makePair())).toBe(true);
  });

  it('rejects non-Solana chains', () => {
    expect(passesFilter(makePair({ chainId: 'ethereum' }))).toBe(false);
  });

  it('rejects disallowed DEX', () => {
    expect(passesFilter(makePair({ dexId: 'uniswap' }))).toBe(false);
  });

  it('rejects disallowed quote token', () => {
    expect(
      passesFilter(
        makePair({ quoteToken: { address: '0x', name: 'WBTC', symbol: 'WBTC' } }),
      ),
    ).toBe(false);
  });

  it('rejects low liquidity', () => {
    expect(passesFilter(makePair({ liquidity: { usd: 100, base: 0, quote: 0 } }))).toBe(false);
  });

  it('rejects volume below minimum', () => {
    expect(
      passesFilter(makePair({ volume: { m5: 0, h1: 0, h6: 0, h24: 0 } })),
    ).toBe(false);
  });

  it('rejects volume above maximum', () => {
    expect(
      passesFilter(makePair({ volume: { m5: 0, h1: 999_999, h6: 0, h24: 0 } })),
    ).toBe(false);
  });

  it('rejects excessive FDV', () => {
    expect(passesFilter(makePair({ fdv: 999_999_999 }))).toBe(false);
  });

  it('rejects pair older than MAX_TOKEN_AGE_HOURS', () => {
    const old = Date.now() - 48 * 3_600_000; // 48 hours ago
    expect(passesFilter(makePair({ pairCreatedAt: old }))).toBe(false);
  });

  it('rejects negative 5m price change below MIN_PRICE_CHANGE_5M=0', () => {
    expect(
      passesFilter(
        makePair({ priceChange: { m5: -1, h1: 0, h6: 0, h24: 0 } }),
      ),
    ).toBe(false);
  });

  it('rejects low txn count', () => {
    expect(
      passesFilter(
        makePair({
          txns: {
            m5: { buys: 1, sells: 1 },
            h1: { buys: 5, sells: 5 },   // total 10 < MIN_TXNS 100
            h6: { buys: 10, sells: 10 },
            h24: { buys: 20, sells: 20 },
          },
        }),
      ),
    ).toBe(false);
  });

  it('rejects excessive sell count', () => {
    expect(
      passesFilter(
        makePair({
          txns: {
            m5: { buys: 10, sells: 3 },
            h1: { buys: 200, sells: 500 },  // sells > MAX_SELLS=100
            h6: { buys: 400, sells: 600 },
            h24: { buys: 800, sells: 800 },
          },
        }),
      ),
    ).toBe(false);
  });

  it('rejects poor buy/sell ratio', () => {
    expect(
      passesFilter(
        makePair({
          txns: {
            m5: { buys: 10, sells: 10 },
            h1: { buys: 100, sells: 98 }, // ratio ~1.02 < minBuySellRatio 1.05
            h6: { buys: 200, sells: 196 },
            h24: { buys: 400, sells: 392 },
          },
        }),
      ),
    ).toBe(false);
  });
});
