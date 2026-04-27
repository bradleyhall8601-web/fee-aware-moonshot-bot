// Centralised API client — all fetch calls go through here.

const BASE = '';   // same-origin; Vite dev proxy handles /api → :3000

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SystemStatus {
  uptime: number;
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  activeUsers: number;
  activeTrades: number;
  totalTrades: number;
  totalProfit: number;
}

export interface HealthCheck {
  ok: boolean;
  timestamp: string;
  uptime: number;
}

export interface User {
  id: string;
  telegramId: string;
  username: string;
  walletAddress: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserConfig {
  userId: string;
  minLiquidityUsd: number;
  maxPoolAgeMs: number;
  minTxns: number;
  maxTxns: number;
  profitTargetPct: number;
  trailingStopPct: number;
  enableLiveTrading: boolean;
  tradeSize?: number;
}

export interface UserDetail {
  user: User;
  config: UserConfig | null;
  metrics: PerformanceMetrics | null;
}

export interface TradingSession {
  id: string;
  userId: string;
  tokenMint: string;
  entryPrice: number;
  entryAmount: number;
  exitPrice?: number;
  exitAmount?: number;
  profit?: number;
  profitPct?: number;
  status: 'open' | 'closed' | 'stopped';
  startedAt: number;
  endedAt?: number;
}

export interface PerformanceMetrics {
  id: string;
  userId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  winRate: number;
  updatedAt: number;
}

export interface MoonshotCandidate {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  liquidity: number;
  volume24h: number;
  priceChange5m: number;
  holders: number;
  age: number;
  buys: number;
  sells: number;
  buyPressure: number;
  confidence: number;
  dexs: string[];
}

export interface DebugStatus {
  timestamp: string;
  environment: string;
  nodeVersion: string;
  platform: string;
  system: {
    uptime: number;
    memory: SystemStatus['memory'];
  };
  bot: {
    isRunning: boolean;
    telegramToken: string;
    totalUsers: number;
    activeTrades: number;
    totalTrades: number;
  };
  endpoints: Record<string, string>;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const api = {
  health:        ()                          => get<HealthCheck>('/health'),
  systemStatus:  ()                          => get<SystemStatus>('/api/system/status'),
  systemLogs:    (lines = 200)               => get<{ logs: string }>(`/api/system/logs?lines=${lines}`),
  debugStatus:   ()                          => get<DebugStatus>('/debug/status'),

  users:         ()                          => get<User[]>('/api/users'),
  user:          (id: string)                => get<UserDetail>(`/api/users/${id}`),
  updateConfig:  (id: string, cfg: Partial<UserConfig>) => post<{ success: boolean }>(`/api/users/${id}/config`, cfg),

  trades:        (userId: string)            => get<TradingSession[]>(`/api/trades/${userId}`),
  performance:   (userId: string)            => get<PerformanceMetrics>(`/api/performance/${userId}`),

  moonshots:     ()                          => get<MoonshotCandidate[]>('/api/market/moonshots'),
  tokenPrice:    (mint: string)              => get<{ mint: string; price: number }>(`/api/market/price/${mint}`),
};
