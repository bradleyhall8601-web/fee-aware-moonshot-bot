import fs from "node:fs/promises";
import path from "node:path";
import { BotState, Position, Trade } from "./types";

const STATE_PATH = path.resolve(process.cwd(), "state.json");

export function defaultState(): BotState {
  return {
    positions: [],
    closedTrades: [],
    closedPositions: 0,
    paperBalanceUsd: 1_000,
    realizedPnlUsd: 0,
    lastCycleAtMs: 0
  };
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function coercePosition(value: unknown): Position | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<Position>;
  const mint = typeof entry.mint === "string" ? entry.mint : "";
  const symbol = typeof entry.symbol === "string" ? entry.symbol : "";
  if (!mint || !symbol) {
    return null;
  }

  const entryPriceUsd = toNumber(entry.entryPriceUsd, 0);
  const lastPriceUsd = toNumber(entry.lastPriceUsd, entryPriceUsd);
  const sizeUsd = toNumber(entry.sizeUsd, 0);
  const amountTokens =
    typeof entry.amountTokens === "number"
      ? entry.amountTokens
      : entryPriceUsd > 0
        ? sizeUsd / entryPriceUsd
        : 0;

  return {
    mint,
    symbol,
    entryPriceUsd,
    lastPriceUsd,
    highWatermarkUsd: toNumber(entry.highWatermarkUsd, Math.max(entryPriceUsd, lastPriceUsd)),
    sizeUsd,
    amountTokens,
    amountRaw: typeof entry.amountRaw === "string" ? entry.amountRaw : undefined,
    momentumFailCount: Math.max(0, Math.floor(toNumber(entry.momentumFailCount, 0))),
    partialTaken: Boolean(entry.partialTaken),
    realizedPartialPnlUsd: toNumber(entry.realizedPartialPnlUsd, 0),
    entryTxSig: typeof entry.entryTxSig === "string" ? entry.entryTxSig : undefined,
    lastPartialTxSig: typeof entry.lastPartialTxSig === "string" ? entry.lastPartialTxSig : undefined,
    openedAtMs: toNumber(entry.openedAtMs, Date.now())
  };
}

function coerceTrade(value: unknown): Trade | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const trade = value as Partial<Trade>;
  const mint = typeof trade.mint === "string" ? trade.mint : "";
  const symbol = typeof trade.symbol === "string" ? trade.symbol : "";
  const reason = typeof trade.reason === "string" ? trade.reason : "trailing_stop";
  if (!mint || !symbol) {
    return null;
  }

  return {
    mint,
    symbol,
    reason: reason as Trade["reason"],
    entryPriceUsd: toNumber(trade.entryPriceUsd, 0),
    exitPriceUsd: toNumber(trade.exitPriceUsd, 0),
    sizeUsd: toNumber(trade.sizeUsd, 0),
    realizedPnlUsd: toNumber(trade.realizedPnlUsd, 0),
    openedAtMs: toNumber(trade.openedAtMs, Date.now()),
    closedAtMs: toNumber(trade.closedAtMs, Date.now()),
    entryTxSig: typeof trade.entryTxSig === "string" ? trade.entryTxSig : undefined,
    exitTxSig: typeof trade.exitTxSig === "string" ? trade.exitTxSig : undefined
  };
}

export async function loadPersistedState(): Promise<BotState> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BotState>;

    const positions = Array.isArray(parsed.positions)
      ? parsed.positions.map(coercePosition).filter((entry): entry is Position => entry !== null)
      : [];
    const closedTrades = Array.isArray(parsed.closedTrades)
      ? parsed.closedTrades.map(coerceTrade).filter((entry): entry is Trade => entry !== null)
      : [];

    return {
      ...defaultState(),
      ...parsed,
      positions,
      closedTrades,
      closedPositions: toNumber(parsed.closedPositions, closedTrades.length),
      paperBalanceUsd: toNumber(parsed.paperBalanceUsd, defaultState().paperBalanceUsd),
      realizedPnlUsd: toNumber(parsed.realizedPnlUsd, 0),
      lastCycleAtMs: toNumber(parsed.lastCycleAtMs, 0)
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
