'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, FileText, Copy, ExternalLink } from 'lucide-react';
// Define types locally to avoid importing server-side code
interface FileManagementPolicy {
  rootDirectory: string;
  attachmentMode: 'copy' | 'reference';
  folderNaming: 'Company_Role_Date' | 'Role_Company_Date' | 'Date_Company_Role';
  conflictResolution: 'rename' | 'overwrite' | 'skip' | 'prompt';
  createBackups: boolean;
  migrationLogPath: string;
}

interface JobFolderPreview {
  computedPath: string;
  company: string;
  role: string;
  date: string;
  attachmentHandling: {
    mode: 'copy' | 'reference';
    expectedFiles: string[];
  };
}

interface JobPathPreviewProps {
  policy: FileManagementPolicy;
  onPolicyUpdate?: (updates: Partial<FileManagementPolicy>) => void;
}

export function JobPathPreview({ policy, onPolicyUpdate }: JobPathPreviewProps) {
  const [previewJob, setPreviewJob] = useState({
    company: 'Google',
    role: 'Software Engineer',
    date: new Date().toISOString().split('T')[0]
  });
  
  const [preview, setPreview] = useState<JobFolderPreview | null>(null);
  
  useEffect(() => {
    updatePreview();
  }, [previewJob, policy]);

  const updatePreview = async () => {
    try {
      const response = await fetch('/api/file-management/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: {
            company: previewJob.company,
            role: previewJob.role,
            applied_date: previewJob.date,
            fetched_at_iso: new Date().toISOString()
          },
          policy
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreview(data.preview);
      }
    } catch (error) {
      console.error('Failed to update preview:', error);
    }
  };

  const handleJobFieldChange = (field: keyof typeof previewJob, value: string) => {
    setPreviewJob(prev => ({ ...prev, [field]: value }));
  };

  const renderFileStructure = () => {
    if (!preview) return null;

    const files = [
      { name: 'job.json', type: 'data', description: 'Structured job data' },
      { name: 'job.txt', type: 'text', description: 'Human-readable job description' }
    ];

    // Add attachment files based on mode
    if (policy.attachmentMode === 'copy') {
      files.push(
        { name: 'resume.pdf', type: 'attachment', description: 'Copied resume file' },
        { name: 'jd.html', type: 'attachment', description: 'Original job posting HTML' },
        { name: 'snapshot-*.png', type: 'screenshot', description: 'Screenshot of job posting' }
      );
    } else {
      files.push(
        { name: 'references.json', type: 'reference', description: 'Paths to original files' }
      );
    }

    return (
      <div className="font-mono text-sm space-y-1">
        {files.map((file, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className="text-gray-400">
              {index === files.length - 1 ? '└──' : '├──'}
            </span>
            <FileText className="h-3 w-3 text-blue-500" />
            <span className="text-gray-900">{file.name}</span>
            <Badge 
              variant={
                file.type === 'data' ? 'default' :
                file.type === 'attachment' ? 'secondary' :
                file.type === 'reference' ? 'outline' : 'destructive'
              }
              className="text-xs"
            >
              {file.type}
            </Badge>
            <span className="text-xs text-gray-500">{file.description}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Folder Structure Preview
        </CardTitle>
        <CardDescription>
          See how your job folders will be organized with the current settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Policy Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Folder Naming Pattern</Label>
            <Select
              value={policy.folderNaming}
              onValueChange={(value: any) => onPolicyUpdate?.({ folderNaming: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Company_Role_Date">Company_Role_Date</SelectItem>
                <SelectItem value="Role_Company_Date">Role_Company_Date</SelectItem>
                <SelectItem value="Date_Company_Role">Date_Company_Role</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Attachment Mode</Label>
            <Select
              value={policy.attachmentMode}
              onValueChange={(value: 'copy' | 'reference') => onPolicyUpdate?.({ attachmentMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="copy">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Copy files
                  </div>
                </SelectItem>
                <SelectItem value="reference">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Reference originals
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sample Job Input */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium">Sample Job (for preview)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preview-company">Company</Label>
              <Input
                id="preview-company"
                value={previewJob.company}
                onChange={(e) => handleJobFieldChange('company', e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-role">Role</Label>
              <Input
                id="preview-role"
                value={previewJob.role}
                onChange={(e) => handleJobFieldChange('role', e.target.value)}
                placeholder="Job role"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-date">Date</Label>
              <Input
                id="preview-date"
                type="date"
                value={previewJob.date}
                onChange={(e) => handleJobFieldChange('date', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Preview Result */}
        {preview && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Computed Folder Path</Label>
              <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                <div className="font-mono text-sm text-blue-900 break-all">
                  {preview.computedPath}/
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Folder Contents</Label>
              <div className="p-4 bg-white border rounded-lg">
                {renderFileStructure()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <strong>Company:</strong> {preview.company}
              </div>
              <div>
                <strong>Role:</strong> {preview.role}
              </div>
              <div>
                <strong>Date:</strong> {preview.date}
              </div>
              <div>
                <strong>Mode:</strong> 
                <Badge variant={preview.attachmentHandling.mode === 'copy' ? 'default' : 'outline'} className="ml-2">
                  {preview.attachmentHandling.mode}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Mode Explanation */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm">
            <strong>
              {policy.attachmentMode === 'copy' ? 'Copy Mode:' : 'Reference Mode:'}
            </strong>
            <p className="mt-1 text-gray-600">
              {policy.attachmentMode === 'copy' ? (
                <>
                  Attachments like resumes and screenshots will be copied into each job folder. 
                  This ensures all data is self-contained but uses more storage space.
                </>
              ) : (
                <>
                  Only file paths will be stored in job.json. Original files must remain in their 
                  current locations. This saves space but files may become inaccessible if moved.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default JobPathPreview;