'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { UnassignedResumeEntry, JobDescription } from '@/lib/types';
import { 
  Search, 
  File, 
  Link,
  ArrowRight,
  Clock
} from 'lucide-react';

interface AttachExistingResumeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobUuid: string;
  jobInfo?: { company: string; role: string; };
  onResumeAttached: () => void;
}

export function AttachExistingResumeDialog({ 
  isOpen, 
  onClose, 
  jobUuid, 
  jobInfo,
  onResumeAttached
}: AttachExistingResumeDialogProps) {
  const [resumes, setResumes] = useState<UnassignedResumeEntry[]>([]);
  const [filteredResumes, setFilteredResumes] = useState<UnassignedResumeEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadUnassignedResumes();
    }
  }, [isOpen]);

  useEffect(() => {
    // Filter resumes based on search term
    if (!searchTerm.trim()) {
      setFilteredResumes(resumes);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = resumes.filter(resume => 
        resume.filename.toLowerCase().includes(term) ||
        resume.extracted_text?.toLowerCase().includes(term)
      );
      setFilteredResumes(filtered);
    }
  }, [searchTerm, resumes]);

  const loadUnassignedResumes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/resume/unassigned');
      if (response.ok) {
        const data = await response.json();
        setResumes(data.resumes || []);
      } else {
        throw new Error('Failed to load resumes');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load resume library",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachResume = async (resumeId: string) => {
    setIsAttaching(true);
    try {
      const response = await fetch('/api/resume/unassigned/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resumeId,
          jobUuid: jobUuid
        })
      });

      if (response.ok) {
        toast({
          title: "Resume Attached",
          description: `Resume attached to ${jobInfo?.company || 'job'} - ${jobInfo?.role || 'position'}`,
          variant: "default",
        });
        onResumeAttached();
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to attach resume');
      }
    } catch (error) {
      toast({
        title: "Attach Failed",
        description: error instanceof Error ? error.message : "Could not attach resume",
        variant: "destructive",
      });
    } finally {
      setIsAttaching(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Attach Existing Resume
            {jobInfo && (
              <span className="text-sm font-normal text-gray-600">
                to {jobInfo.company} - {jobInfo.role}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search your resume library..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Resume List */}
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading resume library...</div>
              </div>
            ) : filteredResumes.length === 0 ? (
              <div className="text-center py-8">
                <File className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">
                  {searchTerm ? 'No resumes match your search' : 'No resumes in your library'}
                </p>
                {!searchTerm && (
                  <p className="text-sm text-gray-400 mt-2">
                    Upload some resumes to the unassigned area first
                  </p>
                )}
              </div>
            ) : (
              filteredResumes.map((resume) => (
                <Card 
                  key={resume.id} 
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => handleAttachResume(resume.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <File className="h-5 w-5 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{resume.filename}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span>{formatSize(resume.file_size)}</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(resume.uploaded_at)}
                            </div>
                            {resume.extraction_status === 'success' && (
                              <span className="text-green-600">✓ Text extracted</span>
                            )}
                          </div>
                          {resume.extracted_text && searchTerm && (
                            <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                              {resume.extracted_text.substring(0, 150)}...
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <Button 
                          size="sm" 
                          disabled={isAttaching}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAttachResume(resume.id);
                          }}
                        >
                          {isAttaching ? 'Attaching...' : 'Attach'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="text-sm text-gray-500">
            {filteredResumes.length} resume{filteredResumes.length !== 1 ? 's' : ''} in library
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}