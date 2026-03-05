import fs from "node:fs/promises";
import path from "node:path";
import { BotState } from "./types";

const STATE_PATH = path.resolve(process.cwd(), "state.json");

export function defaultState(): BotState {
  return {
    positions: [],
    closedPositions: 0,
    paperBalanceUsd: 1_000,
    lastCycleAtMs: 0
  };
}

export async function loadPersistedState(): Promise<BotState> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BotState>;
    return {
      ...defaultState(),
      ...parsed,
      positions: Array.isArray(parsed.positions) ? parsed.positions : []
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return defaultState();
    }
    throw error;
  }
}

export async function savePersistedState(state: BotState): Promise<void> {
  const tmpPath = `${STATE_PATH}.tmp`;
  const payload = `${JSON.stringify(state, null, 2)}\n`;
  await fs.writeFile(tmpPath, payload, "utf8");
  await fs.rename(tmpPath, STATE_PATH);
}
