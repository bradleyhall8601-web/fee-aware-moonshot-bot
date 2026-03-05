import { evaluateEntryRisk, perTradeUsd } from "../risk";

describe("risk sizing", () => {
  it("uses $5 trade size when walletUsd < 100", () => {
    expect(perTradeUsd(99)).toBe(5);
  });

  it("uses $10 trade size when walletUsd >= 100", () => {
    expect(perTradeUsd(100)).toBe(10);
  });

  it("enforces wallet spend cap", () => {
    const decision = evaluateEntryRisk({
      walletUsd: 500,
      currentExposureUsd: 18,
      openPositions: 1
    });

    expect(decision.allowed).toBe(true);
    expect(decision.spendCapUsd).toBe(20);
    expect(decision.remainingBudgetUsd).toBe(2);
    expect(decision.sizeUsd).toBe(2);
  });

  it("blocks entries at max concurrent positions", () => {
    const decision = evaluateEntryRisk({
      walletUsd: 500,
      currentExposureUsd: 0,
      openPositions: 3
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("max_positions");
  });

  it("blocks entries when remaining budget is exhausted", () => {
    const decision = evaluateEntryRisk({
      walletUsd: 20,
      currentExposureUsd: 20,
      openPositions: 1
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("budget_exhausted");
    expect(decision.sizeUsd).toBe(0);
  });
});
