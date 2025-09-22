'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  FolderOpen, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Download,
  Edit,
  Eye,
  FileText
} from 'lucide-react';
// Define types locally to avoid importing server-side code
interface ConflictInfo {
  type: 'folder_exists' | 'file_exists' | 'invalid_path';
  conflictPath: string;
  resolution?: 'rename' | 'overwrite' | 'skip';
  suggestedName?: string;
}

interface ImportableJob {
  id: string;
  originalPath: string;
  fileName: string;
  detectedJob?: any;
  proposedFolder: string;
  status: 'detected' | 'mapped' | 'conflict' | 'ready' | 'imported' | 'failed';
  conflicts?: ConflictInfo[];
  errorMessage?: string;
}

interface MigrationLogEntry {
  id: string;
  timestamp: string;
  action: 'import' | 'copy' | 'reference' | 'rename' | 'skip' | 'error';
  sourcePath: string;
  targetPath?: string;
  jobId?: string;
  error?: string;
  canUndo: boolean;
  undoData?: any;
}

interface MigrationResult {
  operationId: string;
  timestamp: string;
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  log: MigrationLogEntry[];
  backupFolder?: string;
}

interface ImportMigrationWizardProps {
  onImportComplete?: (result: MigrationResult) => void;
}

type WizardStep = 'select-source' | 'scan-results' | 'resolve-conflicts' | 'configure-import' | 'import-progress' | 'import-complete';

export function ImportMigrationWizard({ onImportComplete }: ImportMigrationWizardProps) {
  const [step, setStep] = useState<WizardStep>('select-source');
  const [sourcePath, setSourcePath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [importableJobs, setImportableJobs] = useState<ImportableJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [importOptions, setImportOptions] = useState({
    handleConflicts: false,
    createBackup: true,
    copyFiles: true,
    skipFiles: false
  });
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [editingJob, setEditingJob] = useState<ImportableJob | null>(null);
  const { toast } = useToast();

  const handleSelectSource = async () => {
    if (!sourcePath.trim()) {
      toast({
        title: "Path required",
        description: "Please enter a source directory path",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    try {
      const response = await fetch('/api/file-management/import/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: sourcePath.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setImportableJobs(data.jobs);
        setSelectedJobs(new Set(data.jobs.filter((job: ImportableJob) => job.status === 'ready').map((job: ImportableJob) => job.id)));
        setStep('scan-results');
        
        toast({
          title: "Scan completed",
          description: data.message
        });
      } else {
        const error = await response.json();
        toast({
          title: "Scan failed",
          description: error.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan directory",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleJobSelection = (jobId: string, selected: boolean) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(jobId);
      } else {
        newSet.delete(jobId);
      }
      return newSet;
    });
  };

  const handleEditJob = async (job: ImportableJob, updates: { company?: string; role?: string; date?: string }) => {
    try {
      const response = await fetch('/api/file-management/import/execute', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          updates
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the job in our local state
        setImportableJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { 
                ...j, 
                detectedJob: { 
                  ...j.detectedJob, 
                  ...updates 
                },
                proposedFolder: data.preview.computedPath,
                status: 'ready'
              }
            : j
        ));

        setEditingJob(null);
        toast({
          title: "Job updated",
          description: "Job mapping has been updated successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job mapping",
        variant: "destructive"
      });
    }
  };

  const handleExecuteImport = async () => {
    const selectedJobsList = importableJobs.filter(job => selectedJobs.has(job.id));
    
    if (selectedJobsList.length === 0) {
      toast({
        title: "No jobs selected",
        description: "Please select at least one job to import",
        variant: "destructive"
      });
      return;
    }

    setStep('import-progress');
    
    try {
      const response = await fetch('/api/file-management/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: selectedJobsList,
          options: importOptions
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMigrationResult(data.result);
        setStep('import-complete');
        onImportComplete?.(data.result);
        
        toast({
          title: "Import completed",
          description: data.message
        });
      } else {
        const error = await response.json();
        toast({
          title: "Import failed",
          description: error.error,
          variant: "destructive"
        });
        setStep('configure-import');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute import",
        variant: "destructive"
      });
      setStep('configure-import');
    }
  };

  const resetWizard = () => {
    setStep('select-source');
    setSourcePath('');
    setImportableJobs([]);
    setSelectedJobs(new Set());
    setMigrationResult(null);
    setEditingJob(null);
  };

  const renderStepContent = () => {
    switch (step) {
      case 'select-source':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-path">Source Directory</Label>
              <div className="flex gap-2">
                <Input
                  id="source-path"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  placeholder="/Users/username/Documents/OldJobApplications"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const path = prompt('Enter the source directory path:');
                    if (path) setSourcePath(path);
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Browse
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Select the directory containing your existing job files to import.
              </p>
            </div>
            
            <Button 
              onClick={handleSelectSource} 
              disabled={isScanning || !sourcePath.trim()}
              className="w-full"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Scan Directory
                </>
              )}
            </Button>
          </div>
        );

      case 'scan-results':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Scan Results</h3>
                <p className="text-sm text-gray-600">
                  Found {importableJobs.length} importable job files
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedJobs(new Set(importableJobs.map(job => job.id)))}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedJobs(new Set())}
                >
                  Clear All
                </Button>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {importableJobs.map((job) => (
                <div key={job.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedJobs.has(job.id)}
                    onChange={(e) => handleJobSelection(job.id, e.target.checked)}
                    className="rounded"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {job.detectedJob?.company || 'Unknown'} - {job.detectedJob?.role || 'Unknown'}
                      </span>
                      <Badge variant={
                        job.status === 'ready' ? 'default' :
                        job.status === 'conflict' ? 'destructive' :
                        'secondary'
                      }>
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{job.originalPath}</p>
                    {job.conflicts && job.conflicts.length > 0 && (
                      <div className="mt-1 text-xs text-orange-600">
                        {job.conflicts.length} conflict(s) detected
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingJob(job)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Job Preview</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          <div><strong>File:</strong> {job.fileName}</div>
                          <div><strong>Company:</strong> {job.detectedJob?.company || 'Unknown'}</div>
                          <div><strong>Role:</strong> {job.detectedJob?.role || 'Unknown'}</div>
                          <div><strong>Target Path:</strong> {job.proposedFolder}</div>
                          {job.detectedJob?.jd_text && (
                            <div>
                              <strong>Content Preview:</strong>
                              <div className="mt-1 p-2 bg-gray-50 rounded text-sm max-h-32 overflow-y-auto">
                                {job.detectedJob.jd_text.substring(0, 500)}...
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={resetWizard}>
                Back
              </Button>
              <Button 
                onClick={() => setStep('configure-import')}
                disabled={selectedJobs.size === 0}
              >
                Continue ({selectedJobs.size} selected)
              </Button>
            </div>
          </div>
        );

      case 'configure-import':
        const hasConflicts = importableJobs.some(job => selectedJobs.has(job.id) && job.status === 'conflict');
        
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Import Configuration</h3>
              <p className="text-sm text-gray-600">
                Configure how the import should handle files and conflicts
              </p>
            </div>
            
            {hasConflicts && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-4 w-4" />
                  <strong>Conflicts detected</strong>
                </div>
                <p className="mt-1 text-sm text-orange-700">
                  Some selected jobs have conflicts that need to be resolved.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Copy Files</Label>
                  <p className="text-sm text-gray-600">Copy attachments into job folders</p>
                </div>
                <Switch
                  checked={importOptions.copyFiles}
                  onCheckedChange={(checked) => setImportOptions(prev => ({ ...prev, copyFiles: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Create Backup</Label>
                  <p className="text-sm text-gray-600">Create backup before import</p>
                </div>
                <Switch
                  checked={importOptions.createBackup}
                  onCheckedChange={(checked) => setImportOptions(prev => ({ ...prev, createBackup: checked }))}
                />
              </div>
              
              {hasConflicts && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Handle Conflicts</Label>
                      <p className="text-sm text-gray-600">Automatically resolve conflicts by renaming</p>
                    </div>
                    <Switch
                      checked={importOptions.handleConflicts}
                      onCheckedChange={(checked) => setImportOptions(prev => ({ ...prev, handleConflicts: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Skip Conflicted Files</Label>
                      <p className="text-sm text-gray-600">Skip files with conflicts instead of importing</p>
                    </div>
                    <Switch
                      checked={importOptions.skipFiles}
                      onCheckedChange={(checked) => setImportOptions(prev => ({ ...prev, skipFiles: checked }))}
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('scan-results')}>
                Back
              </Button>
              <Button onClick={handleExecuteImport}>
                Start Import
              </Button>
            </div>
          </div>
        );

      case 'import-progress':
        return (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <RefreshCw className="h-12 w-12 animate-spin text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Importing Jobs...</h3>
              <p className="text-sm text-gray-600">
                Please wait while we import your selected job files.
              </p>
            </div>
          </div>
        );

      case 'import-complete':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Import Completed</h3>
            </div>
            
            {migrationResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{migrationResult.successful}</div>
                    <div className="text-sm text-gray-600">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{migrationResult.failed}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{migrationResult.skipped}</div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                </div>
                
                {migrationResult.backupFolder && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm">
                      <strong>Backup created:</strong> {migrationResult.backupFolder}
                    </div>
                  </div>
                )}
                
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Import Log
                </Button>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetWizard} className="flex-1">
                Import More Files
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                View Imported Jobs
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import & Migration Wizard</CardTitle>
          <CardDescription>
            Import existing job files into your structured folder system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Job Editing Dialog */}
      {editingJob && (
        <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Job Mapping</DialogTitle>
              <DialogDescription>
                Update the job information to improve folder organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={editingJob.detectedJob?.company || ''}
                  onChange={(e) => setEditingJob(prev => prev ? {
                    ...prev,
                    detectedJob: { ...prev.detectedJob, company: e.target.value }
                  } : null)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={editingJob.detectedJob?.role || ''}
                  onChange={(e) => setEditingJob(prev => prev ? {
                    ...prev,
                    detectedJob: { ...prev.detectedJob, role: e.target.value }
                  } : null)}
                  placeholder="Job role"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editingJob.detectedJob?.applied_date || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEditingJob(prev => prev ? {
                    ...prev,
                    detectedJob: { ...prev.detectedJob, applied_date: e.target.value }
                  } : null)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingJob(null)}>
                  Cancel
                </Button>
                <Button onClick={() => editingJob && handleEditJob(editingJob, {
                  company: editingJob.detectedJob?.company,
                  role: editingJob.detectedJob?.role,
                  date: editingJob.detectedJob?.applied_date
                })}>
                  Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ImportMigrationWizard;