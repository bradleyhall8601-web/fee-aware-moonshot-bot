import { cn } from '../lib/utils';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export default function LoadingSpinner({ size = 'md', className }: Props) {
  return (
    <div
      className={cn(
        'border-2 border-surface-border border-t-brand-500 rounded-full animate-spin',
        sizes[size],
        className
      )}
    />
  );
}
