'use client';

import { DeduplicationManager } from '@/components/deduplication-manager';
import { Toaster } from '@/components/ui/toaster';

export default function DeduplicationPage() {
  return (
    <main>
      <DeduplicationManager />
      <Toaster />
    </main>
  );
}