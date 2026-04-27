import { useState } from 'react';
import { Save, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { usePolling } from '../lib/hooks';
import { api, type UserConfig } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import { cn } from '../lib/utils';

export default function Settings() {
  const { data: users, loading: usersLoading } = usePolling(api.users, 60_000);
  const [userId, setUserId]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  const [form, setForm] = useState<Partial<UserConfig>>({
    minLiquidityUsd:  7500,
    profitTargetPct:  30,
    trailingStopPct:  15,
    minTxns:          15,
    maxTxns:          1200,
    enableLiveTrading: false,
    tradeSize:        30,
  });

  const handleUserChange = async (id: string) => {
    setUserId(id);
    setSaved(false);
    setError(null);
    if (!id) return;
    try {
      const detail = await api.user(id);
      if (detail.config) {
        setForm({
          minLiquidityUsd:   detail.config.minLiquidityUsd,
          profitTargetPct:   detail.config.profitTargetPct,
          trailingStopPct:   detail.config.trailingStopPct,
          minTxns:           detail.config.minTxns,
          maxTxns:           detail.config.maxTxns,
          enableLiveTrading: detail.config.enableLiveTrading,
          tradeSize:         detail.config.tradeSize ?? 30,
        });
      }
    } catch (err) {
      setError('Failed to load user config');
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateConfig(userId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    type: 'number' | 'toggle' = 'number',
    hint?: string
  ) => {
    if (type === 'toggle') {
      return (
        <div className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
              form[key] ? 'bg-brand-600' : 'bg-surface-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
                form[key] ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      );
    }

    return (
      <div className="py-3 border-b border-surface-border last:border-0">
        <label className="block text-sm font-medium text-white mb-1">{label}</label>
        {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
        <input
          type="number"
          value={form[key] as number ?? ''}
          onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
          className="input"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure per-user trading parameters</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* User selector */}
      <div className="card">
        <label className="block text-xs font-medium text-gray-500 mb-2">Select User to Configure</label>
        {usersLoading ? (
          <div className="h-9 bg-surface-border rounded-lg animate-pulse" />
        ) : (
          <select
            value={userId}
            onChange={e => handleUserChange(e.target.value)}
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
          {/* Risk settings */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-brand-400" />
              Trading Parameters
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Changes take effect on the next trading cycle.
            </p>

            {field('minLiquidityUsd', 'Min Liquidity (USD)', 'number', 'Minimum pool liquidity required to enter a trade')}
            {field('profitTargetPct', 'Profit Target (%)',   'number', 'Close position when profit reaches this percentage')}
            {field('trailingStopPct', 'Trailing Stop (%)',   'number', 'Close position when price drops this % from peak')}
            {field('tradeSize',       'Trade Size (USD)',     'number', 'Dollar amount per trade (paper mode)')}
            {field('minTxns',         'Min Transactions',    'number', 'Minimum pool transactions required')}
            {field('maxTxns',         'Max Transactions',    'number', 'Maximum pool transactions allowed')}
          </div>

          {/* Live trading toggle */}
          <div className="card border-yellow-900">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-400">Live Trading</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enabling live trading will execute real on-chain transactions with real funds.
                  Only enable if you fully understand the risks.
                </p>
              </div>
            </div>
            {field('enableLiveTrading', 'Enable Live Trading', 'toggle', 'Toggle between paper and live trading mode')}
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span className="text-xs text-brand-400 animate-fade-in">
                ✓ Saved successfully
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
