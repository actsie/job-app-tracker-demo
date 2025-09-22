'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Calendar, Globe } from 'lucide-react';
import { JobDescription } from '@/lib/types';
import { QuickAddModal } from './quick-add-modal';

interface RecentCapturesProps {
  refreshTrigger?: number;
  onApplicationAdded?: (application: JobDescription) => void;
}

export function RecentCaptures({ refreshTrigger, onApplicationAdded }: RecentCapturesProps) {
  const [captures, setCaptures] = useState<JobDescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [selectedCapture, setSelectedCapture] = useState<JobDescription | null>(null);

  const fetchRecentCaptures = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/recent-captures');
      if (!response.ok) {
        throw new Error(`Failed to fetch captures: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCaptures(data.captures || []);
    } catch (error) {
      console.error('Error fetching recent captures:', error);
      setError(error instanceof Error ? error.message : 'Failed to load captures');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentCaptures();
  }, [refreshTrigger]);

  const getCaptureMethodBadge = (captureMethod?: string) => {
    switch (captureMethod) {
      case 'browser_helper':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Browser Helper</Badge>;
      case 'url_fetch':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">URL Fetch</Badge>;
      case 'manual':
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Manual</Badge>;
    }
  };

  const handleOpenCapture = (capture: JobDescription) => {
    setSelectedCapture(capture);
    setQuickAddModalOpen(true);
  };

  const handleApplicationAdded = (application: JobDescription) => {
    onApplicationAdded?.(application);
    // Optionally refresh captures to show updated status
    fetchRecentCaptures();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateText = (text: string | null | undefined, maxLength: number = 150) => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Captures
          </CardTitle>
          <CardDescription>Your recently saved job descriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading captures...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Captures
          </CardTitle>
          <CardDescription>Your recently saved job descriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">Error: {error}</div>
            <Button onClick={fetchRecentCaptures} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Captures
        </CardTitle>
        <CardDescription>
          Your recently saved job descriptions ({captures.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {captures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No captures yet. Start by capturing a job description!
          </div>
        ) : (
          <div className="space-y-4">
            {captures.map((capture) => (
              <div key={capture.uuid} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">
                        {capture.role || 'Unknown Role'}
                      </h4>
                      {getCaptureMethodBadge(capture.capture_method)}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      {capture.company || 'Unknown Company'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOpenCapture(capture)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Open
                    </Button>
                    {capture.source_url && (
                      <Button
                        onClick={() => window.open(capture.source_url!, '_blank')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 mb-2">
                  {truncateText(capture.jd_text)}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(capture.captured_at || capture.fetched_at_iso)}
                    </div>
                    {capture.source_url && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <span className="max-w-[200px] truncate">
                          {new URL(capture.source_url).hostname}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {capture.uuid.substring(0, 8)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {selectedCapture && (
        <QuickAddModal
          isOpen={quickAddModalOpen}
          onClose={() => {
            setQuickAddModalOpen(false);
            setSelectedCapture(null);
          }}
          capture={selectedCapture}
          onApplicationAdded={handleApplicationAdded}
        />
      )}
    </Card>
  );
}