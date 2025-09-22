'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DeduplicationResult, 
  DuplicateGroup, 
  DeduplicationConfig, 
  JobDescription 
} from '@/lib/types';
import { 
  RefreshCw, 
  Settings, 
  Merge, 
  Trash2, 
  Eye,
  GitMerge,
  AlertTriangle 
} from 'lucide-react';
import { DuplicateComparison } from './duplicate-comparison';
import { DeduplicationSettings } from './deduplication-settings';

interface DeduplicationManagerProps {}

export function DeduplicationManager({}: DeduplicationManagerProps) {
  const [deduplicationResult, setDeduplicationResult] = useState<DeduplicationResult | null>(null);
  const [config, setConfig] = useState<DeduplicationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
    runDeduplication();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/deduplication/config');
      if (response.ok) {
        const configData = await response.json();
        setConfig(configData);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const runDeduplication = async () => {
    setIsLoading(true);
    setProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/deduplication');
      
      if (!response.ok) {
        throw new Error(`Failed to run deduplication: ${response.statusText}`);
      }

      const result = await response.json();
      setDeduplicationResult(result);

      clearInterval(progressInterval);
      setProgress(100);

      if (result.total_duplicates_found > 0) {
        toast({
          title: "Duplicates Found",
          description: `Found ${result.total_duplicates_found} potential duplicates in ${result.duplicate_groups.length} groups`,
        });
      } else {
        toast({
          title: "No Duplicates",
          description: "No duplicate job descriptions found",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run deduplication",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleMergeJobs = async (primaryUuid: string, duplicateUuids: string[]) => {
    try {
      const response = await fetch('/api/deduplication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge',
          primaryUuid,
          duplicateUuids,
          userAction: 'manual_merge_via_ui'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to merge jobs: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Jobs Merged",
        description: `Successfully merged ${duplicateUuids.length} duplicate job(s)`,
      });

      // Refresh the deduplication results
      await runDeduplication();
      setSelectedGroup(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to merge jobs",
        variant: "destructive",
      });
    }
  };

  const handleDeleteJob = async (uuid: string) => {
    try {
      const response = await fetch('/api/deduplication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          uuid,
          userAction: 'manual_delete_via_ui'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete job: ${response.statusText}`);
      }

      toast({
        title: "Job Deleted",
        description: "Job description has been archived",
      });

      // Refresh the deduplication results
      await runDeduplication();
      setSelectedGroup(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete job",
        variant: "destructive",
      });
    }
  };

  const getSimilarityBadgeVariant = (score: number) => {
    if (score >= 0.95) return "destructive";
    if (score >= 0.85) return "default";
    return "secondary";
  };

  const formatSimilarityPercentage = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Deduplication Manager
            </div>
            <div className="flex gap-2">
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Deduplication Settings</DialogTitle>
                    <DialogDescription>
                      Configure how duplicate detection works
                    </DialogDescription>
                  </DialogHeader>
                  {config && (
                    <DeduplicationSettings 
                      config={config} 
                      onConfigUpdate={(newConfig) => {
                        setConfig(newConfig);
                        setShowSettings(false);
                        runDeduplication();
                      }}
                    />
                  )}
                </DialogContent>
              </Dialog>
              <Button onClick={runDeduplication} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Run Dedupe Now
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Automatically detect and resolve duplicate job descriptions to keep your database clean
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scanning for duplicates...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
          
          {!isLoading && deduplicationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {deduplicationResult.duplicate_groups.length}
                  </div>
                  <div className="text-sm text-gray-600">Duplicate Groups</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {deduplicationResult.total_duplicates_found}
                  </div>
                  <div className="text-sm text-gray-600">Total Duplicates</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatSimilarityPercentage(deduplicationResult.threshold_used)}
                  </div>
                  <div className="text-sm text-gray-600">Similarity Threshold</div>
                </div>
              </div>

              {deduplicationResult.duplicate_groups.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Duplicate Groups Found
                  </h3>
                  
                  {deduplicationResult.duplicate_groups.map((group) => (
                    <Card key={group.id} className="border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                Primary: {group.primary_job.company || 'Unknown'} - {group.primary_job.role || 'Unknown'}
                              </Badge>
                              <Badge 
                                variant={getSimilarityBadgeVariant(group.max_similarity)}
                                className="text-xs"
                              >
                                Max {formatSimilarityPercentage(group.max_similarity)} similar
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {group.primary_job.jd_text.substring(0, 150)}...
                            </p>
                            <div className="text-xs text-gray-500">
                              {group.duplicates.length} duplicate(s) found
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedGroup(group)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Review
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Review Duplicate Group</DialogTitle>
                                  <DialogDescription>
                                    Compare job descriptions and choose how to resolve duplicates
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedGroup && (
                                  <DuplicateComparison
                                    group={selectedGroup}
                                    onMerge={handleMergeJobs}
                                    onDelete={handleDeleteJob}
                                    onClose={() => setSelectedGroup(null)}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {deduplicationResult.duplicate_groups.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <GitMerge className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No duplicate job descriptions found.</p>
                  <p className="text-sm">Your database is already clean!</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}