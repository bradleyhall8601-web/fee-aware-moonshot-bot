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
      lastCycleAtMs: Date.now()
    };

    await savePersistedState(input);

    const loaded = await loadPersistedState();
    expect(loaded.paperBalanceUsd).toBe(777);
    await expect(fs.access(tmpPath)).rejects.toThrow();
  });
});
