import { cn } from '../lib/utils';

interface Props {
  value: number; // 0-100
  size?: 'sm' | 'md';
}

export default function ConfidenceMeter({ value, size = 'md' }: Props) {
  const color =
    value >= 80 ? 'bg-brand-500' :
    value >= 65 ? 'bg-yellow-500' :
                  'bg-red-500';

  const label =
    value >= 80 ? 'High' :
    value >= 65 ? 'Med'  : 'Low';

  return (
    <div className={cn('flex items-center gap-2', size === 'sm' ? 'w-24' : 'w-32')}>
      <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={cn('text-xs font-medium tabular-nums',
        value >= 80 ? 'text-brand-400' :
        value >= 65 ? 'text-yellow-400' : 'text-red-400'
      )}>
        {value}%
      </span>
    </div>
  );
}
