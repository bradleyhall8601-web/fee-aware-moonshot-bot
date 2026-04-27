import { useState } from 'react';
import { Users as UsersIcon, ChevronDown, ChevronUp, Wallet, BarChart2 } from 'lucide-react';
import { usePolling, useFetch } from '../lib/hooks';
import { api, type User, type UserDetail } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import RefreshButton from '../components/RefreshButton';
import { formatUsd, formatPct, formatDate, truncateAddress } from '../lib/utils';
import { cn } from '../lib/utils';

export default function Users() {
  const { data: users, error, loading, refresh } = usePolling(api.users, 30_000);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">Registered traders and their configurations</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      ) : !users || users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No users registered"
          message="Users register via the Telegram bot using /register. They'll appear here once signed up."
        />
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expanded === u.id}
              onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user, expanded, onToggle,
}: { user: User; expanded: boolean; onToggle: () => void }) {
  const { data: detail, loading } = useFetch(() =>
    expanded ? api.user(user.id) : Promise.resolve(null)
  );

  return (
    <div className="card p-0 overflow-hidden">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-brand-900 border border-brand-800 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-brand-400">
            {user.username.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">@{user.username}</span>
            <span className={user.isActive ? 'badge badge-green' : 'badge badge-gray'}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {truncateAddress(user.walletAddress, 8)}
          </p>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-500">Joined</p>
          <p className="text-xs text-gray-300">{formatDate(user.createdAt)}</p>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-surface-border px-5 py-4 bg-surface animate-fade-in">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : detail ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Config */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> Configuration
                </h4>
                {detail.config ? (
                  <dl className="space-y-2">
                    {[
                      ['Min Liquidity',   formatUsd(detail.config.minLiquidityUsd)],
                      ['Profit Target',   formatPct(detail.config.profitTargetPct)],
                      ['Trailing Stop',   formatPct(detail.config.trailingStopPct)],
                      ['Min Txns',        String(detail.config.minTxns)],
                      ['Max Txns',        String(detail.config.maxTxns)],
                      ['Live Trading',    detail.config.enableLiveTrading ? '✅ Enabled' : '❌ Paper Mode'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <dt className="text-gray-500">{k}</dt>
                        <dd className="text-gray-200 font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-gray-600">No config found</p>
                )}
              </div>

              {/* Metrics */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5" /> Performance
                </h4>
                {detail.metrics ? (
                  <dl className="space-y-2">
                    {[
                      ['Total Trades',   String(detail.metrics.totalTrades)],
                      ['Winning',        String(detail.metrics.winningTrades)],
                      ['Losing',         String(detail.metrics.losingTrades)],
                      ['Win Rate',       `${detail.metrics.winRate?.toFixed(1) ?? 0}%`],
                      ['Total P&L',      formatUsd(detail.metrics.totalProfit)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <dt className="text-gray-500">{k}</dt>
                        <dd className="text-gray-200 font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-gray-600">No performance data yet</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-4">Failed to load user details</p>
          )}
        </div>
      )}
    </div>
  );
}
