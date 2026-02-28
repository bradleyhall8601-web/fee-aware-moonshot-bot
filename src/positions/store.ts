import fs from "fs";
import path from "path";
import { Position, Trade, PersistentStore } from "./types.js";

const STORE_PATH = path.resolve(process.cwd(), "trades.json");

function load(): PersistentStore {
  if (!fs.existsSync(STORE_PATH)) {
    return { positions: [], trades: [] };
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as PersistentStore;
  } catch {
    return { positions: [], trades: [] };
  }
}

function save(store: PersistentStore): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

let _store: PersistentStore = load();

export function getOpenPositions(): Position[] {
  return _store.positions.filter((p) => p.status === "open");
}

export function getAllPositions(): Position[] {
  return _store.positions;
}

export function findPosition(id: string): Position | undefined {
  return _store.positions.find((p) => p.id === id);
}

export function upsertPosition(pos: Position): void {
  const idx = _store.positions.findIndex((p) => p.id === pos.id);
  if (idx >= 0) {
    _store.positions[idx] = pos;
  } else {
    _store.positions.push(pos);
  }
  save(_store);
}

export function recordTrade(trade: Trade): void {
  _store.trades.push(trade);
  save(_store);
}

export function getTrades(): Trade[] {
  return _store.trades;
}

/** Returns true if the given token mint is already in an open position. */
export function hasOpenPositionForMint(tokenMint: string): boolean {
  return getOpenPositions().some((p) => p.tokenMint === tokenMint);
}
