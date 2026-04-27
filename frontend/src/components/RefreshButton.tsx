import { RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onClick:   () => void;
  loading?:  boolean;
  className?: string;
}

export default function RefreshButton({ onClick, loading, className }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn('btn-ghost flex items-center gap-1.5 text-xs', className)}
    >
      <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
      Refresh
    </button>
  );
}
