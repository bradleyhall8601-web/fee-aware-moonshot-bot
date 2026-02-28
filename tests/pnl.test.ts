import { describe, it, expect, vi } from "vitest";
import { calcPnlPct, decideExit } from "../src/strategy/exit.js";
import type { Position } from "../src/positions/types.js";
import type { DexPair } from "../src/positions/types.js";

vi.mock("../src/config.js", () => ({
  config: {
    STOP_LOSS_PCT: 18,
    TAKE_PROFIT_LOCK_PCT: 30,
    TAKE_PROFIT_LOCK_SELL_PCT: 50,
    RUNNER_TRAIL_STOP_PCT: 12,
    MOMENTUM_EXIT_IF_5M_RED: true,
    ENABLE_LIVE_TRADING: false,
    INPUT_MINT: "So11111111111111111111111111111111111111112",
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

vi.mock("../src/positions/store.js", () => ({
  upsertPosition: vi.fn(),
  recordTrade: vi.fn(),
}));

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "test-id",
    tokenMint: "TOKEN_MINT",
    tokenSymbol: "TEST",
    pairAddress: "PAIR",
    entryPrice: 1.0,
    entryTime: Date.now() - 60_000,
    sizeSol: 0.05,
    tokenAmount: 1_000_000,
    currentPrice: 1.0,
    peakPrice: 1.0,
    halfSold: false,
    remainingTokenAmount: 1_000_000,
    status: "open",
    paper: true,
    ...overrides,
  };
}

function makePair(priceChange5m: number = 2): DexPair {
  return {
    chainId: "solana",
    dexId: "raydium",
    url: "",
    pairAddress: "PAIR",
    baseToken: { address: "TOKEN_MINT", name: "TestToken", symbol: "TEST" },
    quoteToken: { address: "So111", name: "wSOL", symbol: "SOL" },
    priceNative: "1",
    priceUsd: "1",
    txns: { m5: { buys: 150, sells: 20 } },
    volume: { h1: 5000 },
    priceChange: { m5: priceChange5m },
    liquidity: { usd: 50000 },
    pairCreatedAt: Date.now() - 2 * 3600 * 1000,
  };
}

describe("calcPnlPct", () => {
  it("returns 0 when entry price is 0", () => {
    const pos = makePosition({ entryPrice: 0, currentPrice: 1 });
    expect(calcPnlPct(pos)).toBe(0);
  });

  it("calculates positive pnl correctly", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 1.3 });
    expect(calcPnlPct(pos)).toBeCloseTo(30);
  });

  it("calculates negative pnl correctly", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 0.82 });
    expect(calcPnlPct(pos)).toBeCloseTo(-18);
  });

  it("calculates zero pnl when price unchanged", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 1 });
    expect(calcPnlPct(pos)).toBe(0);
  });
});

describe("decideExit", () => {
  it("returns none when no exit condition met", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 1.1, peakPrice: 1.1 });
    const decision = decideExit(pos, makePair(2));
    expect(decision.action).toBe("none");
  });

  it("triggers stop_loss when pnl <= -18%", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 0.8 });
    const decision = decideExit(pos, makePair(2));
    expect(decision.action).toBe("sell_all");
    expect(decision.reason).toBe("stop_loss");
  });

  it("triggers stop_loss at exactly -18%", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 0.82 });
    const decision = decideExit(pos, makePair(2));
    expect(decision.action).toBe("sell_all");
    expect(decision.reason).toBe("stop_loss");
  });

  it("triggers take_profit_half when pnl >= 30%", () => {
    const pos = makePosition({ entryPrice: 1, currentPrice: 1.3, peakPrice: 1.3 });
    const decision = decideExit(pos, makePair(2));
    expect(decision.action).toBe("sell_half");
    expect(decision.reason).toBe("take_profit_half");
  });

  it("does not re-trigger take_profit_half if halfSold=true", () => {
    const pos = makePosition({
      entryPrice: 1,
      currentPrice: 1.5,
      peakPrice: 1.5,
      halfSold: true,
    });
    const decision = decideExit(pos, makePair(2));
    // Should not re-trigger half sell; check for runner/none
    expect(decision.action).not.toBe("sell_half");
  });

  it("triggers runner_trail_stop when price drops more than 12% from peak", () => {
    const pos = makePosition({
      entryPrice: 1,
      currentPrice: 1.28,
      peakPrice: 1.5,
      halfSold: true,
    });
    // (1.5 - 1.28) / 1.5 ≈ 14.67% > 12%
    const decision = decideExit(pos, makePair(2));
    expect(decision.action).toBe("sell_all");
    expect(decision.reason).toBe("runner_trail_stop");
  });

  it("triggers momentum_exit when 5m is red and halfSold=true", () => {
    const pos = makePosition({
      entryPrice: 1,
      currentPrice: 1.4,
      peakPrice: 1.4,
      halfSold: true,
    });
    const decision = decideExit(pos, makePair(-1)); // negative 5m
    expect(decision.action).toBe("sell_all");
    expect(decision.reason).toBe("momentum_exit");
  });

  it("stop_loss takes priority over take_profit", () => {
    // Theoretically impossible in normal trading but test guard
    const pos = makePosition({ entryPrice: 2, currentPrice: 0.8 });
    const decision = decideExit(pos, makePair(-1));
    expect(decision.reason).toBe("stop_loss");
  });
});
