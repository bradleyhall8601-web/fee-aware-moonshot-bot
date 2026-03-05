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

  it("returns default state when state file contains invalid JSON", async () => {
    await fs.writeFile(statePath, "{not-json", "utf8");
    const state = await loadPersistedState();
    expect(state).toEqual(defaultState());
  });

  it("saves and loads state atomically", async () => {
    const input = {
      ...defaultState(),
      paperBalanceUsd: 777,
      lastCycleAtMs: Date.now(),
      lastWalletSnapshot: {
        solBalance: 1.23,
        solUsd: 180,
        walletUsd: 221.4,
        updatedAtMs: Date.now()
      },
      seenPairs: ["pair-1"],
      positions: [
        {
          pairAddress: "pair-1",
          mint: "mint-1",
          symbol: "M1",
          entryPriceUsd: 1,
          lastPriceUsd: 1.4,
          highWatermarkUsd: 1.4,
          sizeUsd: 50,
          remainingSizeUsd: 25,
          amountTokens: 50,
          remainingTokens: 25,
          amountRaw: "50000000",
          momentumFailCount: 0,
          hasTakenProfit: true,
          realizedPartialPnlUsd: 10,
          partialExitTime: Date.now(),
          entryTxSig: "sig-entry",
          lastPartialTxSig: "sig-partial",
          openedAtMs: Date.now() - 1_000
        }
      ],
      closedTrades: [
        {
          mint: "mint-1",
          symbol: "M1",
          pairAddress: "pair-1",
          entryPriceUsd: 1,
          exitPriceUsd: 1.2,
          sizeUsd: 25,
          isPartial: true,
          realizedPnlUsd: 4,
          realizedPartialPnlUsd: 4,
          partialExitTime: Date.now(),
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
    expect(loaded.positions[0]?.hasTakenProfit).toBe(true);
    expect(loaded.closedTrades[0]?.exitTxSig).toBe("sig-exit");
    expect(loaded.seenPairs).toContain("pair-1");
    const raw = await fs.readFile(statePath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw) as {
      openPositions?: unknown[];
      stats?: unknown;
      exposureUsd?: unknown;
      lastWalletSnapshot?: unknown;
      seenPairs?: unknown;
      updatedAtMs?: unknown;
    };
    expect(Array.isArray(parsed.openPositions)).toBe(true);
    expect(parsed.stats).toBeDefined();
    expect(typeof parsed.exposureUsd).toBe("number");
    expect(parsed.lastWalletSnapshot).toBeDefined();
    expect(Array.isArray(parsed.seenPairs)).toBe(true);
    expect(typeof parsed.updatedAtMs).toBe("number");
    await expect(fs.access(tmpPath)).rejects.toThrow();
  });
});
