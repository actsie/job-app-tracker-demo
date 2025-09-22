'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export function BulkImport() {
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Bulk Import Deprecated
        </CardTitle>
        <CardDescription className="text-orange-700">
          The complex bulk import with auto-mapping has been replaced by a simpler system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-orange-800">
          <p className="mb-3">
            <strong>New Approach:</strong> Use the <strong>Unassigned</strong> tab instead for a better experience:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Drop multiple files or entire folders</li>
            <li>Files land in a simple holding area</li>
            <li>Quick attach to jobs in ≤2 clicks</li>
            <li>No fragile auto-matching - you control the mapping</li>
            <li>Reliable preview everywhere</li>
          </ul>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full border-orange-300 text-orange-800 hover:bg-orange-100"
          onClick={() => {
            // Navigate to unassigned tab if this is within resume manager
            const event = new CustomEvent('switchToUnassigned');
            window.dispatchEvent(event);
          }}
        >
          Switch to Unassigned Tab
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}