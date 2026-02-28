import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyMoonshotFilter, rankByMomentum, pairAgeHours, bestTxns, bestVolume } from "../src/strategy/filters.js";
import type { DexPair } from "../src/positions/types.js";

// Stub config for tests — must be set before importing modules that read config.
vi.mock("../src/config.js", () => ({
  config: {
    MIN_LIQUIDITY_USD: 10000,
    MAX_PAIR_AGE_HOURS: 24,
    MIN_TXNS: 100,
    MAX_TXNS: 1000,
    MIN_BUYS: 100,
    MAX_BUYS: 1000,
    MIN_SELLS: 1,
    MAX_SELLS: 100,
    MIN_VOLUME_USD: 1000,
    MAX_VOLUME_USD: 100000,
    REQUIRE_5M_PRICE_UP: true,
    LOG_LEVEL: "silent",
  },
}));

vi.mock("../src/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

function makePair(overrides: Partial<DexPair> = {}): DexPair {
  const base: DexPair = {
    chainId: "solana",
    dexId: "raydium",
    url: "https://dexscreener.com/solana/abc123",
    pairAddress: "abc123",
    baseToken: { address: "TOKEN_MINT_1", name: "TestToken", symbol: "TEST" },
    quoteToken: { address: "So111", name: "Wrapped SOL", symbol: "SOL" },
    priceNative: "0.001",
    priceUsd: "0.1",
    txns: {
      m5: { buys: 150, sells: 30 },
    },
    volume: { h1: 5000 },
    priceChange: { m5: 2.5, h1: 10 },
    liquidity: { usd: 50000 },
    pairCreatedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
  };
  return { ...base, ...overrides };
}

describe("pairAgeHours", () => {
  it("returns Infinity for undefined", () => {
    expect(pairAgeHours(undefined)).toBe(Infinity);
  });

  it("returns approximate hours for recent timestamp", () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const age = pairAgeHours(twoHoursAgo);
    expect(age).toBeGreaterThan(1.9);
    expect(age).toBeLessThan(2.1);
  });
});

describe("bestTxns", () => {
  it("prefers m5 window", () => {
    const pair = makePair({ txns: { m5: { buys: 200, sells: 50 }, h1: { buys: 500, sells: 100 } } });
    const result = bestTxns(pair);
    expect(result.buys).toBe(200);
    expect(result.sells).toBe(50);
    expect(result.total).toBe(250);
  });

  it("falls back to h1 when m5 missing", () => {
    const pair = makePair({ txns: { h1: { buys: 300, sells: 60 } } });
    const result = bestTxns(pair);
    expect(result.buys).toBe(300);
  });

  it("returns zeros when no txns data", () => {
    const pair = makePair({ txns: {} });
    const result = bestTxns(pair);
    expect(result.total).toBe(0);
  });
});

describe("bestVolume", () => {
  it("prefers h1 volume", () => {
    const pair = makePair({ volume: { h1: 5000, h24: 50000, m5: 100 } });
    expect(bestVolume(pair)).toBe(5000);
  });

  it("falls back to h24", () => {
    const pair = makePair({ volume: { h24: 50000 } });
    expect(bestVolume(pair)).toBe(50000);
  });
});

describe("applyMoonshotFilter", () => {
  it("passes a valid pair", () => {
    const pair = makePair();
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("rejects low liquidity", () => {
    const pair = makePair({ liquidity: { usd: 5000 } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("liquidity"))).toBe(true);
  });

  it("rejects old pair", () => {
    const pair = makePair({
      pairCreatedAt: Date.now() - 30 * 60 * 60 * 1000, // 30h ago
    });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("pair age"))).toBe(true);
  });

  it("rejects low volume", () => {
    const pair = makePair({ volume: { h1: 500 } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("volume"))).toBe(true);
  });

  it("rejects too-high volume", () => {
    const pair = makePair({ volume: { h1: 200000 } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("volume"))).toBe(true);
  });

  it("rejects too few txns", () => {
    const pair = makePair({ txns: { m5: { buys: 30, sells: 10 } } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("txns"))).toBe(true);
  });

  it("rejects too few buys", () => {
    const pair = makePair({ txns: { m5: { buys: 50, sells: 60 } } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("buys"))).toBe(true);
  });

  it("rejects too many sells", () => {
    const pair = makePair({ txns: { m5: { buys: 200, sells: 200 } } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("sells"))).toBe(true);
  });

  it("rejects negative 5m price change", () => {
    const pair = makePair({ priceChange: { m5: -1.5 } });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("5m price change"))).toBe(true);
  });

  it("collects multiple rejection reasons", () => {
    const pair = makePair({
      liquidity: { usd: 1000 },
      volume: { h1: 100 },
      priceChange: { m5: -5 },
    });
    const result = applyMoonshotFilter(pair);
    expect(result.pass).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("rankByMomentum", () => {
  it("sorts by descending txn total", () => {
    const low = makePair({ pairAddress: "low", txns: { m5: { buys: 100, sells: 20 } } });
    const high = makePair({ pairAddress: "high", txns: { m5: { buys: 500, sells: 80 } } });
    const medium = makePair({ pairAddress: "med", txns: { m5: { buys: 200, sells: 40 } } });

    const ranked = rankByMomentum([low, high, medium]);
    expect(ranked[0].pairAddress).toBe("high");
    expect(ranked[1].pairAddress).toBe("med");
    expect(ranked[2].pairAddress).toBe("low");
  });
});
