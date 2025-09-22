'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Archive,
  Undo
} from 'lucide-react';
// Define types locally to avoid importing server-side code
interface BulkOperation {
  id: string;
  type: 'copy_to_reference' | 'reference_to_copy' | 'move_root' | 'reorganize';
  targetJobs: string[];
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  log: any[];
}

interface BulkOperationsPanelProps {
  selectedJobIds: string[];
  onOperationComplete?: () => void;
}

export function BulkOperationsPanel({ selectedJobIds, onOperationComplete }: BulkOperationsPanelProps) {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadRecentOperations();
  }, []);

  const loadRecentOperations = async () => {
    try {
      const response = await fetch('/api/file-management/bulk/operations');
      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations);
      }
    } catch (error) {
      console.error('Failed to load operations:', error);
    }
  };

  const handleCopyToReference = async () => {
    if (selectedJobIds.length === 0) {
      toast({
        title: "No jobs selected",
        description: "Please select jobs to convert",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/file-management/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobIds: selectedJobIds,
          createBackup
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Operation completed",
          description: data.message
        });
        
        await loadRecentOperations();
        onOperationComplete?.();
      } else {
        const error = await response.json();
        toast({
          title: "Operation failed",
          description: error.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute bulk operation",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReferenceToCopy = async () => {
    if (selectedJobIds.length === 0) {
      toast({
        title: "No jobs selected",
        description: "Please select jobs to convert",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/file-management/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobIds: selectedJobIds,
          createBackup
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Operation completed",
          description: data.message
        });
        
        await loadRecentOperations();
        onOperationComplete?.();
      } else {
        const error = await response.json();
        toast({
          title: "Operation failed",
          description: error.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute bulk operation",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getOperationIcon = (type: BulkOperation['type']) => {
    switch (type) {
      case 'copy_to_reference':
        return <ExternalLink className="h-4 w-4" />;
      case 'reference_to_copy':
        return <Copy className="h-4 w-4" />;
      case 'move_root':
        return <Archive className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getOperationDescription = (type: BulkOperation['type']) => {
    switch (type) {
      case 'copy_to_reference':
        return 'Convert copied files to references';
      case 'reference_to_copy':
        return 'Convert references to copied files';
      case 'move_root':
        return 'Move to new root directory';
      default:
        return 'Unknown operation';
    }
  };

  const getStatusIcon = (status: BulkOperation['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Bulk Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk File Operations</CardTitle>
          <CardDescription>
            Convert file handling modes for multiple jobs at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedJobIds.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>{selectedJobIds.length}</strong> jobs selected for bulk operations
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Create Backup Before Operations</Label>
              <p className="text-sm text-gray-600">
                Create a backup copy before making changes
              </p>
            </div>
            <Switch
              checked={createBackup}
              onCheckedChange={setCreateBackup}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleCopyToReference}
              disabled={isLoading || selectedJobIds.length === 0}
              variant="outline"
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Copy → Reference
            </Button>

            <Button
              onClick={handleReferenceToCopy}
              disabled={isLoading || selectedJobIds.length === 0}
              variant="outline"
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              Reference → Copy
            </Button>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Copy → Reference:</strong> Remove local file copies and store paths to originals</p>
            <p><strong>Reference → Copy:</strong> Copy referenced files into job folders</p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Operations</CardTitle>
          <CardDescription>
            Track the status and results of bulk operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bulk operations performed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {operations.map((operation) => (
                <div key={operation.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getOperationIcon(operation.type)}
                      <span className="font-medium">
                        {getOperationDescription(operation.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(operation.status)}
                      <Badge variant={
                        operation.status === 'completed' ? 'default' :
                        operation.status === 'failed' ? 'destructive' :
                        operation.status === 'running' ? 'secondary' :
                        'outline'
                      }>
                        {operation.status}
                      </Badge>
                    </div>
                  </div>

                  {operation.progress && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{operation.progress.completed}/{operation.progress.total}</span>
                      </div>
                      <Progress 
                        value={(operation.progress.completed / operation.progress.total) * 100}
                        className="h-2"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        {operation.progress?.completed || 0}
                      </div>
                      <div className="text-gray-600">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {operation.progress?.failed || 0}
                      </div>
                      <div className="text-gray-600">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-600">
                        {operation.progress?.total || operation.targetJobs.length}
                      </div>
                      <div className="text-gray-600">Total</div>
                    </div>
                  </div>

                  {operation.log.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      Started: {formatTimestamp(operation.log[0].timestamp)}
                    </div>
                  )}

                  {/* Undo capability indicator */}
                  {operation.status === 'completed' && operation.log.some(entry => entry.canUndo) && (
                    <div className="mt-3 pt-3 border-t">
                      <Button size="sm" variant="ghost" className="text-xs">
                        <Undo className="h-3 w-3 mr-1" />
                        Undo Available
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BulkOperationsPanel;