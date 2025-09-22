import { AlertTriangle } from 'lucide-react';

interface DemoNoticeProps {
  message: string;
}

/**
 * Demo notice for demo build
 * Always shows since this is the demo version with prominent warning icon
 */
export function DemoNotice({ message }: DemoNoticeProps) {
  return (
    <div className="mt-2 flex items-center justify-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
      <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
      <p className="text-xs text-yellow-800 font-medium text-center">
        {message}
      </p>
    </div>
  );
}