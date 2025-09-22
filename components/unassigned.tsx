'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { UnassignedResumeEntry } from '@/lib/types';
import { ResumePreview } from '@/components/resume-preview';
import { QuickAttachDialog } from '@/components/quick-attach-dialog';
import { BatchAttachWizard } from '@/components/batch-attach-wizard';
import { FilenameHints } from '@/components/filename-hints';
import { 
  Upload, 
  File, 
  Eye, 
  Download, 
  Trash2, 
  Link, 
  Plus,
  Clock,
  HardDrive,
  FolderUp,
  Lightbulb
} from 'lucide-react';
import { DemoNotice } from '@/components/demo/demo-notice';

interface UnassignedProps {
  onAttachToJob?: (resumeId: string) => void;
  onCreateJobFromResume?: (resumeId: string) => void;
}

export function Unassigned({ onAttachToJob, onCreateJobFromResume }: UnassignedProps) {
  const [unassignedResumes, setUnassignedResumes] = useState<UnassignedResumeEntry[]>([]);
  const [selectedResume, setSelectedResume] = useState<UnassignedResumeEntry | null>(null);
  const [attachDialogResume, setAttachDialogResume] = useState<UnassignedResumeEntry | null>(null);
  const [showBatchWizard, setShowBatchWizard] = useState(false);
  const [showHintsForResume, setShowHintsForResume] = useState<UnassignedResumeEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUnassignedResumes();
  }, []);

  const loadUnassignedResumes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/resume/unassigned');
      if (response.ok) {
        const data = await response.json();
        setUnassignedResumes(data.resumes || []);
      } else {
        throw new Error('Failed to load unassigned resumes');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load unassigned resumes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return ['.pdf', '.docx', '.doc', '.txt'].includes(extension);
    });

    if (validFiles.length === 0) {
      toast({
        title: "No Valid Files",
        description: "Please select PDF, DOCX, DOC, or TXT files",
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length > 20) {
      toast({
        title: "Too Many Files",
        description: "Please select no more than 20 files at once",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      
      // Add all files to the form data
      validFiles.forEach(file => {
        formData.append('file', file);
      });

      const response = await fetch('/api/resume/unassigned/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Use the server-generated summary
        const toastVariant = result.errors > 0 ? "destructive" : "default";
        
        toast({
          title: "Upload Complete",
          description: result.summary || "Files processed",
          variant: toastVariant,
        });

        // If there were duplicates, offer to open batch attach wizard
        if (result.showAttachOption && result.duplicates > 0) {
          // Add a follow-up action to attach existing files
          setTimeout(() => {
            toast({
              title: "Files Ready to Attach",
              description: `${result.duplicates} files are already in your library. Open batch attach to link them to jobs?`,
              action: (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowBatchWizard(true)}
                >
                  Attach Files
                </Button>
              ),
            });
          }, 2000);
        }
      } else {
        toast({
          title: "Upload Failed",
          description: result.error || "An error occurred during upload",
          variant: "destructive",
        });
      }

      // Reload the list
      await loadUnassignedResumes();

    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFolderSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resume/unassigned/${resumeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Deleted",
          description: "Resume removed from unassigned",
        });
        await loadUnassignedResumes();
      } else {
        throw new Error('Failed to delete resume');
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete resume",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (resume: UnassignedResumeEntry) => {
    try {
      const response = await fetch(`/api/resume/view?path=${encodeURIComponent(resume.managed_path)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resume.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to download file');
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderUp className="h-5 w-5" />
            Unassigned
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderUp className="h-5 w-5" />
            Unassigned
          </CardTitle>
          <CardDescription>
            Drop resumes here to manage and attach them to jobs. Nothing leaves your computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={isUploading}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({ webkitdirectory: '' } as any)}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => handleFolderSelect(e.target.files)}
              disabled={isUploading}
            />
            
            <div className="space-y-3">
              <Upload className="h-10 w-10 mx-auto text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Drop resume files here, or click to browse
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <File className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <FolderUp className="h-4 w-4 mr-2" />
                    Browse Folder
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Supported: PDF, DOCX, DOC, TXT • Max 20 files • 10MB each
                </p>
              </div>
            </div>
          </div>

          {/* Demo Notice */}
          <DemoNotice message="This is a demo environment — please don't upload real resumes or sensitive data. Files reset periodically." />
        </CardContent>
      </Card>

      {/* Unassigned Resumes List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Your Resume Files ({unassignedResumes.length})
              </CardTitle>
              <CardDescription>
                Files ready to attach to jobs
              </CardDescription>
            </div>
            {unassignedResumes.length > 1 && (
              <Button
                variant="outline"
                onClick={() => setShowBatchWizard(true)}
                className="flex items-center gap-2"
              >
                <Link className="h-4 w-4" />
                Batch Attach
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {unassignedResumes.length === 0 ? (
            <div className="text-center py-8">
              <File className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files yet</h3>
              <p className="text-gray-500">
                Upload resume files to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unassignedResumes.map((resume) => (
                <Card key={resume.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <File className="h-5 w-5 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium truncate">
                              {resume.filename}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                              <span>{formatFileSize(resume.file_size)}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(resume.uploaded_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedResume(resume)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowHintsForResume(resume)}
                          title="Filename suggestions"
                        >
                          <Lightbulb className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAttachDialogResume(resume)}
                        >
                          <Link className="h-4 w-4 mr-1" />
                          Attach
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateJobFromResume?.(resume.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Job
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(resume)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteResume(resume.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {selectedResume && (
        <Dialog open={!!selectedResume} onOpenChange={() => setSelectedResume(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] w-full">
            <DialogHeader>
              <DialogTitle>{selectedResume.filename}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              <ResumePreview
                filePath={selectedResume.managed_path}
                filename={selectedResume.filename}
                height={600}
                showControls={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Attach Dialog */}
      <QuickAttachDialog
        resume={attachDialogResume}
        isOpen={!!attachDialogResume}
        onClose={() => setAttachDialogResume(null)}
        onAttached={() => {
          loadUnassignedResumes();
          setAttachDialogResume(null);
        }}
        onCreateJob={(resumeId) => {
          onCreateJobFromResume?.(resumeId);
          setAttachDialogResume(null);
        }}
      />

      {/* Batch Attach Wizard */}
      <BatchAttachWizard
        resumes={unassignedResumes}
        isOpen={showBatchWizard}
        onClose={() => setShowBatchWizard(false)}
        onBatchAttached={() => {
          loadUnassignedResumes();
          setShowBatchWizard(false);
        }}
        onCreateJob={(resumeId) => {
          onCreateJobFromResume?.(resumeId);
          setShowBatchWizard(false);
        }}
      />

      {/* Filename Hints */}
      {showHintsForResume && (
        <div className="mt-4">
          <FilenameHints
            resume={showHintsForResume}
            onClose={() => setShowHintsForResume(null)}
          />
        </div>
      )}
    </div>
  );
}