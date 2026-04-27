import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  label:     string;
  value:     string | number;
  sub?:      string;
  icon?:     LucideIcon;
  iconColor?: string;
  trend?:    'up' | 'down' | 'neutral';
  loading?:  boolean;
}

export default function StatCard({
  label, value, sub, icon: Icon, iconColor = 'text-brand-400', trend, loading,
}: Props) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="stat-label">{label}</p>
        {Icon && (
          <div className={cn('p-2 rounded-lg bg-surface', iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-surface-border rounded animate-pulse" />
      ) : (
        <p className="stat-value">{value}</p>
      )}

      {sub && (
        <p
          className={cn(
            'text-xs',
            trend === 'up'   ? 'text-brand-400' :
            trend === 'down' ? 'text-red-400'   : 'text-gray-500'
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
