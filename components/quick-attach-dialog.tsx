'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Clock, 
  Link,
  Plus,
  ArrowRight,
  File
} from 'lucide-react';
import { ResumeConflictDialog } from './resume-conflict-dialog';

interface QuickAttachDialogProps {
  resume: UnassignedResumeEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onAttached: () => void;
  onCreateJob: (resumeId: string) => void;
}

export function QuickAttachDialog({ 
  resume, 
  isOpen, 
  onClose, 
  onAttached,
  onCreateJob 
}: QuickAttachDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictJob, setConflictJob] = useState<JobDescription | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadJobs();
      setSearchTerm('');
    }
  }, [isOpen]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      } else {
        throw new Error('Failed to load jobs');
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

  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs.slice(0, 10); // Show first 10 if no search

    const term = searchTerm.toLowerCase();
    return jobs.filter(job => 
      job.company?.toLowerCase().includes(term) ||
      job.role?.toLowerCase().includes(term) ||
      job.jd_text?.toLowerCase().includes(term)
    ).slice(0, 10); // Limit to 10 results
  }, [jobs, searchTerm]);

  const handleAttachToJob = async (jobUuid: string, jobTitle: string) => {
    if (!resume) return;

    // Find the job to check if it already has a resume
    const job = jobs.find(j => j.uuid === jobUuid);
    if (!job) return;

    // Check if job already has an active resume
    if (job.active_resume_version_id || job.resume_filename) {
      // Show conflict dialog
      setConflictJob(job);
      setConflictDialogOpen(true);
      return;
    }

    // Job has no existing resume, proceed with normal attach
    await performAttach(jobUuid, jobTitle);
  };

  const performAttach = async (jobUuid: string, jobTitle: string, forceReplace = false, setAsActive = true) => {
    if (!resume) return;

    setIsAttaching(true);
    try {
      // Check for exact duplicate first
      const duplicateCheckResponse = await fetch('/api/resume/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resume.id,
          jobUuid: jobUuid
        })
      });

      if (duplicateCheckResponse.ok) {
        const duplicateResult = await duplicateCheckResponse.json();
        if (duplicateResult.isDuplicate && !forceReplace) {
          // Handle exact duplicate case
          toast({
            title: "File Already Attached",
            description: `This file is already attached to this job.`,
            action: (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => performAttach(jobUuid, jobTitle, true, true)}>
                  Make Active
                </Button>
                <Button size="sm" variant="outline" onClick={() => {}}>
                  Keep Current
                </Button>
              </div>
            )
          });
          return;
        }
      }

      const response = await fetch('/api/resume/unassigned/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resume.id,
          jobUuid: jobUuid,
          replaceActive: forceReplace,
          setAsActive: setAsActive
        })
      });

      if (response.ok) {
        toast({
          title: "Attached Successfully",
          description: `${resume.filename} attached to ${jobTitle}`,
        });
        onAttached();
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to attach resume');
      }
    } catch (error) {
      toast({
        title: "Attach Failed",
        description: error instanceof Error ? error.message : "Failed to attach resume",
        variant: "destructive",
      });
    } finally {
      setIsAttaching(false);
    }
  };

  const handleCreateJob = () => {
    if (!resume) return;
    onCreateJob(resume.id);
    onClose();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!resume) return null;

  return (
    <React.Fragment>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Quick Attach - {resume.filename}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          {/* Search Input */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search jobs by company, role, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Create New Job Option */}
          <Card className="border-green-200 bg-green-50 flex-shrink-0">
            <CardContent className="p-4">
              <Button
                variant="ghost"
                className="w-full justify-start text-green-800 hover:bg-green-100"
                onClick={handleCreateJob}
              >
                <Plus className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Create New Job</div>
                  <div className="text-sm opacity-75">
                    Start a new job application with this resume
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Job List - Scrollable container */}
          <div className="flex-1 overflow-hidden">
            <div className="space-y-2 h-full overflow-y-auto pr-2">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading jobs...
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No jobs match your search' : 'No jobs found'}
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <Card key={job.uuid} className="hover:bg-gray-50 transition-colors">
                    <CardContent className="p-4">
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-auto p-0"
                        onClick={() => handleAttachToJob(job.uuid, `${job.company} - ${job.role}`)}
                        disabled={isAttaching}
                      >
                        <div className="text-left space-y-2 w-full">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span className="font-medium truncate">
                                  {job.company || 'Unknown Company'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span className="text-sm text-gray-700 truncate">
                                  {job.role || 'Unknown Role'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 ml-2">
                              <Clock className="h-3 w-3" />
                              {formatDate(job.fetched_at_iso)}
                            </div>
                          </div>
                          
                          {/* Status and Resume Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.application_status && (
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
                            )}
                            {(job.active_resume_version_id || job.resume_filename) && (
                              <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full" title="Resume attached">
                                <File className="h-3 w-3" />
                                Resume
                              </span>
                            )}
                          </div>

                          {/* Job Description Preview */}
                          {job.jd_text && (
                            <div className="text-xs text-gray-600 line-clamp-2">
                              {job.jd_text.substring(0, 150)}...
                            </div>
                          )}
                        </div>
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="text-sm text-gray-500">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} shown
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Resume Conflict Dialog - Separate modal layer */}
    {conflictJob && (
      <ResumeConflictDialog
        isOpen={conflictDialogOpen}
        onClose={() => {
          setConflictDialogOpen(false);
          setConflictJob(null);
        }}
        jobInfo={{
          company: conflictJob.company || 'Unknown Company',
          role: conflictJob.role || 'Unknown Role'
        }}
        currentResume={{
          filename: conflictJob.resume_filename || 'Unknown Resume',
          date: formatDate(conflictJob.fetched_at_iso)
        }}
        newResume={{
          filename: resume?.filename || 'Unknown Resume'
        }}
        onReplace={async (setAsActive = true) => {
          if (!conflictJob) return;
          await performAttach(conflictJob.uuid, `${conflictJob.company} - ${conflictJob.role}`, true, setAsActive);
          setConflictDialogOpen(false);
          setConflictJob(null);
        }}
        onKeepBoth={async (setAsActive = false) => {
          if (!conflictJob) return;
          await performAttach(conflictJob.uuid, `${conflictJob.company} - ${conflictJob.role}`, false, setAsActive);
          setConflictDialogOpen(false);
          setConflictJob(null);
        }}
      />
    )}
    </React.Fragment>
  );
}