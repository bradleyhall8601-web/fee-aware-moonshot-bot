// src/state.ts
// Lightweight in-memory state for the fee-aware moonshot bot.
// For paper trading all position tracking is handled by PaperTrader in paper.ts;
// this module provides a simple key/value balance store and order log.

interface Order {
  id: string;
  token: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
}

class State {
  balances: Record<string, number> = {};
  orders: Order[] = [];

  updateBalance(token: string, amount: number): void {
    this.balances[token] = (this.balances[token] ?? 0) + amount;
  }

  getBalance(token: string): number {
    return this.balances[token] ?? 0;
  }

  addOrder(order: Order): void {
    this.orders.push(order);
  }

  reset(): void {
    this.balances = {};
    this.orders = [];
  }
}

export default new State();