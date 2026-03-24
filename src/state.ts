// src/state.ts
// In-memory paper-trading state with optional JSON persistence.

import * as fs from "fs";
import * as path from "path";
import { BotState, Position, TradeRecord, WatchedWallet } from "./types";
import { config } from "./config";

const STATE_FILE = path.resolve(process.cwd(), "state.json");

function defaultState(): BotState {
  return {
    cashUsd: config.SIM_START_BALANCE_USD,
    positions: {},
    trades: [],
    watchedWallets: [],
    startedAt: Date.now(),
    lastScanAt: undefined,
    // Legacy / debug.ts compatible fields
    lastMode: "paper",
    lastEntryBlockedReasons: [],
    solBalance: 0,
    pnl: 0,
    lastSeenLiquidityUsdByPool: {},
    updatedAtMs: Date.now(),
  };
}

let _state: BotState = defaultState();

// ── Initialise from persisted file (if exists) ────────────────────────────────
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<BotState>;
    _state = { ...defaultState(), ...parsed };
  }
} catch {
  // corrupt file – start fresh
}

// ── Public API ────────────────────────────────────────────────────────────────

export function loadState(): BotState {
  return _state;
}

export function saveState(): void {
  _state.updatedAtMs = Date.now();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(_state, null, 2));
  } catch {
    // non-fatal – state lives in memory
  }
}

// ── Cash helpers ──────────────────────────────────────────────────────────────

export function getCash(): number {
  return _state.cashUsd;
}

export function deductCash(amount: number): void {
  _state.cashUsd = Math.max(0, _state.cashUsd - amount);
}

export function addCash(amount: number): void {
  _state.cashUsd += amount;
}

// ── Position helpers ──────────────────────────────────────────────────────────

export function openPosition(pos: Position): void {
  _state.positions[pos.address] = pos;
  _state.lastMode = "paper";
  saveState();
}

export function closePosition(address: string): Position | undefined {
  const pos = _state.positions[address];
  if (pos) {
    delete _state.positions[address];
    _state.pnl += pos.unrealizedPnlUsd;
    saveState();
  }
  return pos;
}

export function updatePositionPrice(
  address: string,
  currentPriceUsd: number
): void {
  const pos = _state.positions[address];
  if (!pos) return;
  pos.currentPriceUsd = currentPriceUsd;
  pos.currentValueUsd = pos.units * currentPriceUsd;
  pos.unrealizedPnlUsd = pos.currentValueUsd - pos.costUsd;
  pos.unrealizedPnlPct =
    pos.costUsd > 0 ? (pos.unrealizedPnlUsd / pos.costUsd) * 100 : 0;
  if (pos.currentValueUsd > pos.highWaterMarkUsd) {
    pos.highWaterMarkUsd = pos.currentValueUsd;
  }
}

export function getPositions(): Position[] {
  return Object.values(_state.positions);
}

// ── Trade log ─────────────────────────────────────────────────────────────────

export function recordTrade(trade: TradeRecord): void {
  _state.trades.push(trade);
  // Keep last 1000 trades in memory
  if (_state.trades.length > 1000) {
    _state.trades = _state.trades.slice(-1000);
  }
  saveState();
}

// ── Watch wallets ─────────────────────────────────────────────────────────────

export function addWatchedWallet(wallet: WatchedWallet): boolean {
  const exists = _state.watchedWallets.some(
    (w) => w.address === wallet.address
  );
  if (exists) return false;
  _state.watchedWallets.push(wallet);
  saveState();
  return true;
}

export function getWatchedWallets(): WatchedWallet[] {
  return _state.watchedWallets;
}

// ── Liquidity snapshot (legacy) ───────────────────────────────────────────────

export function updateLiquiditySnapshot(pool: string, usd: number): void {
  _state.lastSeenLiquidityUsdByPool[pool] = usd;
}

export function markScanTime(): void {
  _state.lastScanAt = Date.now();
  _state.updatedAtMs = Date.now();
}

export function setBlockedReasons(reasons: string[]): void {
  _state.lastEntryBlockedReasons = reasons;
}

// ── Legacy class API (kept for potential back-compat consumers) ───────────────

interface Order {
  id: string;
  token: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
}

class State {
  get balances(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [addr, pos] of Object.entries(_state.positions)) {
      result[addr] = pos.currentValueUsd;
    }
    return result;
  }

  get orders(): Order[] {
    return [];
  }

  updateBalance(_token: string, _amount: number): void {
    // no-op in paper mode
  }

  addOrder(_order: Order): void {
    // no-op in paper mode
  }

  getBalance(token: string): number {
    const pos = _state.positions[token];
    return pos ? pos.currentValueUsd : 0;
  }
}

export default new State();