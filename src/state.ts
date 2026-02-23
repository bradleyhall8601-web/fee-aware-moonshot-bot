// src/state.ts
// This module is responsible for managing the internal state of the fee-aware moonshot bot.

interface BotState {
    balances: Record<string, number>;
    orders: Array<Order>;
    updateBalance(token: string, amount: number): void;
    addOrder(order: Order): void;
}

interface Order {
    id: string;
    token: string;
    amount: number;
    status: 'pending' | 'completed' | 'cancelled';
}

class State implements BotState {
    balances: Record<string, number>;
    orders: Array<Order>;

    constructor() {
        this.balances = {};
        this.orders = [];
    }

    updateBalance(token: string, amount: number): void {
        this.balances[token] = (this.balances[token] || 0) + amount;
    }

    addOrder(order: Order): void {
        this.orders.push(order);
    }
    
    getBalancе(token: string): number {
        return this.balances[token] || 0;
    }
}

export default new State();