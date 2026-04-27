import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Search, Filter } from 'lucide-react';
import { usePolling, useFetch } from '../lib/hooks';
import { api, type TradingSession } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import RefreshButton from '../components/RefreshButton';
import { formatUsd, formatPct, formatDate, profitColor, truncateAddress } from '../lib/utils';
import { cn } from '../lib/utils';

type Filter = 'all' | 'open' | 'closed';

export default function Trades() {
  const [filter, setFilter]   = useState<Filter>('all');
  const [search, setSearch]   = useState('');
  const [userId, setUserId]   = useState<string>('');

  const { data: users, loading: usersLoading } = usePolling(api.users, 30_000);

  // When a user is selected, fetch their trades
  const {
    data: trades, error, loading: tradesLoading, refresh,
  } = usePolling(
    () => userId ? api.trades(userId) : Promise.resolve([]),
    15_000
  );

  const filtered = (trades ?? []).filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.tokenMint.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount   = (trades ?? []).filter(t => t.status === 'open').length;
  const closedCount = (trades ?? []).filter(t => t.status === 'closed').length;
  const totalPnl    = (trades ?? [])
    .filter(t => t.status === 'closed')
    .reduce((s, t) => s + (t.profit ?? 0), 0);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Trades</h2>
          <p className="text-sm text-gray-500 mt-0.5">Per-user trading history</p>
        </div>
        <RefreshButton onClick={refresh} loading={tradesLoading} />
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {/* User selector */}
      <div className="card">
        <label className="block text-xs font-medium text-gray-500 mb-2">Select User</label>
        {usersLoading ? (
          <div className="h-9 bg-surface-border rounded-lg animate-pulse" />
        ) : (
          <select
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="input"
          >
            <option value="">— choose a user —</option>
            {(users ?? []).map(u => (
              <option key={u.id} value={u.id}>@{u.username}</option>
            ))}
          </select>
        )}
      </div>

      {userId && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card-sm text-center">
              <p className="stat-label mb-1">Open</p>
              <p className="text-xl font-bold text-brand-400">{openCount}</p>
            </div>
            <div className="card-sm text-center">
              <p className="stat-label mb-1">Closed</p>
              <p className="text-xl font-bold text-white">{closedCount}</p>
            </div>
            <div className="card-sm text-center">
              <p className="stat-label mb-1">Total P&L</p>
              <p className={cn('text-xl font-bold', profitColor(totalPnl))}>
                {formatUsd(totalPnl)}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search by token mint…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="flex gap-1 bg-surface-card border border-surface-border rounded-lg p-1">
              {(['all', 'open', 'closed'] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                    filter === f
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            {tradesLoading ? (
              <div className="flex items-center justify-center py-16">
                <LoadingSpinner />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No trades found"
                message="Trades will appear here once the bot starts executing signals."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="table-head">Token</th>
                      <th className="table-head">Entry</th>
                      <th className="table-head">Exit</th>
                      <th className="table-head">P&L</th>
                      <th className="table-head">Status</th>
                      <th className="table-head">Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <TradeRow key={t.id} trade={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TradeRow({ trade: t }: { trade: TradingSession }) {
  const pnl    = t.profit ?? 0;
  const pnlPct = t.profitPct ?? 0;

  return (
    <tr className="table-row">
      <td className="table-cell">
        <span className="font-mono text-xs text-gray-300">
          {truncateAddress(t.tokenMint, 6)}
        </span>
      </td>
      <td className="table-cell tabular-nums text-gray-300">
        ${t.entryPrice.toFixed(8)}
      </td>
      <td className="table-cell tabular-nums text-gray-400">
        {t.exitPrice ? `$${t.exitPrice.toFixed(8)}` : '—'}
      </td>
      <td className="table-cell">
        {t.status === 'open' ? (
          <span className="text-gray-500 text-xs">Pending</span>
        ) : (
          <div className="flex items-center gap-1">
            {pnl > 0 ? (
              <TrendingUp className="w-3 h-3 text-brand-400" />
            ) : pnl < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-gray-500" />
            )}
            <span className={cn('text-xs font-medium tabular-nums', profitColor(pnl))}>
              {formatUsd(pnl)} ({formatPct(pnlPct)})
            </span>
          </div>
        )}
      </td>
      <td className="table-cell">
        <span className={cn(
          'badge',
          t.status === 'open'   ? 'badge-blue' :
          t.status === 'closed' ? (pnl >= 0 ? 'badge-green' : 'badge-red') :
          'badge-gray'
        )}>
          {t.status}
        </span>
      </td>
      <td className="table-cell text-gray-500 text-xs">
        {formatDate(t.startedAt)}
      </td>
    </tr>
  );
}
