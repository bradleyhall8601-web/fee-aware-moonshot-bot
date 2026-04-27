import { type LucideIcon } from 'lucide-react';

interface Props {
  icon:    LucideIcon;
  title:   string;
  message: string;
}

export default function EmptyState({ icon: Icon, title, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-surface-card border border-surface-border mb-4">
        <Icon className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-300 mb-1">{title}</h3>
      <p className="text-xs text-gray-600 max-w-xs">{message}</p>
    </div>
  );
}
