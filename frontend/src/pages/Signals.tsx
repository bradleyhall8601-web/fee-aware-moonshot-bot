import { Zap, TrendingUp, Droplets, Clock, RefreshCw } from 'lucide-react';
import { usePolling } from '../lib/hooks';
import { api, type MoonshotCandidate } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import ConfidenceMeter from '../components/ConfidenceMeter';
import RefreshButton from '../components/RefreshButton';
import { formatUsd, formatPct, profitColor, truncateAddress } from '../lib/utils';
import { cn } from '../lib/utils';

export default function Signals() {
  const {
    data: candidates, error, loading, refresh,
  } = usePolling(api.moonshots, 30_000);

  const sorted = [...(candidates ?? [])].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Live Signals</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-scored moonshot candidates from DexScreener
          </p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500" /> High confidence ≥80%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium 65–79%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Low &lt;65%
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No signals available"
          message="The bot is scanning DEXs for moonshot candidates. Check back in a moment."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(c => (
            <SignalCard key={c.mint} candidate={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({ candidate: c }: { candidate: MoonshotCandidate }) {
  const borderColor =
    c.confidence >= 80 ? 'border-brand-800 glow-green' :
    c.confidence >= 65 ? 'border-yellow-900' :
                         'border-surface-border';

  return (
    <div className={cn('card border transition-all duration-200 hover:border-brand-700', borderColor)}>
      {/* Token header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{c.symbol || 'UNKNOWN'}</span>
            {c.confidence >= 80 && (
              <span className="badge badge-green">
                <Zap className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{c.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Confidence</p>
          <ConfidenceMeter value={c.confidence} size="sm" />
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-lg font-bold text-white tabular-nums">
          ${c.price < 0.001 ? c.price.toExponential(3) : c.price.toFixed(6)}
        </span>
        <span className={cn('text-xs font-medium', profitColor(c.priceChange5m))}>
          {formatPct(c.priceChange5m)} 5m
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat icon={Droplets} label="Liquidity" value={formatUsd(c.liquidity)} />
        <Stat icon={TrendingUp} label="Vol 24h"   value={formatUsd(c.volume24h)} />
        <Stat icon={Clock}      label="Age"        value={`${c.age.toFixed(1)}h`} />
        <Stat icon={Zap}        label="Buy Press." value={`${c.buyPressure.toFixed(0)}%`} />
      </div>

      {/* Buy/Sell ratio */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full"
            style={{ width: `${Math.min(100, (c.buys / Math.max(1, c.buys + c.sells)) * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          {c.buys}B / {c.sells}S
        </span>
      </div>

      {/* DEX tags + mint */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {c.dexs.map(d => (
            <span key={d} className="badge badge-gray capitalize">{d}</span>
          ))}
        </div>
        <span className="font-mono text-xs text-gray-600">
          {truncateAddress(c.mint, 4)}
        </span>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-gray-600 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-600 leading-none">{label}</p>
        <p className="text-xs font-medium text-gray-300 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
