'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Database, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { config } from '@/lib/config';

/**
 * Use Demo Data component
 * Populates the app with deterministic sample data in demo mode
 */
export default function UseDemoData() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { toast } = useToast();

  // Only show in demo mode
  if (!config.demo.client) return null;

  const handleUseDemoData = async () => {
    setIsLoading(true);
    
    try {
      // Call the demo seed API
      const response = await fetch('/api/demo-seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load demo data');
      }

      const result = await response.json();
      
      // Log demo usage event
      console.log('Demo data loaded:', result);
      
      setHasLoaded(true);
      
      toast({
        title: "Demo Data Loaded",
        description: `Added ${result.preview?.length || 8} sample job applications. Data is for demo only and won't persist.`,
      });
      
      // Trigger a page refresh to show the data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Demo data loading error:', error);
      toast({
        title: "Error Loading Demo Data",
        description: "Failed to populate demo applications. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    // Clear any stored demo state
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demo-session');
      window.location.reload();
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg text-blue-900">Demo Data</CardTitle>
        </div>
        <CardDescription className="text-blue-700">
          Populate the app with sample job applications for testing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleUseDemoData}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Demo Data...
              </>
            ) : hasLoaded ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Demo Data Loaded
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Use Demo Data
              </>
            )}
          </Button>
          
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset Demo
          </Button>
        </div>
        
        <p className="text-xs text-blue-600 mt-3">
          Creates 8 sample applications with realistic company names and roles. 
          Data resets on page refresh and isn't saved permanently.
        </p>
      </CardContent>
    </Card>
  );
}