'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { JobDescription } from '@/lib/types';
import { config, getUploadLimitsMessage } from '@/lib/config';
import { 
  Upload, 
  X, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Edit3,
  Trash2,
  RefreshCw,
  HardDrive
} from 'lucide-react';

// File upload types
interface FileUpload {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: {
    filename: string;
    extractedText: string;
    company?: string;
    role?: string;
    wordCount?: number;
    hasContactInfo?: boolean;
  };
  jobMapping?: {
    jobUuid: string;
    company: string;
    role: string;
  };
  isDuplicate?: boolean;
  duplicateAction?: 'skip' | 'replace';
}

// File validation constants (use config values)
const ACCEPTED_MIME_TYPES = config.upload.allowedMimeTypes;
const MAX_FILE_SIZE = config.upload.maxSizeBytes;
const MAX_FILE_COUNT = config.upload.maxFiles;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total limit

export function DragDropBulkImport() {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<JobDescription[]>([]);
  const [showJobMappingDialog, setShowJobMappingDialog] = useState<FileUpload | null>(null);
  const [selectedJobUuid, setSelectedJobUuid] = useState<string>('');
  const [isMapping, setIsMapping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load available jobs for mapping
  useEffect(() => {
    loadAvailableJobs();
  }, []);

  const loadAvailableJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        setAvailableJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  // File validation
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type as any)) {
      return { 
        valid: false, 
        error: config.demo.client ? 
          `${getUploadLimitsMessage()} Unsupported file type.` :
          `Unsupported file type: ${file.type}`
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: config.demo.client ?
          `${getUploadLimitsMessage()} File too large.` :
          `File too large: ${Math.round(file.size / 1024 / 1024)}MB (max ${config.upload.maxSizeMB}MB)`
      };
    }
    return { valid: true };
  };

  // Check for duplicates
  const checkDuplicates = (newFiles: File[], existingFiles: FileUpload[]) => {
    return newFiles.map(file => {
      const isDuplicate = existingFiles.some(existing => 
        existing.file.name === file.name && existing.file.size === file.size
      );
      return { file, isDuplicate };
    });
  };

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Handle file selection
  const handleFiles = useCallback((selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    
    // Check file count limit
    if (files.length + fileArray.length > MAX_FILE_COUNT) {
      toast({
        title: "Too Many Files",
        description: config.demo.client ?
          `${getUploadLimitsMessage()} Too many files selected.` :
          `Maximum ${MAX_FILE_COUNT} files allowed. You selected ${fileArray.length} files but already have ${files.length}.`,
        variant: "destructive",
      });
      return;
    }

    // Check total size limit
    const currentTotalSize = files.reduce((sum, f) => sum + f.file.size, 0);
    const newTotalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    
    if (currentTotalSize + newTotalSize > MAX_TOTAL_SIZE) {
      toast({
        title: "Files Too Large",
        description: `Total size limit exceeded. Maximum 50MB allowed.`,
        variant: "destructive",
      });
      return;
    }

    // Validate and check duplicates
    const validFiles: FileUpload[] = [];
    const errors: string[] = [];

    fileArray.forEach(file => {
      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      // Check for duplicates
      const isDuplicate = files.some(existing => 
        existing.file.name === file.name && existing.file.size === file.size
      );

      validFiles.push({
        id: generateId(),
        file,
        status: 'queued',
        progress: 0,
        isDuplicate
      });
    });

    // Show errors if any
    if (errors.length > 0) {
      toast({
        title: "Some Files Rejected",
        description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? '...' : ''),
        variant: "destructive",
      });
    }

    // Add valid files
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      toast({
        title: "Files Added",
        description: `${validFiles.length} file(s) added to upload queue`,
      });
    }
  }, [files, toast]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  }, [handleFiles]);

  // File input handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Clear all files
  const clearAllFiles = useCallback(() => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Process files (upload and extract text)
  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const queuedFiles = files.filter(f => f.status === 'queued');
    
    // Track processing results locally
    let successful = 0;
    let failed = 0;

    for (const fileUpload of queuedFiles) {
      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileUpload.id 
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        ));

        // Create form data
        const formData = new FormData();
        formData.append('file', fileUpload.file);

        // Upload with progress tracking
        const response = await fetch('/api/resume/bulk-upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          
          // Update status to completed
          setFiles(prev => prev.map(f => 
            f.id === fileUpload.id 
              ? { 
                  ...f, 
                  status: 'completed', 
                  progress: 100,
                  result: {
                    filename: result.filename,
                    extractedText: result.text || '',
                    company: result.analysis?.detectedCompany,
                    role: result.analysis?.detectedRole,
                    wordCount: result.analysis?.wordCount,
                    hasContactInfo: result.analysis?.hasContactInfo
                  }
                }
              : f
          ));
          
          successful++;
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }
      } catch (error) {
        // Update status to error
        setFiles(prev => prev.map(f => 
          f.id === fileUpload.id 
            ? { 
                ...f, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Upload failed'
              }
            : f
        ));
        
        failed++;
      }

      // Small delay between files
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsProcessing(false);
    
    // Show completion toast with accurate counts
    toast({
      title: "Processing Complete",
      description: `${successful} files processed successfully, ${failed} failed`,
    });
  };

  // Retry failed files
  const retryFailed = () => {
    setFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'queued', error: undefined } : f
    ));
  };

  // Get status color
  const getStatusColor = (status: FileUpload['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'uploading': case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  // Get status icon
  const getStatusIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  // Calculate statistics
  const stats = {
    total: files.length,
    queued: files.filter(f => f.status === 'queued').length,
    completed: files.filter(f => f.status === 'completed').length,
    error: files.filter(f => f.status === 'error').length,
    processing: files.filter(f => f.status === 'uploading' || f.status === 'processing').length,
    mapped: files.filter(f => f.jobMapping).length
  };

  // Save job mapping
  const saveJobMapping = async () => {
    if (!showJobMappingDialog || !selectedJobUuid) {
      toast({
        title: "No Job Selected",
        description: "Please select a job to map this resume to",
        variant: "destructive",
      });
      return;
    }

    const selectedJob = availableJobs.find(job => job.uuid === selectedJobUuid);
    if (!selectedJob) {
      toast({
        title: "Invalid Job",
        description: "Selected job not found",
        variant: "destructive",
      });
      return;
    }

    setIsMapping(true);
    try {
      // Update the file with job mapping information
      setFiles(prev => prev.map(f => 
        f.id === showJobMappingDialog.id 
          ? { 
              ...f, 
              jobMapping: {
                jobUuid: selectedJob.uuid,
                company: selectedJob.company || 'Unknown Company',
                role: selectedJob.role || 'Unknown Role'
              }
            }
          : f
      ));

      // Close dialog and reset state
      setShowJobMappingDialog(null);
      setSelectedJobUuid('');
      
      toast({
        title: "Mapping Saved",
        description: `Resume mapped to ${selectedJob.company} - ${selectedJob.role}`,
      });
    } catch (error) {
      toast({
        title: "Mapping Failed",
        description: error instanceof Error ? error.message : "Failed to save job mapping",
        variant: "destructive",
      });
    } finally {
      setIsMapping(false);
    }
  };

  // Reset dialog state when opening
  const openJobMappingDialog = (fileUpload: FileUpload) => {
    setShowJobMappingDialog(fileUpload);
    setSelectedJobUuid(fileUpload.jobMapping?.jobUuid || '');
  };

  // Calculate total progress
  const totalProgress = files.length > 0 
    ? files.reduce((sum, f) => sum + (f.status === 'completed' ? 100 : f.progress), 0) / files.length
    : 0;

  // Keyboard handlers for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Resumes
          </CardTitle>
          <CardDescription>
            Drag and drop multiple resume files or click to browse. {config.demo.client ? getUploadLimitsMessage() : 'Supports PDF, DOC, DOCX, and TXT files.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label="Drag and drop files here or click to browse"
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500
              ${isDragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <HardDrive className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop files here' : 'Drag & drop resume files here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse your computer
            </p>
            <p className="text-xs text-gray-400">
              {config.demo.client ? 
                `Demo mode: ${config.upload.allowedExtensions.join(', ')} • Max ${MAX_FILE_COUNT} files • ${config.upload.maxSizeMB}MB per file` :
                `Supports PDF, DOC, DOCX, TXT • Max ${MAX_FILE_COUNT} files • ${config.upload.maxSizeMB}MB per file`
              }
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="File input for resume upload"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={processFiles}
                    disabled={isProcessing || stats.queued === 0}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isProcessing ? 'Processing...' : `Process ${stats.queued} Files`}
                  </Button>
                  
                  {stats.error > 0 && (
                    <Button
                      variant="outline"
                      onClick={retryFailed}
                      disabled={isProcessing}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry Failed ({stats.error})
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={clearAllFiles}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
              </div>

              {/* Progress Overview */}
              {(isProcessing || stats.completed > 0) && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <span className="text-sm">{stats.completed}/{stats.total} completed</span>
                    </div>
                    <Progress value={totalProgress} className="h-2" />
                    {isProcessing && (
                      <p className="text-xs text-blue-600 mt-2">
                        Processing files... {stats.processing} in progress
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-5 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{stats.queued}</p>
                  <p className="text-xs text-gray-500">Queued</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
                  <p className="text-xs text-blue-500">Processing</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                  <p className="text-xs text-green-500">Completed</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{stats.mapped}</p>
                  <p className="text-xs text-purple-500">Mapped</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                  <p className="text-xs text-red-500">Errors</p>
                </div>
              </div>

              {/* File List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {files.map((fileUpload) => (
                  <Card key={fileUpload.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(fileUpload.status)}
                            <span className="font-medium truncate">{fileUpload.file.name}</span>
                            <span className={`text-xs ${getStatusColor(fileUpload.status)}`}>
                              {fileUpload.status}
                            </span>
                            {fileUpload.isDuplicate && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                Duplicate
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            <span>{Math.round(fileUpload.file.size / 1024)} KB</span>
                            <span>•</span>
                            <span>{fileUpload.file.type}</span>
                          </div>

                          {fileUpload.status === 'uploading' && (
                            <Progress value={fileUpload.progress} className="h-1 mt-2" />
                          )}

                          {fileUpload.error && (
                            <p className="text-xs text-red-600 mt-1">{fileUpload.error}</p>
                          )}

                          {fileUpload.result && (
                            <div className="mt-2 text-xs text-green-600">
                              ✓ Text extracted • {fileUpload.result.extractedText.length} characters
                              {fileUpload.result.wordCount && (
                                <span> • {fileUpload.result.wordCount} words</span>
                              )}
                              {fileUpload.result.hasContactInfo && (
                                <span> • Contact info detected</span>
                              )}
                              {(fileUpload.result.company || fileUpload.result.role) && (
                                <p className="text-blue-600">
                                  Auto-detected: {fileUpload.result.company || 'Unknown Company'} - {fileUpload.result.role || 'Unknown Role'}
                                </p>
                              )}
                            </div>
                          )}

                          {fileUpload.jobMapping && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                              <p className="text-green-800 font-medium">
                                ✓ Mapped to: {fileUpload.jobMapping.company} - {fileUpload.jobMapping.role}
                              </p>
                              {config.demo.client && (
                                <p className="text-green-700 mt-1 text-xs">
                                  Demo mode: nothing is saved. In the full app, this step creates a job record with your mapped resume so you can track it later.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {fileUpload.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openJobMappingDialog(fileUpload)}
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              {fileUpload.jobMapping ? 'Edit Mapping' : 'Map to Job'}
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFile(fileUpload.id)}
                            disabled={isProcessing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Mapping Dialog */}
      {showJobMappingDialog && (
        <Dialog open={!!showJobMappingDialog} onOpenChange={() => setShowJobMappingDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Map Resume to Job</DialogTitle>
              <DialogDescription>
                Associate {showJobMappingDialog.file.name} with a job application
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Job Application</label>
                <select 
                  className="w-full p-2 border rounded-md"
                  value={selectedJobUuid}
                  onChange={(e) => setSelectedJobUuid(e.target.value)}
                  disabled={isMapping}
                >
                  <option value="">Choose a job application...</option>
                  {availableJobs.map((job) => (
                    <option key={job.uuid} value={job.uuid}>
                      {job.company} - {job.role}
                    </option>
                  ))}
                </select>
              </div>

              {showJobMappingDialog.result && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Extracted Information:</p>
                  <p className="text-xs text-gray-600">
                    {showJobMappingDialog.result.extractedText.substring(0, 200)}...
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowJobMappingDialog(null);
                    setSelectedJobUuid('');
                  }}
                  disabled={isMapping}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveJobMapping}
                  disabled={!selectedJobUuid || isMapping}
                >
                  {isMapping ? 'Saving...' : 'Save Mapping'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}