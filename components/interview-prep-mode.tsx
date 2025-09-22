'use client';

import { useState, useEffect } from 'react';
import { JobDescription } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResumeViewer } from '@/components/resume/resume-viewer';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Presentation, 
  FileText, 
  User, 
  ClipboardList, 
  Download, 
  Save,
  Building, 
  Briefcase,
  Calendar,
  Timer,
  Eye,
  EyeOff,
  ExternalLink,
  FileDown,
  FolderOpen,
  Focus
} from 'lucide-react';
import { resumeManager } from '@/lib/resume-management';
import { detectFileKind, getFileKindDisplayInfo } from '@/utils/files';

interface InterviewPrepModeProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription;
}

interface InterviewNotes {
  keyPoints: string;
  questionsToAsk: string;
  personalExperiences: string;
  companyResearch: string;
  technicalPrep: string;
}

interface ResumeVersion {
  id: string;
  filename: string;
  path: string;
  uploaded_at: string;
  is_active: boolean;
  mime_type?: string; // Add MIME type for file detection
}

interface JobResume {
  resume_id?: string;
  resume_filename?: string;
  resume_path?: string;
}

export function InterviewPrepMode({ isOpen, onClose, job }: InterviewPrepModeProps) {
  const [notes, setNotes] = useState<InterviewNotes>({
    keyPoints: '',
    questionsToAsk: '',
    personalExperiences: '',
    companyResearch: '',
    technicalPrep: ''
  });
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [jdVisible, setJdVisible] = useState(true);
  const [resumeVisible, setResumeVisible] = useState(true);
  const [notesVisible, setNotesVisible] = useState(true);
  const [resumeText, setResumeText] = useState<string>('');
  const [isLoadingResumeText, setIsLoadingResumeText] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && job) {
      loadInterviewData();
    }
  }, [isOpen, job]);

  const loadResumeText = async (resumePath: string) => {
    if (!resumePath || resumePath.startsWith('blob:')) {
      setResumeText('');
      return;
    }

    // First check if we have saved resume text (manual or extracted)
    if (job.resumeTextManual) {
      setResumeText(job.resumeTextManual);
      return;
    }
    
    if (job.resumeTextExtracted) {
      setResumeText(job.resumeTextExtracted);
      return;
    }

    // If no saved text, try to extract from file
    setIsLoadingResumeText(true);
    try {
      const response = await fetch('/api/resume/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: resumePath })
      });

      if (response.ok) {
        const data = await response.json();
        setResumeText(data.text || '');
      } else {
        const errorData = await response.json();
        console.warn('Failed to extract resume text:', errorData);
        setResumeText('');
      }
    } catch (error) {
      console.error('Error loading resume text:', error);
      setResumeText('');
    } finally {
      setIsLoadingResumeText(false);
    }
  };

  const selectResume = async (resume: ResumeVersion | null) => {
    setSelectedResume(resume);
    if (resume && resume.path) {
      await loadResumeText(resume.path);
    } else {
      setResumeText('');
    }
  };

  const loadInterviewData = async () => {
    setIsLoading(true);
    try {

      // Load existing interview notes
      const notesKey = `interview_prep_${job.uuid}`;
      const savedNotes = localStorage.getItem(notesKey);
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }

      // Load resume text directly from job record if available
      console.log('Interview Prep: Loading resume text for job:', {
        uuid: job.uuid,
        hasManualText: !!job.resumeTextManual,
        hasExtractedText: !!job.resumeTextExtracted,
        manualTextLength: job.resumeTextManual?.length || 0,
        extractedTextLength: job.resumeTextExtracted?.length || 0,
        resumeSource: job.resumeTextSource,
        resumeFilename: job.resume_filename
      });

      if (job.resumeTextManual) {
        console.log('Setting manual resume text, preview:', job.resumeTextManual.substring(0, 100) + '...');
        setResumeText(job.resumeTextManual);
      } else if (job.resumeTextExtracted) {
        console.log('Setting extracted resume text, preview:', job.resumeTextExtracted.substring(0, 100) + '...');
        setResumeText(job.resumeTextExtracted);
      } else {
        console.log('No resume text found in job data');
        setResumeText('');
      }

      // Load resume information for this job
      try {
        // Check if job has an active resume version ID set
        if (job.active_resume_version_id) {
          console.log('Interview Prep: Found active_resume_version_id:', job.active_resume_version_id);
          
          // Load the resume manifest for this job to find the active version
          const resumeManifest = await resumeManager.getResumeForJob(job.uuid);
          if (resumeManifest) {
            const resumeVersions = resumeManifest.versions.map(v => ({
              id: v.version_id,
              filename: resumeManifest.base_filename + resumeManifest.file_extension,
              path: v.managed_path,
              uploaded_at: v.upload_timestamp,
              is_active: v.version_id === job.active_resume_version_id,
              mime_type: v.mime_type
            }));
            setResumeVersions(resumeVersions);
            
            // Find and select the version that matches the active_resume_version_id
            const activeResume = resumeVersions.find(v => v.id === job.active_resume_version_id);
            if (activeResume) {
              console.log('Interview Prep: Auto-selecting active resume version:', activeResume.filename);
              await selectResume(activeResume);
            }
          }
        } else if (job.resume_id) {
          // Fallback: Check if job has a resume mapped to it (legacy approach)
          const resumeManifest = await resumeManager.getResumeForJob(job.uuid);
          if (resumeManifest) {
            const resumeVersions = resumeManifest.versions.map(v => ({
              id: v.version_id,
              filename: resumeManifest.base_filename + '.' + resumeManifest.file_extension,
              path: v.managed_path,
              uploaded_at: v.upload_timestamp,
              is_active: v.is_active,
              mime_type: v.mime_type
            }));
            setResumeVersions(resumeVersions);
            
            // Select the active resume by default
            const activeResume = resumeVersions.find(v => v.is_active);
            if (activeResume) {
              await selectResume(activeResume);
            }
          }
        }
        
        // Also try to load from API as fallback
        try {
          const response = await fetch(`/api/resume/versions?jobUuid=${job.uuid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.versions && data.versions.length > 0) {
              setResumeVersions(prev => prev.length > 0 ? prev : data.versions);
              
              if (!selectedResume) {
                const activeResume = data.versions.find((v: ResumeVersion) => v.is_active);
                if (activeResume) {
                  await selectResume(activeResume);
                }
              }
            }
          }
        } catch (error) {
          console.warn('API resume load failed:', error);
        }
      } catch (error) {
        console.warn('Failed to load resume versions:', error);
      }
    } catch (error) {
      console.error('Failed to load interview data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotes = async () => {
    setIsSaving(true);
    try {
      const notesKey = `interview_prep_${job.uuid}`;
      localStorage.setItem(notesKey, JSON.stringify(notes));
      
      toast({
        title: "Notes saved",
        description: "Your interview preparation notes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save your notes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPrepPack = async () => {
    try {
      // Create a comprehensive prep pack
      const prepPack = {
        job: {
          company: job.company,
          role: job.role,
          appliedDate: job.applied_date,
          status: job.application_status
        },
        jobDescription: job.jd_text,
        notes: notes,
        resumeUsed: selectedResume?.filename,
        preparedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(prepPack, null, 2)], { 
        type: 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview_prep_${job.company}_${job.role}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Prep pack downloaded",
        description: "Your complete interview preparation has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download prep pack.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: JobDescription['application_status']) => {
    switch (status) {
      case 'applied': return 'bg-blue-100 text-blue-800';
      case 'interviewing': return 'bg-yellow-100 text-yellow-800';
      case 'offer': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'withdrawn': return 'bg-gray-100 text-gray-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  if (!job) return null;

  const handleOpenJD = () => {
    // Create a blob with the job description and open it
    const blob = new Blob([job.jd_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleOpenResume = async () => {
    console.log('handleOpenResume called:', { selectedResume, jobResumeId: job.resume_id });
    
    if (!selectedResume) {
      toast({
        title: "No resume selected",
        description: "Please select a resume to open.",
        variant: "destructive",
      });
      return;
    }

    // Try multiple approaches to open the resume
    let success = false;
    let errorMessage = "The resume file could not be opened.";

    // Approach 1: Use job.resume_id if available
    if (job.resume_id) {
      console.log('Trying to open resume with job.resume_id:', job.resume_id);
      success = await resumeManager.openResume(job.resume_id);
      if (success) {
        console.log('Successfully opened resume via resume manager');
        return;
      }
    }

    // Approach 2: Try opening with the selected resume's path directly
    if (selectedResume.path && selectedResume.path !== 'blob:') {
      console.log('Trying to open resume with selectedResume.path:', selectedResume.path);
      try {
        const response = await fetch('/api/file-actions/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: selectedResume.path })
        });
        
        if (response.ok) {
          console.log('Successfully opened resume via direct path');
          success = true;
          return;
        } else {
          const errorData = await response.json();
          console.log('Failed to open resume via direct path:', errorData);
          errorMessage = errorData.error || errorMessage;
        }
      } catch (error) {
        console.log('Error opening resume via direct path:', error);
      }
    }

    // Approach 3: Try to use the resume filename to find it in common locations
    if (job.resume_filename || selectedResume.filename) {
      const filename = job.resume_filename || selectedResume.filename;
      console.log('Trying to find resume by filename:', filename);
      
      // Common resume locations to check
      const possiblePaths = [
        `./managed-resumes/${filename}`,
        `./Resumes/${filename}`,
        `./${filename}`
      ];
      
      for (const path of possiblePaths) {
        try {
          const response = await fetch('/api/file-actions/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: path })
          });
          
          if (response.ok) {
            console.log('Successfully opened resume at path:', path);
            success = true;
            return;
          }
        } catch (error) {
          console.log('Failed to open resume at path:', path, error);
        }
      }
    }

    // If all approaches failed, show error
    if (!success) {
      console.log('All resume opening approaches failed');
      toast({
        title: "Unable to open resume",
        description: errorMessage + " The file may not exist or may not be accessible.",
        variant: "destructive",
      });
    }
  };

  const handleOpenResumeFile = async () => {
    if (!job.resumeTextPath) {
      toast({
        title: "No resume file path",
        description: "Resume text file path not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/file-actions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: job.resumeTextPath })
      });

      if (response.ok) {
        toast({
          title: "Resume file opened",
          description: "Opened resume text file in system viewer",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open resume file');
      }
    } catch (error) {
      console.error('Failed to open resume file:', error);
      toast({
        title: "Unable to open file",
        description: error instanceof Error ? error.message : 'Failed to open resume file',
        variant: "destructive",
      });
    }
  };

  const handleOpenFolder = async () => {
    try {
      const response = await fetch('/api/file-actions/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: './managed-resumes' })
      });

      if (response.ok) {
        toast({
          title: "Folder opened",
          description: "Opened managed-resumes folder",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open folder');
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      toast({
        title: "Unable to open folder",
        description: error instanceof Error ? error.message : 'Failed to open managed-resumes folder',
        variant: "destructive",
      });
    }
  };

  const handleRevealResume = async () => {
    if (!selectedResume || !selectedResume.path) {
      toast({
        title: "No resume selected",
        description: "Please select a resume to reveal in folder.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/file-actions/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedResume.path })
      });

      if (response.ok) {
        toast({
          title: "File location opened",
          description: `Opened file location for ${selectedResume.filename}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reveal file in folder');
      }
    } catch (error) {
      console.error('Failed to reveal resume in folder:', error);
      toast({
        title: "Unable to reveal file",
        description: error instanceof Error ? error.message : 'Failed to reveal file in folder',
        variant: "destructive",
      });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Presentation className="h-5 w-5" />
            Interview Prep: {job.company} - {job.role}
          </DialogTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge className={getStatusColor(job.application_status)}>
                {job.application_status || 'interested'}
              </Badge>
              <span className="text-sm text-gray-600">
                Applied: {formatDate(job.applied_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenJD}
                title="Open job description in new tab"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open JD
              </Button>
              {(job.resumeTextManual || job.resumeTextExtracted || selectedResume) && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResumeVisible(true);
                      setSelectedTab('side-by-side');
                      // Focus on resume text panel after a short delay
                      setTimeout(() => {
                        const resumePanel = document.querySelector('[data-resume-panel]');
                        if (resumePanel) {
                          resumePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 100);
                    }}
                    title="Focus the resume text panel"
                  >
                    <Focus className="h-4 w-4 mr-2" />
                    Reveal Text
                  </Button>
                  {job.resumeTextPath && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenResumeFile}
                      title="Open .txt file in system viewer"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Open .txt
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenFolder}
                    title="Open managed-resumes folder"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Folder
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={saveNotes}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Notes'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPrepPack}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Prep Pack
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Visibility Controls */}
            <div className="flex items-center gap-2 p-2 border-b">
              <span className="text-sm font-medium text-gray-600">Show/Hide:</span>
              <Button
                variant={jdVisible ? 'default' : 'outline'}
                size="sm"
                onClick={() => setJdVisible(!jdVisible)}
              >
                {jdVisible ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                Job Description
              </Button>
              <Button
                variant={resumeVisible ? 'default' : 'outline'}
                size="sm"
                onClick={() => setResumeVisible(!resumeVisible)}
              >
                {resumeVisible ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                Resume
              </Button>
              <Button
                variant={notesVisible ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNotesVisible(!notesVisible)}
              >
                {notesVisible ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                Prep Notes
              </Button>
            </div>

            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-4 mx-4 mt-4 flex-shrink-0">
                <TabsTrigger value="overview">
                  <Timer className="h-4 w-4 mr-2" />
                  Quick Review
                </TabsTrigger>
                <TabsTrigger value="detailed">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Detailed Prep
                </TabsTrigger>
                <TabsTrigger value="side-by-side">
                  <FileText className="h-4 w-4 mr-2" />
                  Side-by-Side
                </TabsTrigger>
                <TabsTrigger value="practice">
                  <User className="h-4 w-4 mr-2" />
                  Practice Mode
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden px-4 pb-4 min-h-0">
                {/* Quick Review Tab */}
                <TabsContent value="overview" className="h-full m-0">
                  <div className="h-full space-y-4 overflow-auto">
                    {/* Job Summary Card */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-blue-900">Job Summary</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Company:</strong> {job.company}</div>
                        <div><strong>Role:</strong> {job.role}</div>
                        <div><strong>Applied:</strong> {formatDate(job.applied_date)}</div>
                        <div><strong>Status:</strong> {job.application_status}</div>
                      </div>
                    </div>

                    {/* Key Points Quick View */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-900 mb-2">Key Points to Remember</h3>
                      <Textarea
                        placeholder="Add key points you want to remember during the interview..."
                        value={notes.keyPoints}
                        onChange={(e) => setNotes(prev => ({ ...prev, keyPoints: e.target.value }))}
                        className="min-h-[100px] bg-white"
                      />
                    </div>

                    {/* Questions to Ask */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-900 mb-2">Questions to Ask Them</h3>
                      <Textarea
                        placeholder="Prepare thoughtful questions to ask the interviewer..."
                        value={notes.questionsToAsk}
                        onChange={(e) => setNotes(prev => ({ ...prev, questionsToAsk: e.target.value }))}
                        className="min-h-[100px] bg-white"
                      />
                    </div>

                    {/* Resume Info */}
                    {resumeVersions.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h3 className="font-semibold text-orange-900 mb-2">Resume Used</h3>
                        <div className="space-y-2">
                          {resumeVersions.map((resume) => (
                            <div
                              key={resume.id}
                              className={`p-2 border rounded cursor-pointer transition-colors ${
                                selectedResume?.id === resume.id
                                  ? 'border-orange-400 bg-orange-100'
                                  : 'border-orange-200 hover:bg-orange-100'
                              }`}
                              onClick={() => selectResume(resume)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{resume.filename}</span>
                                {resume.is_active && (
                                  <Badge variant="outline" className="text-xs">Active</Badge>
                                )}
                              </div>
                              <span className="text-xs text-gray-600">
                                Uploaded: {formatDate(resume.uploaded_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Detailed Prep Tab */}
                <TabsContent value="detailed" className="h-full m-0">
                  <div className="h-full overflow-auto">
                    <div className="space-y-4 p-2">
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Personal Experiences & Examples</h3>
                        <Textarea
                          placeholder="Note specific experiences, projects, and examples that relate to this role..."
                          value={notes.personalExperiences}
                          onChange={(e) => setNotes(prev => ({ ...prev, personalExperiences: e.target.value }))}
                          className="min-h-[120px]"
                        />
                      </div>

                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Company Research</h3>
                        <Textarea
                          placeholder="Research about the company, recent news, values, culture..."
                          value={notes.companyResearch}
                          onChange={(e) => setNotes(prev => ({ ...prev, companyResearch: e.target.value }))}
                          className="min-h-[120px]"
                        />
                      </div>

                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Technical Preparation</h3>
                        <Textarea
                          placeholder="Technical concepts, coding challenges, system design topics..."
                          value={notes.technicalPrep}
                          onChange={(e) => setNotes(prev => ({ ...prev, technicalPrep: e.target.value }))}
                          className="min-h-[120px]"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Side-by-Side Tab */}
                <TabsContent value="side-by-side" className="h-full m-0">
                  <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
                    {/* Job Description Column */}
                    {jdVisible && (
                      <div className="border rounded-lg flex flex-col min-h-0 lg:min-h-[500px]">
                        <div className="p-3 border-b bg-gray-50 font-medium flex items-center justify-between flex-shrink-0">
                          <span>Job Description</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleOpenJD}
                            className="h-6 px-2"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex-1 p-4 overflow-auto min-h-0">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                            {job.jd_text || 'No job description available'}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Resume Column */}
                    {resumeVisible && (
                      <div className="border rounded-lg flex flex-col min-h-0 lg:min-h-[500px]" data-resume-panel>
                        <div className="p-3 border-b bg-gray-50 font-medium flex items-center justify-between flex-shrink-0">
                          <span>Resume{job.resumeTextSource === 'manual' ? ' (Pasted Text)' : selectedResume ? `: ${selectedResume.filename}` : ''}</span>
                          {(job.resumeTextManual || job.resumeTextExtracted || selectedResume) && (
                            <div className="flex items-center gap-1">
                              {job.resumeTextPath && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleOpenResumeFile}
                                  className="h-6 px-2"
                                  title="Open .txt file"
                                >
                                  <FileDown className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleOpenFolder}
                                className="h-6 px-2"
                                title="Open managed-resumes folder"
                              >
                                <FolderOpen className="h-3 w-3" />
                              </Button>
                              {selectedResume && selectedResume.path && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleRevealResume}
                                  className="h-6 px-2"
                                  title="Reveal original file"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-4 overflow-auto min-h-0">
                            {selectedResume ? (
                              <div className="space-y-4">
                                {isLoadingResumeText ? (
                                  <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                    <p className="text-sm text-gray-600">Extracting resume text...</p>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {/* Resume display interface */}
                                    <div className="border border-gray-200 rounded-lg bg-white">
                                      {/* Header with actions - always visible */}
                                      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                          Resume Content
                                          {job.resumeTextSource && (
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                              job.resumeTextSource === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                              {job.resumeTextSource === 'manual' ? 'Manual' : 'Extracted'}
                                            </span>
                                          )}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleOpenResume}
                                            className="h-6 px-2 text-xs"
                                            title="Open full resume file"
                                          >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Open
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleRevealResume}
                                            className="h-6 px-2 text-xs"
                                            title="Reveal in folder"
                                          >
                                            <FolderOpen className="h-3 w-3 mr-1" />
                                            Reveal
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {/* Resume content */}
                                      <div className="flex-1 p-4 overflow-auto min-h-0">
                                        {resumeText ? (() => {
                                          // Use robust file type detection
                                          const fileKind = detectFileKind({
                                            contentType: selectedResume?.mime_type,
                                            extension: selectedResume?.filename?.split('.').pop() || '',
                                          });
                                          const displayInfo = getFileKindDisplayInfo(fileKind);
                                          
                                          if (fileKind === 'pdf') {
                                            // For PDF files: Show "Open PDF File" interface only
                                            return (
                                              <div className="text-center py-8">
                                                <FileText className="h-16 w-16 mx-auto mb-4 text-red-400" />
                                                <h3 className="text-lg font-medium mb-2">📄 PDF Resume</h3>
                                                <p className="text-sm text-gray-600 mb-4">PDF files are best viewed in their original format.</p>
                                                <div className="space-y-2">
                                                  <Button
                                                    onClick={handleOpenResume}
                                                    className="mx-auto"
                                                    size="sm"
                                                  >
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    Open PDF File
                                                  </Button>
                                                  {selectedResume && (
                                                    <div className="mt-2">
                                                      <Button
                                                        onClick={() => {
                                                          if (selectedResume.path) {
                                                            window.open(`/api/resume/download?path=${encodeURIComponent(selectedResume.path)}`, '_blank');
                                                          }
                                                        }}
                                                        variant="outline"
                                                        size="sm"
                                                      >
                                                        <FileDown className="h-4 w-4 mr-2" />
                                                        Download PDF
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-3">
                                                  Click to open the full PDF resume for best viewing experience
                                                </p>
                                              </div>
                                            );
                                          } else {
                                            // For DOCX and other file types: Show extracted text
                                            return (
                                              <div 
                                                className="text-sm leading-relaxed text-gray-800"
                                                style={{
                                                  whiteSpace: 'pre-wrap',
                                                  wordWrap: 'break-word',
                                                  maxWidth: '65ch',
                                                  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                                  lineHeight: '1.6'
                                                }}
                                              >
                                              {resumeText}
                                            </div>
                                            );
                                          }
                                        })() : (
                                          <div className="text-center text-gray-500 py-8">
                                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm font-medium">No resume text yet. Paste it to view here.</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                              {job.extractionError 
                                                ? `Extraction failed: ${job.extractionError}`
                                                : selectedResume 
                                                  ? 'Resume file found but no text content available'
                                                  : 'Add resume text when creating applications to see it here'
                                              }
                                            </p>
                                            {job.resumeTextPath && (
                                              <p className="text-xs text-gray-400 mt-1">
                                                Use "Open .txt" button above to view the saved text file.
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Resume metadata */}
                                    <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                                      <div><span className="font-medium">File:</span> {selectedResume.filename}</div>
                                      <div><span className="font-medium">Uploaded:</span> {formatDate(selectedResume.uploaded_at)}</div>
                                      {selectedResume.is_active && (
                                        <div className="text-green-600 font-medium">✓ Active Resume</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : resumeText ? (
                              <div className="border border-gray-200 rounded-lg bg-white">
                                {/* Header with manual/extracted text indicator */}
                                <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    Resume Content {job.resumeTextSource === 'manual' ? '(Pasted Text)' : '(Extracted)'}
                                    {job.resumeTextSource && (
                                      <span className={`px-2 py-1 text-xs rounded-full ${
                                        job.resumeTextSource === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                      }`}>
                                        {job.resumeTextSource === 'manual' ? 'Manual' : 'Extracted'}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                
                                {/* Resume text content */}
                                <div className="flex-1 p-4 overflow-auto min-h-0">
                                  <div 
                                    className="text-sm leading-relaxed text-gray-800"
                                    style={{
                                      whiteSpace: 'pre-wrap',
                                      wordWrap: 'break-word',
                                      maxWidth: '65ch',
                                      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                      lineHeight: '1.6'
                                    }}
                                  >
                                    {resumeText}
                                  </div>
                                </div>
                              </div>
                            ) : job.resume_filename ? (
                              <div className="text-center py-8 text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Resume: {job.resume_filename}</p>
                                <p className="text-sm">Resume file mapped to this job</p>
                                <p className="text-xs text-gray-400 mt-2">Have a file? Paste the text for side-by-side prep.</p>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">No resume text yet</p>
                                <p className="text-sm text-gray-600">Paste it when adding an application to view here.</p>
                                <p className="text-xs text-gray-400 mt-2">Have a file? Paste the text for side-by-side prep.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Preparation Notes Column */}
                    {notesVisible && (
                      <div className="border rounded-lg flex flex-col min-h-0 lg:min-h-[500px]">
                        <div className="p-3 border-b bg-gray-50 font-medium flex-shrink-0">Preparation Notes</div>
                        <div className="flex-1 p-4 overflow-auto space-y-4 min-h-0">
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              Key Points
                            </h4>
                            <div className="text-sm bg-blue-50 p-3 rounded border-l-2 border-blue-200 whitespace-pre-wrap">
                              {notes.keyPoints || 'No key points added yet...'}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                              Questions to Ask
                            </h4>
                            <div className="text-sm bg-purple-50 p-3 rounded border-l-2 border-purple-200 whitespace-pre-wrap">
                              {notes.questionsToAsk || 'No questions prepared yet...'}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Personal Examples
                            </h4>
                            <div className="text-sm bg-green-50 p-3 rounded border-l-2 border-green-200 whitespace-pre-wrap">
                              {notes.personalExperiences || 'No examples noted yet...'}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                              Company Research
                            </h4>
                            <div className="text-sm bg-orange-50 p-3 rounded border-l-2 border-orange-200 whitespace-pre-wrap">
                              {notes.companyResearch || 'No research notes yet...'}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              Technical Prep
                            </h4>
                            <div className="text-sm bg-red-50 p-3 rounded border-l-2 border-red-200 whitespace-pre-wrap">
                              {notes.technicalPrep || 'No technical prep notes yet...'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Practice Mode Tab */}
                <TabsContent value="practice" className="h-full m-0">
                  <div className="h-full space-y-4 overflow-auto">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-900 mb-2">Practice Mode</h3>
                      <p className="text-yellow-800 text-sm mb-4">
                        Use this section to practice your responses. Common interview questions based on the job description:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="bg-white border border-yellow-200 rounded p-3">
                          <p className="font-medium text-sm">Why are you interested in this role at {job.company}?</p>
                          <div className="mt-2 text-xs text-gray-600">
                            Consider mentioning specific aspects from the job description and your research.
                          </div>
                        </div>
                        
                        <div className="bg-white border border-yellow-200 rounded p-3">
                          <p className="font-medium text-sm">What makes you qualified for this {job.role} position?</p>
                          <div className="mt-2 text-xs text-gray-600">
                            Reference your resume and the job requirements.
                          </div>
                        </div>
                        
                        <div className="bg-white border border-yellow-200 rounded p-3">
                          <p className="font-medium text-sm">Do you have any questions for us?</p>
                          <div className="mt-2 text-xs text-gray-600">
                            Use the questions you prepared in the "Questions to Ask" section.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">Additional Practice Notes</h3>
                      <Textarea
                        placeholder="Practice responses, mock interview notes, areas to improve..."
                        className="min-h-[150px]"
                      />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default InterviewPrepMode;