import { Activity, Cpu, HardDrive, Clock, Terminal, CheckCircle, XCircle } from 'lucide-react';
import { usePolling } from '../lib/hooks';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import RefreshButton from '../components/RefreshButton';
import { formatBytes, formatUptime, formatDate } from '../lib/utils';
import { cn } from '../lib/utils';

export default function SystemStatus() {
  const {
    data: status, error: statusErr, loading: statusLoading, refresh: refreshStatus,
  } = usePolling(api.systemStatus, 10_000);

  const {
    data: debug, error: debugErr, loading: debugLoading, refresh: refreshDebug,
  } = usePolling(api.debugStatus, 15_000);

  const {
    data: logs, loading: logsLoading, refresh: refreshLogs,
  } = usePolling(() => api.systemLogs(150), 20_000);

  const refresh = () => { refreshStatus(); refreshDebug(); refreshLogs(); };
  const loading = statusLoading || debugLoading;

  const logLines = (logs?.logs ?? '').split('\n').filter(Boolean).reverse();

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">System Status</h2>
          <p className="text-sm text-gray-500 mt-0.5">Runtime metrics and live logs</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {(statusErr || debugErr) && (
        <ErrorBanner message={statusErr ?? debugErr ?? 'Unknown error'} onRetry={refresh} />
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Clock}
          label="Uptime"
          value={status ? formatUptime(status.uptime) : '—'}
          loading={statusLoading}
        />
        <MetricCard
          icon={HardDrive}
          label="Heap Used"
          value={status ? formatBytes(status.memory.heapUsed) : '—'}
          loading={statusLoading}
        />
        <MetricCard
          icon={Cpu}
          label="RSS Memory"
          value={status ? formatBytes(status.memory.rss) : '—'}
          loading={statusLoading}
        />
        <MetricCard
          icon={Activity}
          label="Active Trades"
          value={status?.activeTrades ?? '—'}
          loading={statusLoading}
        />
      </div>

      {/* Bot status */}
      {debug && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Bot Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {[
                ['Environment',    debug.environment],
                ['Node.js',        debug.nodeVersion],
                ['Platform',       debug.platform],
                ['Telegram Token', debug.bot.telegramToken],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-1.5 border-b border-surface-border last:border-0">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-200 font-medium font-mono">{v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                ['Total Users',   String(debug.bot.totalUsers)],
                ['Active Trades', String(debug.bot.activeTrades)],
                ['Total Trades',  String(debug.bot.totalTrades)],
                ['Bot Running',   debug.bot.isRunning ? '✅ Yes' : '❌ No'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-1.5 border-b border-surface-border last:border-0">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-200 font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API endpoints */}
      {debug?.endpoints && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">API Endpoints</h3>
          <div className="space-y-2">
            {Object.entries(debug.endpoints).map(([name, url]) => (
              <div key={name} className="flex items-center gap-3 text-xs">
                <CheckCircle className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <span className="text-gray-500 capitalize w-24">{name}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand-400 hover:text-brand-300 transition-colors truncate"
                >
                  {url}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-brand-400" />
            Live Logs
          </h3>
          <RefreshButton onClick={refreshLogs} loading={logsLoading} />
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : logLines.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-8">No logs available yet</p>
        ) : (
          <div className="bg-surface rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-0.5">
            {logLines.map((line, i) => (
              <LogLine key={i} line={line} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, loading,
}: { icon: React.ElementType; label: string; value: string | number; loading?: boolean }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-brand-400" />
        <p className="stat-label">{label}</p>
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-surface-border rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      )}
    </div>
  );
}

function LogLine({ line }: { line: string }) {
  let parsed: any = null;
  try { parsed = JSON.parse(line); } catch {}

  if (parsed) {
    const level = parsed.level ?? 'info';
    const color =
      level === 'error' ? 'text-red-400' :
      level === 'warn'  ? 'text-yellow-400' :
      level === 'debug' ? 'text-gray-600' :
                          'text-gray-300';

    return (
      <div className={cn('flex gap-2', color)}>
        <span className="text-gray-600 flex-shrink-0">
          {parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : ''}
        </span>
        <span className="uppercase text-xs w-10 flex-shrink-0 font-bold">{level}</span>
        <span className="text-gray-500 flex-shrink-0">[{parsed.module ?? 'app'}]</span>
        <span className="flex-1 break-all">{parsed.message}</span>
      </div>
    );
  }

  // Raw line
  const isError = /error|fail|exception/i.test(line);
  const isWarn  = /warn|warning/i.test(line);

  return (
    <div className={cn(
      'break-all',
      isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-gray-400'
    )}>
      {line}
    </div>
  );
}
