'use client';

import { useState, useEffect } from 'react';
import { JobDescription, ExtractionCandidate } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Save, 
  ArrowRight, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  Check,
  Lightbulb
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  capture: JobDescription;
  onApplicationAdded?: (application: JobDescription) => void;
  onNavigateToResume?: (application: JobDescription) => void;
}

export function QuickAddModal({ 
  isOpen, 
  onClose, 
  capture, 
  onApplicationAdded,
  onNavigateToResume 
}: QuickAddModalProps) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isOptionalOpen, setIsOptionalOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [duplicateFound, setDuplicateFound] = useState<JobDescription | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [roleCandidates, setRoleCandidates] = useState<ExtractionCandidate[]>([]);
  const [companyCandidates, setCompanyCandidates] = useState<ExtractionCandidate[]>([]);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const { toast } = useToast();

  // Initialize form with capture data
  useEffect(() => {
    if (isOpen && capture) {
      setCompany(capture.company || '');
      setRole(capture.role || '');
      setDescription(capture.jd_text || '');
      setSourceUrl(capture.source_url || '');
      setLocation(''); // These aren't typically in captures
      setSalary('');
      setTags('');
      setHasUnsavedChanges(false);
      
      // Set candidates if available
      if (capture.roleCandidates) {
        setRoleCandidates(capture.roleCandidates);
        // Show suggestions if we have multiple good candidates
        setShowRoleSuggestions(capture.roleCandidates.length > 1 && capture.roleCandidates[0]?.confidence < 0.9);
      } else {
        setRoleCandidates([]);
        setShowRoleSuggestions(false);
      }
      
      if (capture.companyCandidates) {
        setCompanyCandidates(capture.companyCandidates);
        // Show suggestions if we have multiple good candidates
        setShowCompanySuggestions(capture.companyCandidates.length > 1 && capture.companyCandidates[0]?.confidence < 0.9);
      } else {
        setCompanyCandidates([]);
        setShowCompanySuggestions(false);
      }
      
      // Check for duplicates by URL
      if (capture.source_url) {
        checkForDuplicates(capture.source_url);
      }
    }
  }, [isOpen, capture]);

  const checkForDuplicates = async (url: string) => {
    setIsDuplicateChecking(true);
    try {
      const response = await fetch(`/api/jobs?source_url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.jobs && data.jobs.length > 0) {
          setDuplicateFound(data.jobs[0]);
        }
      }
    } catch (error) {
      console.warn('Duplicate check failed:', error);
    } finally {
      setIsDuplicateChecking(false);
    }
  };

  const handleInputChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHasUnsavedChanges(true);
  };

  const cleanFormatting = () => {
    // Basic text cleanup: remove excessive whitespace, normalize line breaks
    let cleaned = description
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple line breaks to double
      .trim();
    
    setDescription(cleaned);
    setHasUnsavedChanges(true);
    toast({
      title: "Formatting cleaned",
      description: "Text has been cleaned and normalized",
    });
  };

  const clearDescription = () => {
    setDescription('');
    setHasUnsavedChanges(true);
    toast({
      title: "Description cleared",
      description: "You can now paste or type new content",
    });
  };

  const reparseFromUrl = async () => {
    if (!sourceUrl.trim()) {
      toast({
        title: "No URL provided",
        description: "Enter a URL first to re-parse content",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job data');
      }

      const data = await response.json();
      
      // Update fields with new data
      if (data.company) setCompany(data.company);
      if (data.role) setRole(data.role);
      if (data.jd_text) setDescription(data.jd_text);
      
      // Update candidates with fresh data
      if (data.roleCandidates) {
        setRoleCandidates(data.roleCandidates);
        setShowRoleSuggestions(data.roleCandidates.length > 1);
      }
      if (data.companyCandidates) {
        setCompanyCandidates(data.companyCandidates);
        setShowCompanySuggestions(data.companyCandidates.length > 1);
      }
      
      setHasUnsavedChanges(true);
      toast({
        title: "Re-parsed successfully",
        description: "Job data has been updated from URL with enhanced extraction",
      });
    } catch (error) {
      toast({
        title: "Re-parse failed",
        description: "Could not fetch fresh data from URL",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectRoleCandidate = (candidate: ExtractionCandidate) => {
    setRole(candidate.value);
    setHasUnsavedChanges(true);
    setShowRoleSuggestions(false);
    toast({
      title: "Role selected",
      description: `Selected: ${candidate.value} (${Math.round(candidate.confidence * 100)}% confidence)`,
    });
  };

  const selectCompanyCandidate = (candidate: ExtractionCandidate) => {
    setCompany(candidate.value);
    setHasUnsavedChanges(true);
    setShowCompanySuggestions(false);
    toast({
      title: "Company selected",
      description: `Selected: ${candidate.value} (${Math.round(candidate.confidence * 100)}% confidence)`,
    });
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getSourceBadgeColor = (source: string) => {
    const colors: Record<string, string> = {
      'structured-data': 'bg-blue-100 text-blue-800',
      'meta-tags': 'bg-purple-100 text-purple-800',
      'page-title': 'bg-indigo-100 text-indigo-800',
      'page-chrome': 'bg-teal-100 text-teal-800',
      'url-pattern': 'bg-orange-100 text-orange-800',
      'text-patterns': 'bg-gray-100 text-gray-800',
      'ner-fallback': 'bg-pink-100 text-pink-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const handleSaveAsDraft = async () => {
    await saveApplication('saved');
  };

  const handleSaveAndContinue = async () => {
    const savedApp = await saveApplication('applied');
    if (savedApp && onNavigateToResume) {
      onNavigateToResume(savedApp);
    }
  };

  const saveApplication = async (status: JobDescription['application_status'] = 'saved'): Promise<JobDescription | null> => {
    if (!company.trim() || !role.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both company and role",
        variant: "destructive",
      });
      // Auto-focus first empty field
      const companyInput = document.getElementById('quick-company') as HTMLInputElement;
      const roleInput = document.getElementById('quick-role') as HTMLInputElement;
      if (!company.trim() && companyInput) companyInput.focus();
      else if (!role.trim() && roleInput) roleInput.focus();
      return null;
    }

    setIsSaving(true);

    try {
      // Create final job description text
      const jdText = description.trim() || `${role.trim()} at ${company.trim()}
      
Company: ${company.trim()}
Role: ${role.trim()}
${location.trim() ? `Location: ${location.trim()}` : ''}
${salary.trim() ? `Salary: ${salary.trim()}` : ''}
${sourceUrl.trim() ? `Source: ${sourceUrl.trim()}` : ''}

[Job description to be added]`;

      // Save using the same API as AddApplication
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

      const newApplication: JobDescription = {
        uuid: data.uuid,
        company: company.trim(),
        role: role.trim(),
        jd_text: jdText,
        source_url: sourceUrl.trim() || null,
        fetched_at_iso: new Date().toISOString(),
        content_hash: data.content_hash || '',
        capture_method: capture.capture_method || 'browser_helper',
        captured_at: capture.captured_at || new Date().toISOString(),
        application_status: status,
        applied_date: status === 'applied' ? new Date().toISOString().split('T')[0] : undefined,
        last_updated: new Date().toISOString(),
      };

      // Update with application status if not just saved
      if (status !== 'saved') {
        try {
          await fetch(`/api/jobs/${data.uuid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              application_status: status,
              applied_date: status === 'applied' ? newApplication.applied_date : undefined,
            }),
          });
        } catch (error) {
          console.warn('Error updating job status:', error);
        }
      }

      // Save to localStorage
      const storageKey = `job_${newApplication.uuid}`;
      localStorage.setItem(storageKey, JSON.stringify(newApplication));

      onApplicationAdded?.(newApplication);

      const actionText = status === 'applied' ? 'application added' : 'job saved as draft';
      toast({
        title: status === 'applied' ? "Application added!" : "Saved as draft",
        description: `${company.trim()} - ${role.trim()} has been ${actionText}`,
      });

      setHasUnsavedChanges(false);
      onClose();
      return newApplication;

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: "Could not save the application. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        onClose();
        setHasUnsavedChanges(false);
      }
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveAndContinue();
    }
  };

  const isDescriptionShort = description.trim().length < 50;

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Quick Add from Capture</span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {capture.capture_method === 'browser_helper' ? 'Browser Helper' : 'URL Fetch'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Duplicate Warning */}
        {duplicateFound && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Possible duplicate found</span>
            </div>
            <div className="text-sm text-amber-700 mt-1">
              {duplicateFound.company} - {duplicateFound.role} ({duplicateFound.application_status})
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => {/* Open existing */}}>
                Open Existing
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDuplicateFound(null)}>
                Create New
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Source URL Display */}
          {sourceUrl && (
            <div className="bg-gray-50 rounded-lg p-3">
              <Label className="text-sm font-medium text-gray-700">Source</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600 truncate flex-1">
                  {new URL(sourceUrl).hostname}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(sourceUrl, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Main Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-company">Company*</Label>
                {companyCandidates.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCompanySuggestions(!showCompanySuggestions)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Lightbulb className="h-3 w-3 mr-1" />
                    {showCompanySuggestions ? 'Hide' : `${companyCandidates.length - 1} more`}
                  </Button>
                )}
              </div>
              <Input
                id="quick-company"
                value={company}
                onChange={(e) => handleInputChange(setCompany)(e.target.value)}
                placeholder="Company name"
                autoFocus={!company.trim()}
                required
              />
              
              {/* Company Suggestions */}
              {showCompanySuggestions && companyCandidates.length > 1 && (
                <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
                  <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Alternative company suggestions:
                  </div>
                  {companyCandidates.slice(1).map((candidate, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-300 transition-colors">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{candidate.value}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-xs ${getConfidenceBadgeColor(candidate.confidence)}`}>
                            {Math.round(candidate.confidence * 100)}% confidence
                          </Badge>
                          <Badge variant="secondary" className={`text-xs ${getSourceBadgeColor(candidate.source)}`}>
                            {candidate.source.replace(/-/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => selectCompanyCandidate(candidate)}
                        className="ml-2"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-role">Role*</Label>
                {roleCandidates.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRoleSuggestions(!showRoleSuggestions)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Lightbulb className="h-3 w-3 mr-1" />
                    {showRoleSuggestions ? 'Hide' : `${roleCandidates.length - 1} more`}
                  </Button>
                )}
              </div>
              <Input
                id="quick-role"
                value={role}
                onChange={(e) => handleInputChange(setRole)(e.target.value)}
                placeholder="Job title"
                autoFocus={!role.trim() && !!company.trim()}
                required
              />
              
              {/* Role Suggestions */}
              {showRoleSuggestions && roleCandidates.length > 1 && (
                <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
                  <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Alternative role suggestions:
                  </div>
                  {roleCandidates.slice(1).map((candidate, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-300 transition-colors">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{candidate.value}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-xs ${getConfidenceBadgeColor(candidate.confidence)}`}>
                            {Math.round(candidate.confidence * 100)}% confidence
                          </Badge>
                          <Badge variant="secondary" className={`text-xs ${getSourceBadgeColor(candidate.source)}`}>
                            {candidate.source.replace(/-/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => selectRoleCandidate(candidate)}
                        className="ml-2"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description with tools */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-description">Job Description</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={cleanFormatting}
                  title="Clean formatting"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearDescription}
                  title="Clear description"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={reparseFromUrl}
                  disabled={!sourceUrl.trim() || isSaving}
                  title="Re-parse from URL"
                >
                  <RefreshCw className="h-3 w-3" />
                  Re-parse
                </Button>
              </div>
            </div>
            <Textarea
              id="quick-description"
              value={description}
              onChange={(e) => handleInputChange(setDescription)(e.target.value)}
              placeholder="Job description text..."
              className="min-h-[200px] text-sm"
              style={{ whiteSpace: 'pre-wrap' }}
            />
            
            {/* Short description warning */}
            {isDescriptionShort && description.trim() && (
              <div className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Short description - consider pasting more content or typing additional details
              </div>
            )}
          </div>

          {/* Optional fields - expandable */}
          <div>
            <Button 
              type="button"
              variant="ghost" 
              className="w-full justify-between"
              onClick={() => setIsOptionalOpen(!isOptionalOpen)}
            >
              Optional: Location, Salary, Tags
              {isOptionalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {isOptionalOpen && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quick-location">Location</Label>
                    <Input
                      id="quick-location"
                      value={location}
                      onChange={(e) => handleInputChange(setLocation)(e.target.value)}
                      placeholder="Remote, City, State"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-salary">Salary</Label>
                    <Input
                      id="quick-salary"
                      value={salary}
                      onChange={(e) => handleInputChange(setSalary)(e.target.value)}
                      placeholder="$100k-120k, Negotiable"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-tags">Tags</Label>
                  <Input
                    id="quick-tags"
                    value={tags}
                    onChange={(e) => handleInputChange(setTags)(e.target.value)}
                    placeholder="react, senior, remote, startup (comma-separated)"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveAsDraft}
                disabled={isSaving || !company.trim() || !role.trim()}
              >
                <Save className="h-4 w-4 mr-1" />
                Save as Draft
              </Button>
              <Button
                type="button"
                onClick={handleSaveAndContinue}
                disabled={isSaving || !company.trim() || !role.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ArrowRight className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save & Continue'}
              </Button>
            </div>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="text-xs text-gray-500 text-center">
            Press ⌘+Enter (Mac) or Ctrl+Enter (Windows) for Save & Continue
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}