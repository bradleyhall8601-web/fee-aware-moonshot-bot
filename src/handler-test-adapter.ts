// src/handler-test-adapter.ts
// Test utilities for bot handlers

import database from './database';
import userManager from './user-manager';
import paperTrading from './paper-trading';
import confidenceScorer from './confidence-scorer';
import type { AggregatedSignal } from './signal-aggregator';

export function createMockSignal(overrides: Partial<AggregatedSignal> = {}): AggregatedSignal {
  return {
    mint: 'TestMint123456789012345678901234567890',
    symbol: 'TEST',
    name: 'Test Token',
    price: 0.000001,
    liquidity: 50000,
    volume1h: 10000,
    volume24h: 240000,
    priceChange5m: 5.2,
    priceChange1h: 12.5,
    buys1h: 150,
    sells1h: 50,
    buyPressure: 75,
    ageHours: 2,
    sources: ['dexscreener', 'gecko'],
    sourceCount: 2,
    sourceBonus: 3,
    fdvUsd: 100000,
    isNewPool: false,
    isPumpFun: false,
    rugRisk: false,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

export function createMockUser(telegramId = '123456789') {
  const existing = database.getUserByTelegramId(telegramId);
  if (existing) return existing;
  return database.createUser({
    id: `test_user_${Date.now()}`,
    telegramId,
    username: 'test_user',
    walletAddress: 'TestWallet123456789012345678901234567890',
    privateKey: 'encrypted_test_key',
    isActive: true,
  });
}

export function scoreSignal(signal: AggregatedSignal) {
  return confidenceScorer.score(signal);
}

export function getPaperStats() {
  return paperTrading.getStats();
}

export function getDatabaseHealth(): boolean {
  try {
    database.getAllActiveUsers();
    return true;
  } catch {
    return false;
  }
}
