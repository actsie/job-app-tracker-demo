'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { OperationLogEntry } from '@/lib/types';
import { 
  RotateCcw, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Upload,
  Trash2,
  Archive
} from 'lucide-react';

export function UndoOperations() {
  const [undoableOps, setUndoableOps] = useState<OperationLogEntry[]>([]);
  const [recentOps, setRecentOps] = useState<OperationLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUndoing, setIsUndoing] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<OperationLogEntry | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    setIsLoading(true);
    try {
      const [undoableResponse, recentResponse] = await Promise.all([
        fetch('/api/operations/undoable'),
        fetch('/api/operations/recent')
      ]);

      if (undoableResponse.ok) {
        const undoableData = await undoableResponse.json();
        setUndoableOps(undoableData.operations || []);
      }

      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentOps(recentData.operations || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load operation history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async (operation: OperationLogEntry) => {
    setIsUndoing(operation.id);
    try {
      const response = await fetch('/api/operations/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operationId: operation.id }),
      });

      if (response.ok) {
        toast({
          title: "Operation Undone",
          description: `Successfully undone ${operation.operation_type} operation`,
        });
        loadOperations(); // Reload to update the lists
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to undo operation');
      }
    } catch (error) {
      toast({
        title: "Undo Failed",
        description: error instanceof Error ? error.message : "Failed to undo operation",
        variant: "destructive",
      });
    } finally {
      setIsUndoing(null);
      setShowConfirmDialog(null);
    }
  };

  const getOperationIcon = (type: OperationLogEntry['operation_type']) => {
    switch (type) {
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'bulk_import':
        return <FileText className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      case 'rollback':
        return <RotateCcw className="h-4 w-4" />;
      case 'restore':
        return <Archive className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getOperationDescription = (operation: OperationLogEntry): string => {
    switch (operation.operation_type) {
      case 'upload':
        return `Uploaded resume${operation.details.manifest_entries?.length ? ` (${operation.details.manifest_entries.length} files)` : ''}`;
      case 'bulk_import':
        return `Bulk imported ${operation.details.manifest_entries?.length || 0} resumes`;
      case 'delete':
        return `Deleted ${operation.details.manifest_entries?.length || 0} resume entries`;
      case 'rollback':
        return `Rolled back to previous version`;
      case 'restore':
        return `Restored from backup`;
      default:
        return `${operation.operation_type} operation`;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Operation History
          </CardTitle>
          <CardDescription>Loading operation history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Undoable Operations */}
      {undoableOps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Undoable Operations
            </CardTitle>
            <CardDescription>
              Operations from this session that can be undone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {undoableOps.map((operation) => (
                <Card key={operation.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getOperationIcon(operation.operation_type)}
                        <div>
                          <p className="font-medium">{getOperationDescription(operation)}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(operation.timestamp)}
                          </p>
                          {operation.details.user_action && (
                            <p className="text-xs text-gray-400 mt-1">
                              {operation.details.user_action}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowConfirmDialog(operation)}
                        disabled={isUndoing === operation.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {isUndoing === operation.id ? 'Undoing...' : 'Undo'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Operations
          </CardTitle>
          <CardDescription>
            History of recent operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentOps.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No operations yet</h3>
              <p className="text-gray-500">
                Operations will appear here as you use the application
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOps.map((operation) => (
                <Card key={operation.id} className={`border-l-4 ${
                  operation.can_undo ? 'border-l-blue-500' : 'border-l-gray-300'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getOperationIcon(operation.operation_type)}
                        <div>
                          <p className="font-medium">{getOperationDescription(operation)}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(operation.timestamp)}
                          </p>
                          {operation.details.user_action && (
                            <p className="text-xs text-gray-400 mt-1">
                              {operation.details.user_action}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {operation.can_undo ? (
                          <div className="flex items-center gap-1 text-blue-600 text-sm">
                            <CheckCircle className="h-3 w-3" />
                            Can Undo
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-gray-500 text-sm">
                            <AlertCircle className="h-3 w-3" />
                            Completed
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <Dialog open={!!showConfirmDialog} onOpenChange={() => setShowConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Undo Operation</DialogTitle>
              <DialogDescription>
                Are you sure you want to undo this operation? This will reverse the changes made.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">
                      {getOperationDescription(showConfirmDialog)}
                    </p>
                    <p className="text-sm text-yellow-700">
                      Performed {formatDate(showConfirmDialog.timestamp)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-600">
                <p className="font-medium">This will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {showConfirmDialog.operation_type === 'upload' && (
                    <>
                      <li>Remove the uploaded resume from managed folder</li>
                      <li>Remove the resume entry from manifest</li>
                    </>
                  )}
                  {showConfirmDialog.operation_type === 'bulk_import' && (
                    <>
                      <li>Remove all imported resume files</li>
                      <li>Remove all created manifest entries</li>
                    </>
                  )}
                  {showConfirmDialog.operation_type === 'delete' && (
                    <li>This operation cannot be undone (delete is permanent)</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleUndo(showConfirmDialog)}
                disabled={isUndoing === showConfirmDialog.id}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {isUndoing === showConfirmDialog.id ? 'Undoing...' : 'Undo Operation'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}