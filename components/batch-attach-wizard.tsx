'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { JobDescription, UnassignedResumeEntry } from '@/lib/types';
import { 
  Search, 
  Building2, 
  Briefcase, 
  Link,
  Plus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  File
} from 'lucide-react';

interface BatchAttachWizardProps {
  resumes: UnassignedResumeEntry[];
  isOpen: boolean;
  onClose: () => void;
  onBatchAttached: () => void;
  onCreateJob: (resumeId: string) => void;
}

interface AttachmentPair {
  resume: UnassignedResumeEntry;
  selectedJob: JobDescription | null;
  searchTerm: string;
}

export function BatchAttachWizard({ 
  resumes, 
  isOpen, 
  onClose, 
  onBatchAttached,
  onCreateJob
}: BatchAttachWizardProps) {
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [attachments, setAttachments] = useState<AttachmentPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const searchRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadJobs();
      // Initialize attachment pairs
      setAttachments(resumes.map(resume => ({
        resume,
        selectedJob: null,
        searchTerm: ''
      })));
      setCurrentIndex(0);
    }
  }, [isOpen, resumes]);

  useEffect(() => {
    // Focus current search input when currentIndex changes
    if (isOpen && searchRefs.current[currentIndex]) {
      searchRefs.current[currentIndex]?.focus();
    }
  }, [currentIndex, isOpen]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredJobs = (searchTerm: string) => {
    if (!searchTerm.trim()) return jobs.slice(0, 5);

    const term = searchTerm.toLowerCase();
    return jobs.filter(job => 
      job.company?.toLowerCase().includes(term) ||
      job.role?.toLowerCase().includes(term) ||
      job.jd_text?.toLowerCase().includes(term)
    ).slice(0, 5);
  };

  const updateAttachment = (index: number, updates: Partial<AttachmentPair>) => {
    setAttachments(prev => 
      prev.map((item, i) => i === index ? { ...item, ...updates } : item)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCurrentIndex(Math.min(currentIndex + 1, attachments.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCurrentIndex(Math.max(currentIndex - 1, 0));
        break;
      case 'Tab':
        if (!e.shiftKey) {
          e.preventDefault();
          setCurrentIndex(Math.min(currentIndex + 1, attachments.length - 1));
        } else {
          e.preventDefault();
          setCurrentIndex(Math.max(currentIndex - 1, 0));
        }
        break;
      case 'Enter':
        e.preventDefault();
        const filteredJobs = getFilteredJobs(attachments[index].searchTerm);
        if (filteredJobs.length > 0) {
          updateAttachment(index, { selectedJob: filteredJobs[0] });
          if (index < attachments.length - 1) {
            setCurrentIndex(index + 1);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        updateAttachment(index, { selectedJob: null, searchTerm: '' });
        break;
    }
  };

  const handleBatchAttach = async () => {
    const validAttachments = attachments.filter(item => item.selectedJob);
    
    if (validAttachments.length === 0) {
      toast({
        title: "No Attachments",
        description: "Please select jobs for at least one resume",
        variant: "destructive",
      });
      return;
    }

    setIsAttaching(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const { resume, selectedJob } of validAttachments) {
        if (!selectedJob) continue;

        try {
          const response = await fetch('/api/resume/unassigned/attach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resumeId: resume.id,
              jobUuid: selectedJob.uuid
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      toast({
        title: "Batch Attach Complete",
        description: `${successCount} attached, ${errorCount} errors`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      if (successCount > 0) {
        onBatchAttached();
        onClose();
      }

    } catch (error) {
      toast({
        title: "Batch Attach Failed",
        description: "An error occurred during batch attach",
        variant: "destructive",
      });
    } finally {
      setIsAttaching(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Batch Attach Wizard - {resumes.length} Resume{resumes.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="text-sm text-gray-600 mb-4">
            Use Arrow Keys, Tab, or click to navigate. Press Enter to select the first job match.
          </div>

          {attachments.map((attachment, index) => {
            const filteredJobs = getFilteredJobs(attachment.searchTerm);
            const isActive = currentIndex === index;

            return (
              <Card 
                key={attachment.resume.id} 
                className={`transition-colors ${
                  isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Resume Info */}
                    <div className="flex items-center gap-3">
                      <File className="h-5 w-5 text-gray-500" />
                      <div className="flex-1">
                        <h4 className="font-medium">{attachment.resume.filename}</h4>
                        <p className="text-sm text-gray-500">
                          {(attachment.resume.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {attachment.selectedJob && (
                        <div className="text-sm text-green-600 flex items-center gap-1">
                          <ArrowRight className="h-4 w-4" />
                          {attachment.selectedJob.company} - {attachment.selectedJob.role}
                        </div>
                      )}
                    </div>

                    {/* Job Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        ref={el => { searchRefs.current[index] = el; }}
                        placeholder="Search jobs by company, role, or description..."
                        value={attachment.searchTerm}
                        onChange={(e) => updateAttachment(index, { searchTerm: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onFocus={() => setCurrentIndex(index)}
                        className={`pl-10 ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                      />
                    </div>

                    {/* Job Results */}
                    {(attachment.searchTerm || attachment.selectedJob) && (
                      <div className="space-y-2">
                        {/* Create New Job Option */}
                        <Card className="border-green-200 bg-green-50">
                          <CardContent className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-green-800 hover:bg-green-100 h-auto p-2"
                              onClick={() => {
                                onCreateJob(attachment.resume.id);
                                onClose();
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Create New Job with this resume
                            </Button>
                          </CardContent>
                        </Card>

                        {/* Job Options */}
                        {filteredJobs.map((job, jobIndex) => (
                          <Card 
                            key={job.uuid} 
                            className={`cursor-pointer transition-colors ${
                              attachment.selectedJob?.uuid === job.uuid 
                                ? 'bg-blue-100 border-blue-300' 
                                : 'hover:bg-gray-100'
                            } ${jobIndex === 0 && isActive ? 'ring-1 ring-gray-300' : ''}`}
                            onClick={() => updateAttachment(index, { selectedJob: job })}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-gray-500" />
                                    <span className="font-medium text-sm">
                                      {job.company || 'Unknown Company'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm text-gray-700">
                                      {job.role || 'Unknown Role'}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(job.fetched_at_iso)}
                                </div>
                              </div>
                              
                              {/* Status Badge */}
                              {job.application_status && (
                                <div className="mt-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    job.application_status === 'applied' 
                                      ? 'bg-blue-100 text-blue-800'
                                      : job.application_status === 'interviewing'
                                      ? 'bg-yellow-100 text-yellow-800' 
                                      : job.application_status === 'offer'
                                      ? 'bg-green-100 text-green-800'
                                      : job.application_status === 'rejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {job.application_status}
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}

                        {attachment.searchTerm && filteredJobs.length === 0 && (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            No jobs match your search
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {attachments.filter(a => a.selectedJob).length} of {attachments.length} resumes assigned
            </div>
            <Button 
              onClick={handleBatchAttach}
              disabled={isAttaching || attachments.filter(a => a.selectedJob).length === 0}
            >
              {isAttaching ? 'Attaching...' : 'Attach All'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}