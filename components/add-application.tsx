'use client';

import { useState } from 'react';
import { JobDescription } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ReminderEditor } from './reminder-editor';
import { Plus, Bell, FileText, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AddApplicationProps {
  onApplicationAdded?: (application: JobDescription) => void;
}

export function AddApplication({ onApplicationAdded }: AddApplicationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<JobDescription['application_status']>('applied');
  const [showReminderEditor, setShowReminderEditor] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<JobDescription | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [manualResumeText, setManualResumeText] = useState('');
  const [savingResumeText, setSavingResumeText] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company.trim() || !role.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both company and role.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Create the job description text (use provided text or generate default)
      const jdText = jobDescription.trim() || `Application for ${role.trim()} at ${company.trim()}

Company: ${company.trim()}
Role: ${role.trim()}
Applied: ${new Date(appliedDate).toLocaleDateString()}
Status: ${status}

${sourceUrl.trim() ? `Source: ${sourceUrl.trim()}` : ''}

Job Description: [Add job description details here when available]`;


      // Save the job description using the save-job API to ensure it gets proper storage
      const response = await fetch('/api/save-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: jdText,
          url: sourceUrl.trim() || null,
          company: company.trim(),
          role: role.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save job description');
      }

      const data = await response.json();

      let resumeInfo = null;
      // Process manual resume text
      if (manualResumeText.trim()) {
        setSavingResumeText(true);
        try {
          const filename = `ResumeText_${company.trim()}_${role.trim()}_${appliedDate}.txt`
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_');

          const saveResponse = await fetch('/api/resume/save-manual-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobUuid: data.uuid,
              filename,
              content: manualResumeText.trim()
            })
          });

          if (saveResponse.ok) {
            const saveResult = await saveResponse.json();
            resumeInfo = {
              resume_filename: filename,
              resumeTextPath: saveResult.filePath,
              resumeTextManual: manualResumeText.trim(),
              resumeTextSource: 'manual' as const
            };
          } else {
            const errorData = await saveResponse.json();
            // Keep the in-record text but show warning about file save failure
            resumeInfo = {
              resume_filename: filename,
              resumeTextManual: manualResumeText.trim(),
              resumeTextSource: 'manual' as const
            };
            toast({
              title: "Saved in app, but couldn't write the file",
              description: "Your resume text is saved but the file couldn't be created. Try again later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Resume text save error:', error);
          // Keep the in-record text even if file save fails
          resumeInfo = {
            resume_filename: `ResumeText_${company.trim()}_${role.trim()}_${appliedDate}.txt`.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_'),
            resumeTextManual: manualResumeText.trim(),
            resumeTextSource: 'manual' as const
          };
          toast({
            title: "Saved in app, but couldn't write the file",
            description: "Your resume text is saved but the file couldn't be created. Try again later.",
            variant: "destructive",
          });
        }
        setSavingResumeText(false);
      }

      const newApplication: JobDescription = {
        uuid: data.uuid,
        company: company.trim(),
        role: role.trim(),
        jd_text: jdText,
        source_url: sourceUrl.trim() || null,
        fetched_at_iso: new Date().toISOString(),
        content_hash: data.content_hash || '',
        capture_method: 'manual',
        captured_at: new Date().toISOString(),
        application_status: status,
        applied_date: appliedDate,
        last_updated: new Date().toISOString(),
        ...resumeInfo,
      };


      // Update the job record on disk with resume information and application details
      if (resumeInfo || status !== 'applied' || appliedDate !== new Date().toISOString().split('T')[0]) {
        try {
          const updates: Partial<JobDescription> = {
            application_status: status,
            applied_date: appliedDate,
            ...resumeInfo,
          };

          const updateResponse = await fetch(`/api/jobs/${data.uuid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
        } catch (error) {
          console.warn('Error updating job on disk:', error);
        }
      }

      // Save to localStorage for immediate access
      const storageKey = `job_${newApplication.uuid}`;
      localStorage.setItem(storageKey, JSON.stringify(newApplication));

      // Add to applications list
      onApplicationAdded?.(newApplication);

      const resumeText = resumeInfo ? ` and resume text` : '';
      toast({
        title: "Application added",
        description: `${company} - ${role} has been added${resumeText}.`,
      });

      // Reset form
      setCompany('');
      setRole('');
      setJobDescription('');
      setSourceUrl('');
      setAppliedDate(new Date().toISOString().split('T')[0]);
      setStatus('applied');
      setManualResumeText('');
      setIsOpen(false);
    } catch (error) {
      // Fallback to local-only storage if API fails
      console.warn('API save failed, falling back to local storage:', error);
      
      const newApplication: JobDescription = {
        uuid: uuidv4(),
        company: company.trim(),
        role: role.trim(),
        jd_text: jobDescription.trim() || `Application for ${role.trim()} at ${company.trim()}`,
        source_url: sourceUrl.trim() || null,
        fetched_at_iso: new Date().toISOString(),
        content_hash: '',
        capture_method: 'manual',
        captured_at: new Date().toISOString(),
        application_status: status,
        applied_date: appliedDate,
        last_updated: new Date().toISOString(),
      };

      // Save to localStorage
      const storageKey = `job_${newApplication.uuid}`;
      localStorage.setItem(storageKey, JSON.stringify(newApplication));

      // Add to applications list
      onApplicationAdded?.(newApplication);

      toast({
        title: "Application added",
        description: `${company} - ${role} has been added to your applications.`,
      });

      // Reset form
      setCompany('');
      setRole('');
      setJobDescription('');
      setSourceUrl('');
      setAppliedDate(new Date().toISOString().split('T')[0]);
      setStatus('applied');
      setManualResumeText('');
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetReminder = () => {
    if (!company.trim() || !role.trim()) {
      toast({
        title: "Save application first",
        description: "Please enter company and role before setting a reminder.",
        variant: "destructive",
      });
      return;
    }

    const tempApplication: JobDescription = {
      uuid: uuidv4(),
      company: company.trim(),
      role: role.trim(),
      jd_text: '',
      source_url: null,
      fetched_at_iso: new Date().toISOString(),
      content_hash: '',
      application_status: status,
      applied_date: appliedDate,
    };

    setCurrentApplication(tempApplication);
    setShowReminderEditor(true);
  };

  const handleReminderSaved = () => {
    // The reminder was saved, now save the application
    if (currentApplication) {
      const newApplication: JobDescription = {
        ...currentApplication,
        jd_text: `Application for ${currentApplication.role} at ${currentApplication.company}`,
        capture_method: 'manual',
        captured_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      // Get the updated reminder from localStorage if it exists
      const storageKey = `job_${newApplication.uuid}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        newApplication.next_reminder = parsed.next_reminder;
      }

      localStorage.setItem(storageKey, JSON.stringify(newApplication));
      onApplicationAdded?.(newApplication);

      toast({
        title: "Application added with reminder",
        description: `${newApplication.company} - ${newApplication.role} has been added.`,
      });

      // Reset form
      setCompany('');
      setRole('');
      setJobDescription('');
      setSourceUrl('');
      setAppliedDate(new Date().toISOString().split('T')[0]);
      setStatus('applied');
      setManualResumeText('');
      setCurrentApplication(null);
      setIsOpen(false);
    }
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="mb-4" title="Add a new job application with resume upload and auto-naming">
            <Plus className="h-4 w-4 mr-2" />
            Add Application
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Application</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company*</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role*</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Job title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-url">Source URL (optional)</Label>
              <Input
                id="source-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-description">Job Description (optional)</Label>
              <Textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here, or leave empty to generate a basic placeholder..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                💡 The job description will always be saved - if empty, a placeholder will be generated.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resume-text">Paste Resume Text (for interview prep)</Label>
              <div className="text-xs text-gray-500 mb-2">
                Plain text works best. You can still open your original file later.
              </div>
              <Textarea
                id="resume-text"
                value={manualResumeText}
                onChange={(e) => {
                  // Normalize line endings and preserve formatting
                  const normalizedText = e.target.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                  setManualResumeText(normalizedText);
                }}
                placeholder="Paste your resume content here..."
                className="min-h-[200px] text-sm font-sans"
                style={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {manualResumeText.length} characters
                </span>
                <span className="text-xs text-gray-500">
                  Will be saved as: <span className="font-mono">{company && role ? `ResumeText_${company.replace(/[^a-zA-Z0-9]/g, '_')}_${role.replace(/[^a-zA-Z0-9]/g, '_')}_${appliedDate}.txt` : 'ResumeText_Company_Role_YYYY-MM-DD.txt'}</span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="applied-date">Applied Date</Label>
              <Input
                id="applied-date"
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                💡 Click the date field to open calendar picker, or use format: YYYY-MM-DD (e.g., 2024-03-15)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as JobDescription['application_status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saved">Saved</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="interviewing">Interviewing</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSetReminder}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Bell className="h-4 w-4 mr-1" />
                Set Reminder
              </Button>
              
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || savingResumeText}>
                  {savingResumeText ? 'Saving Resume Text...' : isSaving ? 'Saving...' : 'Add Application'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {currentApplication && (
        <ReminderEditor
          isOpen={showReminderEditor}
          onClose={() => {
            setShowReminderEditor(false);
            setCurrentApplication(null);
          }}
          job={currentApplication}
          onReminderChange={handleReminderSaved}
        />
      )}
    </>
  );
}