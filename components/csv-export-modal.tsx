'use client';

import React, { useState, useEffect } from 'react';
import { JobDescription } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  ExportConfig, 
  ExportOptions,
  getJobsToExport, 
  generateCSV, 
  downloadCSV,
  saveCSVToFile,
  getExportSummary,
  getExportFields,
  saveExportToHistory,
  getScopeDescription as getFullScopeDescription
} from '@/lib/csv-export';

interface CSVExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobDescription[];
  selectedIds?: string[];
  filteredJobs?: JobDescription[];
  defaultScope?: 'all' | 'selected' | 'filtered';
}

const STORAGE_KEY = 'csv_export_preferences';

export function CSVExportModal({ 
  isOpen, 
  onClose, 
  jobs, 
  selectedIds = [], 
  filteredJobs = [], 
  defaultScope = 'all' 
}: CSVExportModalProps) {
  const [config, setConfig] = useState<ExportConfig>({
    scope: defaultScope,
    includeExtendedFields: false,
    saveToFile: true
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { toast } = useToast();

  // Load preferences from sessionStorage on component mount
  useEffect(() => {
    const savedPrefs = sessionStorage.getItem(STORAGE_KEY);
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch {
        // Ignore parsing errors, use defaults
      }
    }
  }, []);

  // Save preferences to sessionStorage whenever config changes
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Reset export status when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setExportStatus('idle');
      setExportProgress(0);
      setErrorMessage('');
      setIsExporting(false);
    }
  }, [isOpen]);

  // Update scope if we have selectedIds but scope is not 'selected'
  useEffect(() => {
    if (selectedIds.length > 0 && config.scope !== 'selected' && defaultScope === 'selected') {
      setConfig(prev => ({ ...prev, scope: 'selected' }));
    }
  }, [selectedIds.length, defaultScope]);

  const handleScopeChange = (scope: ExportConfig['scope']) => {
    setConfig(prev => ({ ...prev, scope }));
  };

  const handleToggleExtendedFields = (checked: boolean) => {
    setConfig(prev => ({ ...prev, includeExtendedFields: checked }));
  };

  const handleToggleSaveToFile = (checked: boolean) => {
    setConfig(prev => ({ ...prev, saveToFile: checked }));
  };

  const canExport = () => {
    if (config.scope === 'selected' && selectedIds.length === 0) {
      return false;
    }
    if (config.scope === 'filtered' && filteredJobs.length === 0) {
      return false;
    }
    return jobs.length > 0;
  };

  const getPreviewJobsCount = () => {
    try {
      const jobsToExport = getJobsToExport({ jobs, selectedIds, filteredJobs, config });
      return jobsToExport.length;
    } catch {
      return 0;
    }
  };

  const handleExport = async () => {
    if (!canExport()) {
      setErrorMessage('Unable to export: no jobs available for the selected scope');
      setExportStatus('error');
      return;
    }

    setIsExporting(true);
    setExportStatus('processing');
    setExportProgress(0);
    setErrorMessage('');

    try {
      // Simulate progress for better UX
      const progressSteps = [
        { message: 'Preparing export...', progress: 20 },
        { message: 'Collecting job data...', progress: 40 },
        { message: 'Formatting CSV...', progress: 70 },
        { message: 'Generating file...', progress: 90 },
      ];

      for (const step of progressSteps) {
        setExportProgress(step.progress);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const exportOptions: ExportOptions = {
        jobs,
        selectedIds,
        filteredJobs,
        config
      };

      const jobsToExport = getJobsToExport(exportOptions);
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const scopeLabel = config.scope === 'all' ? 'all' : 
                        config.scope === 'selected' ? 'selected' : 'filtered';
      const filename = `job_applications_${scopeLabel}_${timestamp}.csv`;
      
      let filePath: string | null = null;
      let recordCount: number = jobsToExport.length;
      
      if (config.saveToFile) {
        const result = await saveCSVToFile(jobsToExport, config, filename);
        filePath = result.filePath;
        recordCount = result.recordCount;
      } else {
        const csvContent = generateCSV(jobsToExport, config);
        downloadCSV(csvContent, filename);
      }
      
      setExportProgress(100);
      setExportStatus('success');

      // Save to export history
      try {
        const historyEntry = saveExportToHistory({
          filePath: filePath || filename,
          filename,
          scope: config.scope,
          scopeDescription: getFullScopeDescription(config, jobs, selectedIds, filteredJobs),
          includedFields: getExportFields(config).map(f => f.label),
          rowCount: recordCount,
          config,
          originalJobs: jobsToExport
        });
        
        console.log('Saved export to history:', historyEntry.id);
      } catch (historyError) {
        console.error('Failed to save export to history:', historyError);
        // Don't fail the export if history save fails
      }

      toast({
        title: "Export successful",
        description: config.saveToFile 
          ? `${recordCount} job application${recordCount === 1 ? '' : 's'} saved to ${filePath}`
          : `${jobsToExport.length} job application${jobsToExport.length === 1 ? '' : 's'} exported to ${filename}`,
        duration: 5000,
      });

      // Auto-close modal after successful export
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : 'Failed to export CSV file',
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getScopeDescription = (scope: ExportConfig['scope']) => {
    switch (scope) {
      case 'selected':
        return `${selectedIds.length} selected job${selectedIds.length === 1 ? '' : 's'}`;
      case 'filtered':
        return `${filteredJobs.length} filtered job${filteredJobs.length === 1 ? '' : 's'}`;
      case 'all':
      default:
        return `All ${jobs.length} job${jobs.length === 1 ? '' : 's'}`;
    }
  };

  const fields = getExportFields(config);
  const previewCount = getPreviewJobsCount();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export to CSV
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Export Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Scope</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scope-all"
                  name="scope"
                  value="all"
                  checked={config.scope === 'all'}
                  onChange={() => handleScopeChange('all')}
                  className="w-4 h-4"
                />
                <label htmlFor="scope-all" className="text-sm cursor-pointer">
                  All jobs ({jobs.length})
                </label>
              </div>
              
              {selectedIds.length > 0 && (
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="scope-selected"
                    name="scope"
                    value="selected"
                    checked={config.scope === 'selected'}
                    onChange={() => handleScopeChange('selected')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="scope-selected" className="text-sm cursor-pointer">
                    Selected jobs ({selectedIds.length})
                  </label>
                </div>
              )}
              
              {filteredJobs.length > 0 && filteredJobs.length !== jobs.length && (
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="scope-filtered"
                    name="scope"
                    value="filtered"
                    checked={config.scope === 'filtered'}
                    onChange={() => handleScopeChange('filtered')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="scope-filtered" className="text-sm cursor-pointer">
                    Filtered results ({filteredJobs.length})
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Field Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Field Options</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="extended-fields" className="text-sm cursor-pointer">
                  Include Extended Fields
                </Label>
                <p className="text-xs text-gray-500">
                  Full JD text and summary
                </p>
              </div>
              <Switch
                id="extended-fields"
                checked={config.includeExtendedFields}
                onCheckedChange={handleToggleExtendedFields}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="save-to-file" className="text-sm cursor-pointer">
                  Save to File System
                </Label>
                <p className="text-xs text-gray-500">
                  Save to Documents/Pawgrammer-Exports folder
                </p>
              </div>
              <Switch
                id="save-to-file"
                checked={config.saveToFile}
                onCheckedChange={handleToggleSaveToFile}
              />
            </div>
          </div>

          {/* Export Preview */}
          <div className="bg-gray-50 p-3 rounded-md space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Export Preview
            </div>
            <div className="text-sm text-gray-600">
              <div>{getScopeDescription(config.scope)}</div>
              <div>{fields.length} field{fields.length === 1 ? '' : 's'} included</div>
              {previewCount > 0 && (
                <div className="font-medium text-gray-900">
                  {getExportSummary(getJobsToExport({ jobs, selectedIds, filteredJobs, config }), config)}
                </div>
              )}
            </div>
          </div>

          {/* Progress/Status */}
          {exportStatus !== 'idle' && (
            <div className="space-y-2">
              {exportStatus === 'processing' && (
                <>
                  <Progress value={exportProgress} className="h-2" />
                  <div className="text-sm text-gray-600 text-center">
                    Exporting... {exportProgress}%
                  </div>
                </>
              )}
              
              {exportStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Export completed successfully!
                </div>
              )}
              
              {exportStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage || 'Export failed'}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={!canExport() || isExporting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isExporting ? (
              <>
                <Settings className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}