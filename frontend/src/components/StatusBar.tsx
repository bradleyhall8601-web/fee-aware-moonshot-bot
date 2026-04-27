import { usePolling } from '../lib/hooks';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export default function StatusBar() {
  const { data: health } = usePolling(api.health, 15_000);

  const online = health?.ok === true;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
          online
            ? 'bg-brand-950 text-brand-400 border-brand-800'
            : 'bg-red-950 text-red-400 border-red-900'
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            online ? 'bg-brand-400 animate-pulse' : 'bg-red-400'
          )}
        />
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
