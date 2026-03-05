import fs from "node:fs/promises";
import path from "node:path";
import { defaultState, loadPersistedState, savePersistedState } from "../persistence";

const statePath = path.resolve(process.cwd(), "state.json");
const tmpPath = `${statePath}.tmp`;

describe("persistence", () => {
  beforeEach(async () => {
    await Promise.allSettled([fs.rm(statePath, { force: true }), fs.rm(tmpPath, { force: true })]);
  });

  afterEach(async () => {
    await Promise.allSettled([fs.rm(statePath, { force: true }), fs.rm(tmpPath, { force: true })]);
  });

  it("returns default state when state file is missing", async () => {
    const state = await loadPersistedState();
    expect(state).toEqual(defaultState());
  });

  it("saves and loads state atomically", async () => {
    const input = {
      ...defaultState(),
      paperBalanceUsd: 777,
      lastCycleAtMs: Date.now(),
      positions: [
        {
          mint: "mint-1",
          symbol: "M1",
          entryPriceUsd: 1,
          lastPriceUsd: 1.4,
          highWatermarkUsd: 1.4,
          sizeUsd: 50,
          amountTokens: 50,
          amountRaw: "50000000",
          momentumFailCount: 0,
          partialTaken: true,
          realizedPartialPnlUsd: 10,
          entryTxSig: "sig-entry",
          lastPartialTxSig: "sig-partial",
          openedAtMs: Date.now() - 1_000
        }
      ],
      closedTrades: [
        {
          mint: "mint-1",
          symbol: "M1",
          entryPriceUsd: 1,
          exitPriceUsd: 1.2,
          sizeUsd: 25,
          realizedPnlUsd: 4,
          openedAtMs: Date.now() - 2_000,
          closedAtMs: Date.now(),
          reason: "trailing_stop" as const,
          entryTxSig: "sig-entry",
          exitTxSig: "sig-exit"
        }
      ]
    };

    await savePersistedState(input);

    const loaded = await loadPersistedState();
    expect(loaded.paperBalanceUsd).toBe(777);
    expect(loaded.positions[0]?.entryTxSig).toBe("sig-entry");
    expect(loaded.positions[0]?.lastPartialTxSig).toBe("sig-partial");
    expect(loaded.positions[0]?.partialTaken).toBe(true);
    expect(loaded.closedTrades[0]?.exitTxSig).toBe("sig-exit");
    await expect(fs.access(tmpPath)).rejects.toThrow();
  });
});
