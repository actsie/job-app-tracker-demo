'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { JobDescription, ResumeManifestEntry, UnassignedResumeEntry } from '@/lib/types';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, User, Eye } from 'lucide-react';
import { ResumeUpload } from '@/components/resume-upload';
import { ResumeViewer } from '@/components/resume/resume-viewer';
import { RecentCaptures } from '@/components/recent-captures';

interface AddJobSimplifiedProps {
  onJobSaved?: () => void;
  onCancel?: () => void;
  preselectedResumeId?: string | null;
}

interface JobDraft {
  url: string;
  company: string;
  role: string;
  description: string;
  yourName: string;
  resumeId?: string;
  step: number;
}

const DRAFT_KEY = 'add-job-draft';

export function AddJobSimplified({ onJobSaved, onCancel, preselectedResumeId }: AddJobSimplifiedProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [yourName, setYourName] = useState('');
  const [uploadedResumes, setUploadedResumes] = useState<ResumeManifestEntry[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [preselectedResume, setPreselectedResume] = useState<UnassignedResumeEntry | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');
  const [tempJobUuid] = useState(() => uuidv4()); // Generate temporary UUID for resume uploads
  const urlFieldRef = useRef<HTMLInputElement>(null);
  const companyFieldRef = useRef<HTMLInputElement>(null);
  const roleFieldRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load preselected resume and handle draft detection
  useEffect(() => {
    const loadPreselectedResume = async () => {
      if (preselectedResumeId) {
        try {
          const response = await fetch('/api/resume/unassigned');
          if (response.ok) {
            const data = await response.json();
            const resume = data.resumes?.find((r: UnassignedResumeEntry) => r.id === preselectedResumeId);
            if (resume) {
              setPreselectedResume(resume);
              setAriaLiveMessage(`Resume preselected: ${resume.filename}. Step 1 of 3 focused.`);
            }
          }
        } catch (error) {
          console.error('Failed to load preselected resume:', error);
        }
      }
    };

    const loadDraftAndCheckConflict = () => {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        try {
          const draft: JobDraft = JSON.parse(savedDraft);
          // Check if there's existing draft data AND a preselected resume
          if ((draft.url || draft.company || draft.role || draft.description) && preselectedResumeId) {
            setShowDraftPrompt(true);
            return; // Don't load draft yet, wait for user choice
          }
          
          // Load draft normally if no conflict
          setUrl(draft.url || '');
          setCompany(draft.company || '');
          setRole(draft.role || '');
          setDescription(draft.description || '');
          setYourName(draft.yourName || '');
          setCurrentStep(draft.step || 1);
        } catch (error) {
          console.warn('Failed to load draft:', error);
        }
      }
    };

    loadPreselectedResume();
    loadDraftAndCheckConflict();
  }, [preselectedResumeId]);

  // Save draft whenever data changes
  useEffect(() => {
    const draft: JobDraft = {
      url,
      company,
      role,
      description,
      yourName,
      resumeId: uploadedResumes[0]?.id,
      step: currentStep
    };
    
    // Only save if we have some content
    if (url || company || role || description) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [url, company, role, description, yourName, uploadedResumes, currentStep]);

  // Auto-attach preselected resume when reaching Step 2
  useEffect(() => {
    if (currentStep === 2 && preselectedResume && uploadedResumes.length === 0) {
      // Create properly formatted filename with company, role, and date
      const formatDate = () => {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD format
      };
      
      const companyForFilename = company.trim() || 'Unknown-Company';
      const roleForFilename = role.trim() || 'Unknown-Role';
      const dateForFilename = formatDate();
      
      // Convert UnassignedResumeEntry to ResumeManifestEntry format with proper naming
      const convertedResume: ResumeManifestEntry = {
        id: preselectedResume.id,
        base_filename: `${companyForFilename}_${roleForFilename}_${dateForFilename}.${preselectedResume.file_extension}`,
        job_uuid: tempJobUuid,
        filename_components: {
          company: companyForFilename,
          role: roleForFilename,
          date: dateForFilename
        },
        file_extension: preselectedResume.file_extension,
        keep_original: true,
        created_at: preselectedResume.uploaded_at,
        last_updated: preselectedResume.uploaded_at,
        versions: [{
          version_id: preselectedResume.id,
          version_suffix: '',
          managed_path: preselectedResume.managed_path,
          file_checksum: preselectedResume.content_hash,
          upload_timestamp: preselectedResume.uploaded_at,
          original_path: preselectedResume.original_path || preselectedResume.managed_path,
          original_filename: preselectedResume.filename,
          mime_type: 'application/octet-stream',
          is_active: true,
          extracted_text: preselectedResume.extracted_text || undefined,
          extraction_status: preselectedResume.extraction_status || 'pending',
          extraction_method: 'plain-text'
        }]
      };
      setUploadedResumes([convertedResume]);
      setAriaLiveMessage(`Preselected resume ${preselectedResume.filename} has been automatically attached and will be saved as ${convertedResume.base_filename}.`);
    }
  }, [currentStep, preselectedResume, uploadedResumes.length, tempJobUuid, company, role]);

  // Focus management when wizard first opens only (not on field changes)
  useEffect(() => {
    if (currentStep === 1 && !showDraftPrompt && preselectedResumeId) {
      // Only focus once when wizard opens with preselected resume
      const focusFirstEmptyField = () => {
        if (!url.trim() && urlFieldRef.current) {
          urlFieldRef.current.focus();
          return;
        }
        if (!company.trim() && companyFieldRef.current) {
          companyFieldRef.current.focus();
          return;
        }
        if (!role.trim() && roleFieldRef.current) {
          roleFieldRef.current.focus();
          return;
        }
      };

      // Small delay to ensure DOM is ready
      setTimeout(focusFirstEmptyField, 100);
    }
  }, [currentStep, showDraftPrompt, preselectedResumeId]); // Removed url, company, role dependencies

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleContinueDraft = () => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft: JobDraft = JSON.parse(savedDraft);
        setUrl(draft.url || '');
        setCompany(draft.company || '');
        setRole(draft.role || '');
        setDescription(draft.description || '');
        setYourName(draft.yourName || '');
        setCurrentStep(draft.step || 1);
      } catch (error) {
        console.warn('Failed to load draft:', error);
      }
    }
    setShowDraftPrompt(false);
    setAriaLiveMessage(`Continuing with existing draft and preselected resume ${preselectedResume?.filename}.`);
  };

  const handleStartNew = () => {
    clearDraft();
    setShowDraftPrompt(false);
    setAriaLiveMessage(`Starting new job application with preselected resume ${preselectedResume?.filename}.`);
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step >= 1) {
      // Step 1: All basics + description validation
      if (!url.trim()) {
        errors.url = 'Job URL is required';
      } else {
        try {
          new URL(url.trim());
        } catch {
          errors.url = 'Please enter a valid URL';
        }
      }

      if (!company.trim()) {
        errors.company = 'Company is required';
      }

      if (!role.trim()) {
        errors.role = 'Role is required';
      }

      if (!description.trim()) {
        errors.description = 'Job description is required';
      } else if (description.trim().length < 50) {
        errors.description = 'Job description seems too short. Please add more details.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      const nextStep = Math.min(currentStep + 1, 3);
      setCurrentStep(nextStep);
      setAriaLiveMessage(`Moving to Step ${nextStep} of 3: ${getStepTitle(nextStep)}`);
    }
  };

  const handlePrevStep = () => {
    const prevStep = Math.max(currentStep - 1, 1);
    setCurrentStep(prevStep);
    setAriaLiveMessage(`Moving to Step ${prevStep} of 3: ${getStepTitle(prevStep)}`);
  };

  const getStepTitle = (step: number): string => {
    switch (step) {
      case 1: return 'Job Details';
      case 2: return 'Personal Details & Resume';
      case 3: return 'Review & Save';
      default: return '';
    }
  };

  const formatDescriptionForPreview = (text: string): string => {
    // Simple markdown-like formatting for preview
    return text
      // Convert double newlines to paragraphs
      .split('\n\n')
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .join('\n\n')
      // Preserve single line breaks
      .replace(/\n/g, '<br/>');
  };

  const handleSave = async () => {
    if (!validateStep(3)) {
      toast({
        title: "Validation Error",
        description: "Please fix the validation errors before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const jobData: any = {
        text: description.trim(),
        url: url.trim(),
        company: company.trim(),
        role: role.trim(),
      };

      // Add resume info if uploaded
      if (uploadedResumes.length > 0) {
        const resume = uploadedResumes[0];
        jobData.resume_id = resume.id;
        jobData.resume_filename = resume.base_filename;
        
        // Add extracted text for interview prep mode
        const activeVersion = resume.versions?.find(v => v.is_active);
        if (activeVersion?.extracted_text && activeVersion.extraction_status === 'success') {
          jobData.resumeTextExtracted = activeVersion.extracted_text;
          jobData.resumeTextSource = 'extracted';
        }
      }

      const response = await fetch('/api/save-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save job');
      }

      const result = await response.json();
      
      clearDraft();
      
      toast({
        title: "Job Saved!",
        description: `Job application for ${company} - ${role} has been saved successfully.`,
      });

      // Reset form and clear preselected resume state
      setUrl('');
      setCompany('');
      setRole('');
      setDescription('');
      setYourName('');
      setUploadedResumes([]);
      setCurrentStep(1);
      // Clear preselected resume state
      setPreselectedResume(null);
      setAriaLiveMessage('Job application saved successfully. Form has been reset.');

      onJobSaved?.();

    } catch (error) {
      console.error('Error saving job:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save job application",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Job Details</CardTitle>
              <CardDescription>
                Enter the essential information and paste the job description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preselected Resume Banner */}
              {preselectedResume && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800">Resume preselected: {preselectedResume.filename}</h4>
                      <p className="text-sm text-green-700 mt-1">
                        This resume will be automatically attached in the Resume step.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Basic Info Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Job URL *
                  </label>
                  <Input
                    ref={urlFieldRef}
                    type="url"
                    placeholder="https://company.com/careers/job-posting"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={validationErrors.url ? 'border-red-500' : ''}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste the job posting link so you can revisit it later.
                  </p>
                  {validationErrors.url && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.url}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Company *
                    </label>
                    <Input
                      ref={companyFieldRef}
                      placeholder="Company name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className={validationErrors.company ? 'border-red-500' : ''}
                    />
                    {validationErrors.company && (
                      <p className="text-xs text-red-500 mt-1">{validationErrors.company}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Role *
                    </label>
                    <Input
                      ref={roleFieldRef}
                      placeholder="Job title/position"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className={validationErrors.role ? 'border-red-500' : ''}
                    />
                    {validationErrors.role && (
                      <p className="text-xs text-red-500 mt-1">{validationErrors.role}</p>
                    )}
                  </div>
                </div>

                {url && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <ExternalLink className="h-4 w-4" />
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate"
                    >
                      {url}
                    </a>
                  </div>
                )}
              </div>

              {/* Job Description Section */}
              <div className="border-t pt-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Job Description *
                  </label>
                  <Textarea
                    placeholder="Paste the job description here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`min-h-[300px] ${validationErrors.description ? 'border-red-500' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste the text from the posting. Line breaks and formatting will be preserved.
                  </p>
                  {validationErrors.description && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.description}</p>
                  )}
                </div>

                {description && (
                  <div className="flex justify-between items-center mt-3">
                    <div className="text-xs text-muted-foreground">
                      Character count: {description.length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {showMarkdownPreview ? 'Hide' : 'Show'} Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDescription('')}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                {description && showMarkdownPreview && (
                  <div className="mt-4 p-4 border rounded-md bg-muted">
                    <h4 className="text-sm font-medium mb-2">Formatted Preview</h4>
                    <div 
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: formatDescriptionForPreview(description)
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Personal Details & Resume</CardTitle>
              <CardDescription>
                Add your name for resume filename mapping and optionally upload your resume.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Your Name (Optional)
                </label>
                <Input
                  placeholder="Your full name"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for resume filename mapping (e.g., "Company_Role_YourName_Date.pdf")
                </p>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-medium mb-3">Resume Upload (Optional)</h4>
                <div className="space-y-3">
                  {(!company || !role) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-sm text-amber-800">
                        Please fill in Company and Role in Step 1 before uploading a resume.
                      </p>
                    </div>
                  )}
                  
                  {company && role && (
                    <ResumeUpload
                      jobUuid={tempJobUuid} // Temporary UUID for uploads before job is saved
                      company={company}
                      role={role}
                      yourName={yourName}
                      onUploadComplete={(resume) => {
                        setUploadedResumes([resume]);
                        toast({
                          title: "Resume Uploaded",
                          description: "Resume has been uploaded and will be linked to this job.",
                        });
                      }}
                    />
                  )}

                  {uploadedResumes.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Uploaded Resume Preview
                      </h4>
                      <ResumeViewer 
                        resume={uploadedResumes[0]}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Review & Save</CardTitle>
              <CardDescription>
                Review your job application details before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Company</label>
                    <p className="font-medium">{company}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Role</label>
                    <p className="font-medium">{role}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">URL</label>
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Posting
                    </a>
                  </div>
                  {yourName && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Your Name</label>
                      <p className="font-medium">{yourName}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resume</label>
                  {uploadedResumes.length > 0 ? (
                    <p className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {uploadedResumes[0].base_filename}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No resume uploaded</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Job Description Preview</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {showMarkdownPreview ? 'Raw' : 'Formatted'}
                  </Button>
                </div>
                
                {showMarkdownPreview ? (
                  <div 
                    className="p-4 border rounded-md bg-muted text-sm max-h-48 overflow-y-auto prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: formatDescriptionForPreview(description)
                    }}
                  />
                ) : (
                  <div className="p-4 border rounded-md bg-muted text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {description.substring(0, 1000)}
                    {description.length > 1000 && '...'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Screen reader aria-live region */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {ariaLiveMessage}
      </div>

      {/* Draft Prompt Dialog */}
      {showDraftPrompt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Resume Draft Detected</CardTitle>
            <CardDescription>
              You have an existing job draft and a preselected resume. What would you like to do?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button
                onClick={handleContinueDraft}
                className="w-full justify-start"
                variant="outline"
              >
                <div className="text-left">
                  <div className="font-medium">Continue Draft</div>
                  <div className="text-sm text-muted-foreground">
                    Keep existing fields and add preselected resume
                  </div>
                </div>
              </Button>
              <Button
                onClick={handleStartNew}
                className="w-full justify-start"
                variant="outline"
              >
                <div className="text-left">
                  <div className="font-medium">Start New</div>
                  <div className="text-sm text-muted-foreground">
                    Discard draft and keep preselected resume
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === currentStep
                  ? 'bg-blue-600 text-white'
                  : step < currentStep
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Step {currentStep} of 3
        </div>
      </div>

      {/* Current step content */}
      {renderStep()}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrevStep}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              className="ml-2"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="space-x-2">
          {currentStep < 3 ? (
            <Button onClick={handleNextStep}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Job Application'}
            </Button>
          )}
        </div>
      </div>

      {/* Recent Captures - shown only on first step */}
      {currentStep === 1 && (
        <div className="mt-8 pt-6 border-t">
          <RecentCaptures 
            onApplicationAdded={(application) => {
              // Auto-fill form with data from captured job
              if (application.source_url) setUrl(application.source_url);
              if (application.company) setCompany(application.company);
              if (application.role) setRole(application.role);
              if (application.jd_text) setDescription(application.jd_text);
              
              // Move to step 2 since basics are filled
              setCurrentStep(2);
              
              toast({
                title: "Job Details Loaded",
                description: "Form has been pre-filled with captured job details.",
              });
            }}
          />
        </div>
      )}
    </div>
  );
}