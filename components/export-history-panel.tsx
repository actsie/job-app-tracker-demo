'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  History, 
  Download, 
  ExternalLink, 
  RotateCcw, 
  Trash2, 
  FolderOpen,
  Calendar,
  FileText,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { 
  ExportHistoryEntry,
  getExportHistory,
  removeExportFromHistory,
  clearExportHistory,
  saveCSVToFile,
  generateCSV,
  downloadCSV
} from '@/lib/csv-export';

interface ExportHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportHistoryPanel({ isOpen, onClose }: ExportHistoryPanelProps) {
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ExportHistoryEntry | null>(null);
  const { toast } = useToast();

  // Load history when modal opens
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = () => {
    setLoading(true);
    try {
      const entries = getExportHistory();
      setHistory(entries);
    } catch (error) {
      console.error('Failed to load export history:', error);
      toast({
        title: "Error loading history",
        description: "Failed to load export history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (entry: ExportHistoryEntry) => {
    setProcessingId(entry.id);
    try {
      // For files saved to filesystem, try to open with system default app
      if (entry.config.saveToFile) {
        const response = await fetch('/api/file-actions/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: entry.filePath })
        });

        if (response.ok) {
          toast({
            title: "File opened",
            description: `Opened ${entry.filename} with default application`,
          });
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to open file');
        }
      } else {
        // For browser downloads, offer to re-download
        const csvContent = generateCSV(entry.originalJobs, entry.config);
        downloadCSV(csvContent, entry.filename);
        toast({
          title: "File downloaded",
          description: `Re-downloaded ${entry.filename}`,
        });
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      toast({
        title: "Error opening file",
        description: error instanceof Error ? error.message : 'Failed to open file',
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevealInFolder = async (entry: ExportHistoryEntry) => {
    setProcessingId(entry.id);
    try {
      if (entry.config.saveToFile) {
        const response = await fetch('/api/file-actions/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: entry.filePath })
        });

        if (response.ok) {
          toast({
            title: "Folder opened",
            description: `Revealed ${entry.filename} in folder`,
          });
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to reveal file in folder');
        }
      } else {
        toast({
          title: "File not saved",
          description: "This export was downloaded directly and not saved to filesystem",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to reveal file in folder:', error);
      toast({
        title: "Error revealing file",
        description: error instanceof Error ? error.message : 'Failed to reveal file in folder',
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReRun = async (entry: ExportHistoryEntry) => {
    setProcessingId(entry.id);
    try {
      // Generate new timestamp for filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const newFilename = entry.filename.replace(/\d{4}-\d{2}-\d{2}/, timestamp);
      
      if (entry.config.saveToFile) {
        const result = await saveCSVToFile(entry.originalJobs, entry.config, newFilename);
        toast({
          title: "Export re-run successful",
          description: `${result.recordCount} jobs exported to ${result.filePath}`,
        });
      } else {
        const csvContent = generateCSV(entry.originalJobs, entry.config);
        downloadCSV(csvContent, newFilename);
        toast({
          title: "Export re-run successful",
          description: `${entry.originalJobs.length} jobs exported to ${newFilename}`,
        });
      }
    } catch (error) {
      console.error('Failed to re-run export:', error);
      toast({
        title: "Re-run failed",
        description: error instanceof Error ? error.message : 'Failed to re-run export',
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteEntry = (entry: ExportHistoryEntry) => {
    setEntryToDelete(entry);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      // Remove from history
      removeExportFromHistory(entryToDelete.id);
      
      // Try to delete the actual file if it was saved to filesystem
      if (entryToDelete.config.saveToFile) {
        try {
          const response = await fetch('/api/file-actions/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: entryToDelete.filePath })
          });

          if (!response.ok) {
            const error = await response.json();
            // Don't fail the history deletion if file deletion fails
            toast({
              title: "History entry removed",
              description: `Entry removed from history, but file deletion failed: ${error.message}`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Export deleted",
              description: `${entryToDelete.filename} and its history entry have been deleted`,
            });
          }
        } catch (fileError) {
          // File deletion failed, but history entry was removed
          toast({
            title: "History entry removed", 
            description: "Entry removed from history, but file may still exist on disk",
          });
        }
      } else {
        toast({
          title: "History entry removed",
          description: `${entryToDelete.filename} removed from history`,
        });
      }

      // Refresh history
      loadHistory();
    } catch (error) {
      console.error('Failed to delete export:', error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : 'Failed to delete export',
        variant: "destructive",
      });
    }

    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  const handleClearHistory = async () => {
    try {
      clearExportHistory();
      setHistory([]);
      toast({
        title: "History cleared",
        description: "All export history entries have been removed",
      });
    } catch (error) {
      console.error('Failed to clear history:', error);
      toast({
        title: "Clear failed",
        description: error instanceof Error ? error.message : 'Failed to clear history',
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'all': return 'bg-blue-100 text-blue-800';
      case 'selected': return 'bg-green-100 text-green-800';
      case 'filtered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Export History
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Export History ({history.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No export history found</p>
                <p className="text-sm">Your CSV exports will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((entry) => (
                  <Card key={entry.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {entry.filename}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatTimestamp(entry.timestamp)}
                            </div>
                            <Badge className={getScopeColor(entry.scope)}>
                              {entry.scope}
                            </Badge>
                            <span>{entry.rowCount} rows</span>
                            <span>{entry.includedFields.length} fields</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFile(entry)}
                            disabled={processingId === entry.id}
                            title="Open file"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {entry.config.saveToFile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevealInFolder(entry)}
                              disabled={processingId === entry.id}
                              title="Reveal in folder"
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReRun(entry)}
                            disabled={processingId === entry.id}
                            title="Re-run export"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry)}
                            disabled={processingId === entry.id}
                            className="text-red-600 hover:text-red-700"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-sm text-gray-600">
                        <div><strong>Scope:</strong> {entry.scopeDescription}</div>
                        <div><strong>Fields:</strong> {entry.includedFields.join(', ')}</div>
                        <div><strong>File:</strong> {entry.filePath}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {history.length > 0 && (
              <Button
                variant="outline"
                onClick={handleClearHistory}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Export
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p>Are you sure you want to delete this export from history?</p>
            
            {entryToDelete && (
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="font-medium">{entryToDelete.filename}</div>
                <div className="text-sm text-gray-600">
                  Exported: {formatTimestamp(entryToDelete.timestamp)}
                </div>
                <div className="text-sm text-gray-600">
                  {entryToDelete.scopeDescription}, {entryToDelete.rowCount} rows
                </div>
              </div>
            )}

            {entryToDelete?.config.saveToFile && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">File will also be deleted</span>
                </div>
                <div className="text-sm text-yellow-700 mt-1">
                  The CSV file will be permanently deleted from your filesystem.
                </div>
                <div className="text-sm text-yellow-700">
                  If the file is open in another application, deletion may fail.
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEntry}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}