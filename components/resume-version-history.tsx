'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ResumeVersionEntry } from '@/lib/types';
import { 
  History, 
  RotateCcw, 
  Clock, 
  FileText, 
  CheckCircle, 
  Archive,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ResumeVersionHistoryProps {
  resumeId: string;
  resumeTitle?: string;
  onVersionChanged?: () => void;
}

export function ResumeVersionHistory({ 
  resumeId, 
  resumeTitle,
  onVersionChanged 
}: ResumeVersionHistoryProps) {
  const [versions, setVersions] = useState<ResumeVersionEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState<ResumeVersionEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState<ResumeVersionEntry | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadVersionHistory();
  }, [resumeId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/resume/versions?resumeId=${resumeId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load version history');
      }

      const result = await response.json();
      setVersions(result.versions);
      setActiveVersion(result.activeVersion);
    } catch (error) {
      console.error('Error loading version history:', error);
      toast({
        title: "Error",
        description: "Failed to load version history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (targetVersionId: string) => {
    try {
      setRollbackLoading(targetVersionId);
      
      const response = await fetch('/api/resume/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeId,
          targetVersionId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Rollback failed');
      }

      toast({
        title: "Rollback Successful",
        description: result.message,
      });

      // Reload version history
      await loadVersionHistory();
      onVersionChanged?.();

    } catch (error) {
      console.error('Error during rollback:', error);
      toast({
        title: "Rollback Failed",
        description: error instanceof Error ? error.message : "Failed to rollback resume",
        variant: "destructive",
      });
    } finally {
      setRollbackLoading(null);
      setShowRollbackDialog(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (path: string) => {
    // This would require file system access; for now, we'll show a placeholder
    return "Size: N/A";
  };

  const getVersionLabel = (version: ResumeVersionEntry) => {
    if (!version.version_suffix) {
      return "Original";
    }
    return version.version_suffix.replace('_', '').toUpperCase();
  };

  const getVersionBadgeVariant = (version: ResumeVersionEntry) => {
    if (version.is_active) return "default";
    if (version.original_filename.includes('ROLLBACK_TO_')) return "secondary";
    return "outline";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>Loading version history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
            {resumeTitle && <span className="text-sm font-normal text-gray-500">- {resumeTitle}</span>}
          </CardTitle>
          <CardDescription>
            Manage and rollback to previous versions of this resume
          </CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Archive className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No version history available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version.version_id}
                  className={`p-4 rounded-lg border ${
                    version.is_active 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getVersionBadgeVariant(version)}>
                          {getVersionLabel(version)}
                        </Badge>
                        {version.is_active && (
                          <Badge variant="secondary" className="text-green-700 bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {version.original_filename.includes('ROLLBACK_TO_') && (
                          <Badge variant="outline" className="text-blue-700 bg-blue-50">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Rollback
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">
                            {version.original_filename}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>{formatTimestamp(version.upload_timestamp)}</span>
                        </div>
                        
                        <div className="text-xs text-gray-400">
                          Checksum: {version.file_checksum.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!version.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRollbackDialog(version)}
                          disabled={rollbackLoading !== null}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">About Version History:</p>
                <ul className="space-y-1">
                  <li>• New uploads with the same company/role/date create new versions</li>
                  <li>• Rolling back creates a new version from the selected historical version</li>
                  <li>• Version suffixes: Original (no suffix), _v1, _v2, etc.</li>
                  <li>• Only one version can be active at a time</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rollback Confirmation Dialog */}
      <Dialog 
        open={showRollbackDialog !== null} 
        onOpenChange={(open) => !open && setShowRollbackDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              Are you sure you want to rollback to this version? This will create a new active 
              version based on the selected historical version.
            </DialogDescription>
          </DialogHeader>
          
          {showRollbackDialog && (
            <div className="py-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">
                    {getVersionLabel(showRollbackDialog)}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">File:</span> {showRollbackDialog.original_filename}</p>
                  <p><span className="font-medium">Uploaded:</span> {formatTimestamp(showRollbackDialog.upload_timestamp)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRollbackDialog(null)}
              disabled={rollbackLoading !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => showRollbackDialog && handleRollback(showRollbackDialog.version_id)}
              disabled={rollbackLoading !== null}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {rollbackLoading ? 'Rolling back...' : 'Confirm Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}