'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { ResumeManifestEntry, ResumeConfig } from '@/lib/types';
import { Upload, File, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { DemoNotice } from '@/components/demo/demo-notice';

interface ResumeUploadProps {
  jobUuid: string;
  company: string;
  role: string;
  yourName?: string;
  onUploadComplete?: (resume: ResumeManifestEntry) => void;
}

export function ResumeUpload({ jobUuid, company, role, yourName, onUploadComplete }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [config, setConfig] = useState<ResumeConfig | null>(null);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const extractTextFromResume = async (resume: ResumeManifestEntry, activeVersion: any) => {
    if (!activeVersion?.managed_path) return;

    setIsExtracting(true);
    try {
      const response = await fetch('/api/resume/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: activeVersion.managed_path })
      });

      if (response.ok) {
        const data = await response.json();
        // Update the resume manifest with extracted text
        const updateResponse = await fetch('/api/resume/update-extraction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeId: resume.id,
            versionId: activeVersion.version_id,
            extractedText: data.text,
            extractionStatus: 'success',
            extractionMethod: getExtractionMethod(data.fileType)
          })
        });
        
        if (updateResponse.ok) {
          // Extraction completed successfully
          console.log('Text extraction completed for resume:', resume.id);
        }
      } else {
        console.warn('Text extraction failed:', await response.text());
        // Mark extraction as failed
        await fetch('/api/resume/update-extraction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeId: resume.id,
            versionId: activeVersion.version_id,
            extractedText: '',
            extractionStatus: 'failed',
            extractionError: 'Failed to extract text from file'
          })
        });
      }
    } catch (error) {
      console.error('Error extracting text:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  const getExtractionMethod = (fileType: string) => {
    switch (fileType?.toLowerCase()) {
      case '.pdf': return 'pdf-parse';
      case '.docx':
      case '.doc': return 'mammoth';
      case '.rtf': return 'rtf';
      case '.txt': return 'plain-text';
      default: return 'unknown';
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/resume/config');
      if (response.ok) {
        const configData = await response.json();
        setConfig(configData);
        setKeepOriginal(configData.keep_original_default);
      }
    } catch (error) {
      console.error('Failed to load resume config:', error);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!config) return 'Configuration not loaded';
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!config.supported_file_types.includes(fileExtension)) {
      return `Unsupported file type. Supported types: ${config.supported_file_types.join(', ')}`;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }
    
    return null;
  };

  const uploadResume = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobUuid', jobUuid);
      formData.append('company', company);
      formData.append('role', role);
      formData.append('keepOriginal', keepOriginal.toString());
      if (yourName?.trim()) {
        formData.append('yourName', yourName.trim());
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      const activeVersion = result.resume.versions?.find((v: any) => v.is_active);
      const versionSuffix = activeVersion?.version_suffix || '';
      const versionLabel = versionSuffix ? ` (${versionSuffix})` : '';
      const isNewVersion = result.resume.versions?.length > 1;
      
      // Auto-extract text from uploaded resume
      await extractTextFromResume(result.resume, activeVersion);
      
      // Fetch the updated resume data with extracted text
      let finalResumeData = result.resume;
      try {
        const updatedResponse = await fetch(`/api/resume/manifest?resumeId=${result.resume.id}`);
        if (updatedResponse.ok) {
          finalResumeData = await updatedResponse.json();
        }
      } catch (error) {
        console.warn('Failed to fetch updated resume data:', error);
      }
      
      toast({
        title: isNewVersion ? "New Resume Version Created!" : "Resume Uploaded Successfully!",
        description: `Resume${versionLabel} saved and text extracted for easy viewing.`,
      });

      onUploadComplete?.(finalResumeData);

    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload resume",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    uploadResume(file);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Resume Upload
          </CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Resume
        </CardTitle>
        <CardDescription>
          Upload a resume for {company} - {role}. File will be automatically copied to the managed folder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Keep Original Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="keep-original"
            checked={keepOriginal}
            onChange={(e) => setKeepOriginal(e.target.checked)}
            disabled={isUploading}
            className="h-4 w-4"
          />
          <label htmlFor="keep-original" className="text-sm font-medium">
            Keep original file
          </label>
        </div>

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
            className="hidden"
            accept={config.supported_file_types.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={isUploading}
          />
          
          <div className="space-y-2">
            <File className="h-8 w-8 mx-auto text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">
                Drop a resume file here, or{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-500 underline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supported: {config.supported_file_types.join(', ')} (max 10MB)<br />
                <strong>Recommended:</strong> .docx files for best text extraction results
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {(isUploading || isExtracting) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              {isUploading && <span>Uploading...</span>}
              {isExtracting && <span>Extracting text...</span>}
              {isUploading && <span>{uploadProgress}%</span>}
            </div>
            <Progress value={isExtracting ? 50 : uploadProgress} className="w-full" />
          </div>
        )}

        {/* Demo Notice */}
        <DemoNotice message="This is a demo environment — please don't upload real resumes or sensitive data. Files reset periodically." />

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            File will be named: {company.replace(/[^a-zA-Z0-9]/g, '_')}_{role.replace(/[^a-zA-Z0-9]/g, '_')}_{new Date().toISOString().split('T')[0]}
          </p>
          <p className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Managed folder: {config.managed_folder_path}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}