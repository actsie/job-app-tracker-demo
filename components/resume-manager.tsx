'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ResumeManifestEntry, ResumeVersionEntry, JobDescription } from '@/lib/types';
import { 
  FileText, 
  Download, 
  Eye, 
  RotateCcw, 
  Trash2, 
  Edit3, 
  Clock, 
  HardDrive,
  ExternalLink,
  Archive
} from 'lucide-react';

interface ResumeManagerProps {
  jobUuid?: string;
  selectedJob?: JobDescription;
}

export function ResumeManager({ jobUuid, selectedJob }: ResumeManagerProps) {
  const [resumes, setResumes] = useState<ResumeManifestEntry[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeManifestEntry | null>(null);
  const [versionHistory, setVersionHistory] = useState<ResumeVersionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadResumes();
  }, [jobUuid]);

  const loadResumes = async () => {
    setIsLoading(true);
    try {
      const url = jobUuid ? `/api/resume/list?jobUuid=${jobUuid}` : '/api/resume/list';
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setResumes(data.resumes || []);
      } else {
        throw new Error('Failed to load resumes');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load managed resumes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionHistory = async (resumeId: string) => {
    setIsLoadingVersions(true);
    try {
      const response = await fetch(`/api/resume/versions?resumeId=${resumeId}`);
      if (response.ok) {
        const data = await response.json();
        setVersionHistory(data.versions || []);
      } else {
        throw new Error('Failed to load version history');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load version history",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handlePreviewResume = async (version: ResumeVersionEntry) => {
    try {
      // This would open the file for preview
      // Implementation depends on the file type and available viewers
      const response = await fetch(`/api/resume/preview?path=${encodeURIComponent(version.managed_path)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        throw new Error('Failed to preview file');
      }
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: "Could not open file for preview",
        variant: "destructive",
      });
    }
  };

  const handleDownloadResume = async (version: ResumeVersionEntry) => {
    try {
      const response = await fetch(`/api/resume/download?path=${encodeURIComponent(version.managed_path)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = version.original_filename;
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

  const handleRevealInFolder = async (version: ResumeVersionEntry) => {
    try {
      const response = await fetch('/api/resume/reveal-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: version.managed_path }),
      });

      if (!response.ok) {
        throw new Error('Failed to reveal file in folder');
      }

      toast({
        title: "File Revealed",
        description: "File location opened in file manager",
      });
    } catch (error) {
      toast({
        title: "Reveal Failed",
        description: "Could not open file location",
        variant: "destructive",
      });
    }
  };

  const handleRestoreVersion = async (resumeId: string, versionId: string) => {
    try {
      const response = await fetch('/api/resume/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeId, targetVersionId: versionId }),
      });

      if (response.ok) {
        toast({
          title: "Version Restored",
          description: "Successfully restored to the selected version",
        });
        loadResumes();
        loadVersionHistory(resumeId);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restore version');
      }
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Failed to restore version",
        variant: "destructive",
      });
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resume/delete?resumeId=${resumeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Resume Deleted",
          description: "Resume and all versions have been removed",
        });
        loadResumes();
        setSelectedResume(null);
        setVersionHistory([]);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete resume');
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete resume",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirm(null);
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
            <FileText className="h-5 w-5" />
            Resume Manager
          </CardTitle>
          <CardDescription>Loading managed resumes...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Manager
            {selectedJob && (
              <span className="text-sm font-normal text-gray-500">
                - {selectedJob.company} {selectedJob.role}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Manage your resume versions and file operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resumes.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No resumes found</h3>
              <p className="text-gray-500">
                {jobUuid ? 'No resumes uploaded for this job yet' : 'No managed resumes found'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {resumes.map((resume) => (
                <Card key={resume.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{resume.base_filename}</CardTitle>
                        <CardDescription>
                          {resume.filename_components.company} • {resume.filename_components.role}
                          {resume.versions.length > 1 && (
                            <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {resume.versions.length} versions
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedResume(resume);
                            loadVersionHistory(resume.id);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          View Versions
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDeleteConfirm(resume.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>Created: {formatDate(resume.created_at)}</p>
                        <p>Updated: {formatDate(resume.last_updated)}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {(() => {
                          const activeVersion = resume.versions.find(v => v.is_active);
                          return activeVersion ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePreviewResume(activeVersion)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadResume(activeVersion)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRevealInFolder(activeVersion)}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Reveal
                              </Button>
                            </>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History Dialog */}
      {selectedResume && (
        <Dialog open={!!selectedResume} onOpenChange={() => setSelectedResume(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Version History - {selectedResume.base_filename}</DialogTitle>
              <DialogDescription>
                Manage versions of this resume file
              </DialogDescription>
            </DialogHeader>
            
            {isLoadingVersions ? (
              <div className="py-8 text-center">Loading version history...</div>
            ) : (
              <div className="space-y-4">
                {versionHistory.map((version, index) => (
                  <Card key={version.version_id} className={version.is_active ? 'border-green-500' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            Version {version.version_suffix || 'Original'}
                            {version.is_active && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                Active
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription>{version.original_filename}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreviewResume(version)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadResume(version)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {!version.is_active && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreVersion(selectedResume.id, version.version_id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Uploaded</p>
                          <p className="text-gray-500">{formatDate(version.upload_timestamp)}</p>
                        </div>
                        <div>
                          <p className="font-medium">Checksum</p>
                          <p className="text-gray-500 font-mono text-xs">
                            {version.file_checksum.substring(0, 8)}...
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Original Path</p>
                          <p className="text-gray-500 text-xs break-all">{version.original_path}</p>
                        </div>
                        <div>
                          <p className="font-medium">Managed Path</p>
                          <p className="text-gray-500 text-xs break-all">{version.managed_path}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Resume</DialogTitle>
              <DialogDescription>
                This will permanently delete the resume and all its versions. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteResume(showDeleteConfirm)}
              >
                Delete Forever
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}