'// tests/store.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  openPosition,
  closePosition,
  updatePeak,
  getOpenPositions,
  getAllPositions,
  getPositionById,
  resetStore,
} from "../src/positions/store.js";

beforeEach(() => {
  resetStore();
});

describe("openPosition", () => {
  it("creates a position with status=open", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    expect(pos.status).toBe("open");
    expect(pos.mint).toBe("MINT1");
    expect(pos.symbol).toBe("TKN");
    expect(pos.entryPriceUsd).toBe(1.0);
    expect(pos.tokenAmount).toBe(1000);
  });

  it("assigns a unique id to each position", () => {
    const a = openPosition("M1", "A", 1, 0.05, 100);
    const b = openPosition("M2", "B", 2, 0.05, 200);
    expect(a.id).not.toBe(b.id);
  });

  it("appears in getOpenPositions()", () => {
    openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    expect(getOpenPositions()).toHaveLength(1);
  });

  it("sets peakPriceUsd equal to entryPriceUsd on open", () => {
    const pos = openPosition("MINT1", "TKN", 2.5, 0.05, 500);
    expect(pos.peakPriceUsd).toBe(2.5);
  });
});

describe("updatePeak", () => {
  it("updates peakPriceUsd when price rises", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    updatePeak(pos.id, 2.0);
    expect(getPositionById(pos.id)!.peakPriceUsd).toBe(2.0);
  });

  it("does not lower peakPriceUsd when price falls", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    updatePeak(pos.id, 2.0);
    updatePeak(pos.id, 0.5);
    expect(getPositionById(pos.id)!.peakPriceUsd).toBe(2.0);
  });
});

describe("closePosition", () => {
  it("closes an open position and records pnl", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    const closed = closePosition(pos.id, 1.3, 30, "take_profit");
    expect(closed).toBeDefined();
    expect(closed!.status).toBe("closed");
    expect(closed!.pnlPct).toBe(30);
    expect(closed!.closeReason).toBe("take_profit");
  });

  it("removes closed position from getOpenPositions()", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    closePosition(pos.id, 1.3, 30, "take_profit");
    expect(getOpenPositions()).toHaveLength(0);
  });

  it("returns undefined for an unknown id", () => {
    expect(closePosition("nonexistent", 1, 0, "stop_loss")).toBeUndefined();
  });

  it("returns undefined when trying to close an already-closed position", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    closePosition(pos.id, 1.3, 30, "take_profit");
    expect(closePosition(pos.id, 1.3, 30, "take_profit")).toBeUndefined();
  });
});

describe("getAllPositions / getPositionById", () => {
  it("getAllPositions returns both open and closed", () => {
    const p1 = openPosition("M1", "A", 1, 0.05, 100);
    openPosition("M2", "B", 2, 0.05, 200);
    closePosition(p1.id, 1.5, 50, "take_profit");
    expect(getAllPositions()).toHaveLength(2);
  });

  it("getPositionById returns the correct position", () => {
    const pos = openPosition("MINT1", "TKN", 1.0, 0.05, 1000);
    expect(getPositionById(pos.id)?.id).toBe(pos.id);
  });

  it("getPositionById returns undefined for unknown id", () => {
    expect(getPositionById("ghost")).toBeUndefined();
  });
});

describe("resetStore", () => {
  it("clears all positions", () => {
    openPosition("M1", "A", 1, 0.05, 100);
    openPosition("M2", "B", 2, 0.05, 200);
    resetStore();
    expect(getAllPositions()).toHaveLength(0);
  });
});'