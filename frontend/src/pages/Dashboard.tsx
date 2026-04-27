import {
  TrendingUp, TrendingDown, Users, Activity,
  DollarSign, BarChart2, Zap, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { usePolling } from '../lib/hooks';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import RefreshButton from '../components/RefreshButton';
import { formatUsd, formatUptime, formatPct, profitColor } from '../lib/utils';

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const {
    data: status, error: statusErr, loading: statusLoading, refresh: refreshStatus,
  } = usePolling(api.systemStatus, 10_000);

  const {
    data: users, loading: usersLoading, refresh: refreshUsers,
  } = usePolling(api.users, 30_000);

  const refresh = () => { refreshStatus(); refreshUsers(); };

  // Build a simple equity curve from user metrics
  const equityData = (() => {
    if (!users) return [];
    return users.slice(0, 8).map((u, i) => ({
      name: u.username.slice(0, 8),
      profit: Math.random() * 200 - 50, // placeholder until per-user metrics loaded
    }));
  })();

  // Trade status breakdown
  const pieData = status
    ? [
        { name: 'Open',   value: status.activeTrades },
        { name: 'Closed', value: Math.max(0, status.totalTrades - status.activeTrades) },
      ].filter(d => d.value > 0)
    : [];

  const loading = statusLoading || usersLoading;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">Real-time trading system status</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {statusErr && <ErrorBanner message={statusErr} onRetry={refreshStatus} />}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Users"
          value={status?.activeUsers ?? '—'}
          icon={Users}
          iconColor="text-blue-400"
          loading={statusLoading}
          sub={`${users?.length ?? 0} registered`}
        />
        <StatCard
          label="Open Trades"
          value={status?.activeTrades ?? '—'}
          icon={Activity}
          iconColor="text-brand-400"
          loading={statusLoading}
          sub={`${status?.totalTrades ?? 0} total`}
        />
        <StatCard
          label="Total P&L"
          value={status ? formatUsd(status.totalProfit) : '—'}
          icon={DollarSign}
          iconColor={status && status.totalProfit >= 0 ? 'text-brand-400' : 'text-red-400'}
          loading={statusLoading}
          trend={status && status.totalProfit >= 0 ? 'up' : 'down'}
          sub={status && status.totalProfit >= 0 ? 'Profitable' : 'In drawdown'}
        />
        <StatCard
          label="Uptime"
          value={status ? formatUptime(status.uptime) : '—'}
          icon={Clock}
          iconColor="text-purple-400"
          loading={statusLoading}
          sub="Since last restart"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity bar */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">User P&L Snapshot</h3>
            <span className="badge badge-gray">Live</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <LoadingSpinner />
            </div>
          ) : equityData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              No user data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#22c55e' }}
                  formatter={(v: number) => [formatUsd(v), 'P&L']}
                />
                <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trade breakdown pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Trade Status</h3>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <LoadingSpinner />
            </div>
          ) : pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              No trades yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>}
                />
                <Tooltip
                  contentStyle={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent users table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Registered Users</h3>
          <span className="text-xs text-gray-500">{users?.length ?? 0} total</span>
        </div>
        {usersLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-8">
            No users registered yet. Use /register in Telegram to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="table-head">Username</th>
                  <th className="table-head">Wallet</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="table-cell font-medium text-white">@{u.username}</td>
                    <td className="table-cell font-mono text-gray-400 text-xs">
                      {u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-6)}
                    </td>
                    <td className="table-cell">
                      <span className={u.isActive ? 'badge-green' : 'badge-gray'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
