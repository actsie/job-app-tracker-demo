'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { JobDescription } from '@/lib/types';
import { 
  generateEmailDraft, 
  generateMailtoLink, 
  formatDateForTemplate,
  copyEmailToClipboard,
  validateEmailDraft,
  getPlaceholderInfo,
  EmailDraft,
  EmailTemplateData,
  EMAIL_TEMPLATES,
  EmailTemplate,
  processTemplate
} from '@/lib/email-templates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { 
  Mail, 
  Copy, 
  ExternalLink, 
  RotateCcw, 
  Edit,
  Check,
  AlertCircle,
  FileText,
  Info,
  Eye,
  EyeOff 
} from 'lucide-react';

interface EmailDraftEditorProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription;
}

interface EditableTemplateData extends EmailTemplateData {
  subject: string;
}

interface DraftStorage {
  templateData: EditableTemplateData;
  selectedTemplateId: string;
  body: string;
  isManuallyEdited: boolean;
  lastSaved: string;
}

export function EmailDraftEditor({ isOpen, onClose, job }: EmailDraftEditorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('standard-followup');
  const [templateData, setTemplateData] = useState<EditableTemplateData>({
    company: job.company || 'Unknown Company',
    role: job.role || 'Unknown Position',
    applicationDate: formatDateForTemplate(job.applied_date || job.fetched_at_iso),
    recruiterName: '',
    contactEmail: '',
    customMessage: '',
    subject: ''
  });
  const [emailBody, setEmailBody] = useState('');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [showPlaceholderInfo, setShowPlaceholderInfo] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Validate job data
  const validateJobData = useCallback((jobData: JobDescription) => {
    const errors: string[] = [];
    
    if (!jobData) {
      errors.push('Job data is missing');
      return { isValid: false, errors };
    }
    
    if (!jobData.uuid) {
      errors.push('Job UUID is missing');
    }
    
    if (!jobData.company?.trim()) {
      errors.push('Company name is missing');
    }
    
    if (!jobData.role?.trim()) {
      errors.push('Job role is missing');
    }
    
    if (!jobData.applied_date && !jobData.fetched_at_iso) {
      errors.push('Application date is missing');
    }
    
    return { isValid: errors.length === 0, errors };
  }, []);

  const generateInitialDraft = useCallback(() => {
    try {
      const initialData = {
        company: job.company || 'Unknown Company',
        role: job.role || 'Unknown Position', 
        applicationDate: formatDateForTemplate(job.applied_date || job.fetched_at_iso),
        recruiterName: '',
        contactEmail: '',
        customMessage: ''
      };
      
      const draft = generateEmailDraft(initialData, selectedTemplateId);
      
      // Validate the generated draft
      if (!draft || !draft.subject || !draft.body) {
        throw new Error('Failed to generate email draft');
      }
      
      setTemplateData({
        ...initialData,
        subject: draft.subject
      });
      setEmailBody(draft.body);
      setIsManuallyEdited(false);
      setIsDraftSaved(false);
      setValidationErrors([]);
    } catch (error) {
      console.error('Error generating initial draft:', error);
      setValidationErrors(['Failed to generate email draft']);
      
      // Set fallback values
      const fallbackData = {
        company: job.company || 'Unknown Company',
        role: job.role || 'Unknown Position',
        applicationDate: formatDateForTemplate(job.applied_date || job.fetched_at_iso),
        recruiterName: '',
        contactEmail: '',
        customMessage: '',
        subject: `Follow-up: ${job.role || 'Application'} at ${job.company || 'Company'}`
      };
      
      setTemplateData(fallbackData);
      setEmailBody('There was an error generating the email template. Please edit manually.');
      setIsManuallyEdited(false);
      setIsDraftSaved(false);
    }
  }, [job, selectedTemplateId]);

  // Load saved draft for this job on mount
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadDraft = async () => {
      setIsLoading(true);
      
      try {
        // Validate job data first
        const validation = validateJobData(job);
        if (!validation.isValid) {
          console.error('Invalid job data for email draft:', validation.errors);
          setValidationErrors(validation.errors);
          return;
        }

        if (job.uuid) {
          const savedDraft = localStorage.getItem(`email_draft_${job.uuid}`);
          if (savedDraft) {
            try {
              const parsed: DraftStorage = JSON.parse(savedDraft);
              
              // Validate parsed data structure
              if (!parsed || typeof parsed !== 'object') {
                throw new Error('Invalid saved draft format');
              }
              
              // Check if the saved draft has essential content (subject and body)
              const hasValidContent = parsed.templateData?.subject && parsed.body;
              
              if (hasValidContent) {
                setTemplateData(parsed.templateData || {
                  company: job.company || 'Unknown Company',
                  role: job.role || 'Unknown Position',
                  applicationDate: formatDateForTemplate(job.applied_date || job.fetched_at_iso),
                  recruiterName: '',
                  contactEmail: '',
                  customMessage: '',
                  subject: ''
                });
                setSelectedTemplateId(parsed.selectedTemplateId || 'standard-followup');
                setEmailBody(parsed.body || '');
                setIsManuallyEdited(parsed.isManuallyEdited || false);
                setIsDraftSaved(true);
                setValidationErrors([]);
              } else {
                // Saved draft is incomplete, generate a fresh one
                console.log('Saved draft incomplete, generating fresh draft');
                localStorage.removeItem(`email_draft_${job.uuid}`);
                generateInitialDraft();
              }
            } catch (error) {
              console.error('Error parsing saved email draft:', error);
              // Clear corrupted draft
              localStorage.removeItem(`email_draft_${job.uuid}`);
              generateInitialDraft();
            }
          } else {
            generateInitialDraft();
          }
        }
      } catch (error) {
        console.error('Error loading draft:', error);
        setValidationErrors(['Failed to load email draft']);
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [isOpen, job, validateJobData, generateInitialDraft]);

  // Auto-save draft whenever content changes
  useEffect(() => {
    if (isOpen && job.uuid) {
      const draftToSave: DraftStorage = {
        templateData,
        selectedTemplateId,
        body: emailBody,
        isManuallyEdited,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(`email_draft_${job.uuid}`, JSON.stringify(draftToSave));
      setIsDraftSaved(true);

      // Validate the current draft
      const currentDraft: EmailDraft = {
        subject: templateData.subject,
        body: emailBody,
        to: templateData.contactEmail
      };
      const validation = validateEmailDraft(currentDraft);
      setValidationErrors(validation.errors);
    }
  }, [templateData, emailBody, isManuallyEdited, selectedTemplateId, isOpen, job.uuid]);

  const handleTemplateChange = (newTemplateId: string) => {
    setSelectedTemplateId(newTemplateId);
    
    // If content hasn't been manually edited, regenerate with new template
    if (!isManuallyEdited) {
      const newDraft = generateEmailDraft(templateData, newTemplateId);
      setEmailBody(newDraft.body);
      setTemplateData(prev => ({
        ...prev,
        subject: newDraft.subject
      }));
    }
  };

  const handleTemplateDataChange = (field: keyof EmailTemplateData, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // If changing core fields and content hasn't been manually edited, regenerate
    if (!isManuallyEdited && ['company', 'role', 'applicationDate', 'recruiterName', 'customMessage'].includes(field)) {
      const newDraft = generateEmailDraft({
        ...templateData,
        [field]: value
      }, selectedTemplateId);
      setEmailBody(newDraft.body);
      setTemplateData(prev => ({
        ...prev,
        subject: newDraft.subject
      }));
    }
  };

  const handleSubjectChange = (value: string) => {
    setTemplateData(prev => ({
      ...prev,
      subject: value
    }));
    setIsManuallyEdited(true);
  };

  const handleBodyChange = (value: string) => {
    setEmailBody(value);
    setIsManuallyEdited(true);
  };

  const handleResetToTemplate = () => {
    const newDraft = generateEmailDraft(templateData, selectedTemplateId);
    setEmailBody(newDraft.body);
    setTemplateData(prev => ({
      ...prev,
      subject: newDraft.subject
    }));
    setIsManuallyEdited(false);
    toast({
      title: 'Template reset',
      description: `Email draft has been reset to the "${EMAIL_TEMPLATES.find(t => t.id === selectedTemplateId)?.name}" template.`
    });
  };

  const handleCopyToClipboard = async () => {
    const currentDraft: EmailDraft = {
      subject: templateData.subject,
      body: emailBody,
      to: templateData.contactEmail
    };

    const success = await copyEmailToClipboard(currentDraft);
    
    if (success) {
      toast({
        title: 'Copied to clipboard',
        description: 'Email content copied to clipboard with proper formatting.'
      });
    } else {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy to clipboard. Please select and copy manually.',
        variant: 'destructive'
      });
    }
  };

  const handleOpenInMailClient = () => {
    const draft: EmailDraft = {
      subject: templateData.subject,
      body: emailBody,
      to: templateData.contactEmail || undefined
    };
    
    // Validate before opening
    const validation = validateEmailDraft(draft);
    if (!validation.isValid) {
      toast({
        title: 'Cannot open email client',
        description: validation.errors.join(', '),
        variant: 'destructive'
      });
      return;
    }
    
    const mailtoLink = generateMailtoLink(draft);
    
    try {
      window.open(mailtoLink, '_blank');
      toast({
        title: 'Opening email client',
        description: 'Email draft opened in your default mail application.'
      });
    } catch (error) {
      toast({
        title: 'Failed to open email client',
        description: 'Please copy the email content and manually open your email client.',
        variant: 'destructive'
      });
    }
  };

  const handleClose = () => {
    setIsManuallyEdited(false);
    onClose();
  };

  const selectedTemplate = EMAIL_TEMPLATES.find(t => t.id === selectedTemplateId) || EMAIL_TEMPLATES[0];
  const placeholderInfo = getPlaceholderInfo();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Follow-up Email Draft - {job.company} {job.role}
            {isDraftSaved && (
              <div title="Draft auto-saved" className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Saved</span>
              </div>
            )}
            {validationErrors.length > 0 && (
              <div title={validationErrors.join(', ')} className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600">Issues</span>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Loading email draft...</span>
          </div>
        )}

        {/* Error State */}
        {validationErrors.length > 0 && !isLoading && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 text-sm font-medium mb-2">
              <AlertCircle className="h-4 w-4" />
              Email Draft Issues
            </div>
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setValidationErrors([]);
                  generateInitialDraft();
                }}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Fill Fields
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setValidationErrors([]);
                }}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                Clear Errors
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!isLoading && (
          <div className="space-y-6">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">Email Template</Label>
            <div className="flex gap-2">
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-gray-500">{template.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPlaceholderInfo(!showPlaceholderInfo)}
              >
                {showPlaceholderInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-1">Info</span>
              </Button>
            </div>
            
            {showPlaceholderInfo && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-2">
                  <Info className="h-4 w-4" />
                  Placeholder Information
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(placeholderInfo).map(([key, description]) => (
                    <div key={key} className="flex gap-2">
                      <code className="text-blue-700 bg-blue-100 px-1 rounded text-xs">
                        {`{{${key}}}`}
                      </code>
                      <span className="text-blue-700">{description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Template Data Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                value={templateData.company}
                onChange={(e) => handleTemplateDataChange('company', e.target.value)}
                placeholder="Company name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                value={templateData.role}
                onChange={(e) => handleTemplateDataChange('role', e.target.value)}
                placeholder="Job title/position"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="applicationDate">Application Date *</Label>
              <Input
                id="applicationDate"
                value={templateData.applicationDate}
                onChange={(e) => handleTemplateDataChange('applicationDate', e.target.value)}
                placeholder="When you applied"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={templateData.contactEmail}
                onChange={(e) => handleTemplateDataChange('contactEmail', e.target.value)}
                placeholder="recruiter@company.com"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="recruiterName">Recruiter Name</Label>
              <Input
                id="recruiterName"
                value={templateData.recruiterName}
                onChange={(e) => handleTemplateDataChange('recruiterName', e.target.value)}
                placeholder="Recruiter or hiring manager name"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customMessage">Custom Message</Label>
              <Textarea
                id="customMessage"
                value={templateData.customMessage}
                onChange={(e) => handleTemplateDataChange('customMessage', e.target.value)}
                placeholder="Add any specific details or additional context"
                rows={3}
              />
            </div>
          </div>

          {/* Email Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              value={templateData.subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              placeholder="Email subject line"
              required
            />
          </div>

          {/* Email Body Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="emailBody">Email Body *</Label>
              <div className="flex items-center gap-2">
                {isManuallyEdited && (
                  <div className="flex items-center gap-1 text-sm text-blue-600">
                    <Edit className="h-4 w-4" />
                    <span>Manually edited</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToTemplate}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset to Template
                </Button>
              </div>
            </div>
            <Textarea
              id="emailBody"
              value={emailBody}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="Email content will appear here..."
              rows={20}
              className="font-mono text-sm"
              required
            />
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 text-sm font-medium mb-2">
                <AlertCircle className="h-4 w-4" />
                Please fix these issues:
              </div>
              <ul className="text-red-700 text-sm space-y-1 mb-3">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setValidationErrors([]);
                  generateInitialDraft();
                }}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Fill Fields
              </Button>
            </div>
          )}

          {/* Template Preview Info */}
          {!isManuallyEdited && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-2">
                <FileText className="h-4 w-4" />
                Using "{selectedTemplate.name}" Template
              </div>
              <div className="text-blue-700 text-sm">
                {selectedTemplate.description}. The email content automatically updates when you change the fields above. 
                Once you edit the subject or body directly, auto-updating will stop.
              </div>
            </div>
          )}
        </div>
        )}

        <DialogFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCopyToClipboard}
            disabled={validationErrors.length > 0}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button 
            onClick={handleOpenInMailClient}
            disabled={validationErrors.length > 0}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Mail App
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}