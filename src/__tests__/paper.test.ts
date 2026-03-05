import fs from "node:fs/promises";
import path from "node:path";
import { PaperTrader } from "../paper";
import { defaultState, loadPersistedState, savePersistedState } from "../persistence";

const statePath = path.resolve(process.cwd(), "state.json");

describe("PaperTrader partial sells", () => {
  beforeEach(async () => {
    await fs.rm(statePath, { force: true });
  });

  afterEach(async () => {
    await fs.rm(statePath, { force: true });
  });

  it("sells 50% at >=30% profit and persists runner state", async () => {
    const state = defaultState();
    const trader = new PaperTrader(state);

    const opened = trader.openPaperPosition(
      {
        mint: "mint-1",
        symbol: "M1",
        dex: "raydium",
        liquidityUsd: 100_000,
        volume1hUsd: 20_000,
        priceUsd: 1
      },
      100,
      0,
      "entry-sig",
      "100000000"
    );

    expect(opened).not.toBeNull();
    const partial = trader.applyPartialSell("mint-1", 1.3, 0.5, "partial-sig");
    expect(partial).not.toBeNull();
    expect(partial?.partialTaken).toBe(true);
    expect(partial?.sizeUsd).toBeCloseTo(50, 5);
    expect(partial?.amountRaw).toBe("50000000");
    expect(partial?.lastPartialTxSig).toBe("partial-sig");

    await savePersistedState(trader.getState());
    const loaded = await loadPersistedState();
    expect(loaded.positions[0]?.partialTaken).toBe(true);
    expect(loaded.positions[0]?.sizeUsd).toBeCloseTo(50, 5);
    expect(loaded.positions[0]?.lastPartialTxSig).toBe("partial-sig");
  });
});
