'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { JobDescription } from '@/lib/types';
import { StorageConfig } from './storage-settings';
import { FolderOpen, FileText, Image, Paperclip, Copy, Link } from 'lucide-react';

interface JobStorageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription;
  attachments?: Array<{
    type: 'resume' | 'job_description' | 'screenshot' | 'other';
    name: string;
    path?: string;
    size?: number;
  }>;
  onSave: (options: JobStorageOptions) => Promise<void>;
}

export interface JobStorageOptions {
  saveToDisk: boolean;
  attachmentMode: 'copy' | 'reference';
  generateSnapshot: boolean;
  attachments: Array<{
    type: string;
    include: boolean;
    mode?: 'copy' | 'reference';
  }>;
}

const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  rootPath: '',
  attachmentMode: 'copy',
  generateSnapshots: true,
  autoSaveEnabled: false,
};

export function JobStorageDialog({ isOpen, onClose, job, attachments = [], onSave }: JobStorageDialogProps) {
  const [saveToDisk, setSaveToDisk] = useState(true);
  const [attachmentMode, setAttachmentMode] = useState<'copy' | 'reference'>('copy');
  const [generateSnapshot, setGenerateSnapshot] = useState(true);
  const [attachmentSettings, setAttachmentSettings] = useState<Map<string, { include: boolean; mode?: 'copy' | 'reference' }>>(new Map());
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(DEFAULT_STORAGE_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load storage configuration on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('jobStorageConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setStorageConfig({ ...DEFAULT_STORAGE_CONFIG, ...parsed });
        setAttachmentMode(parsed.attachmentMode || 'copy');
        setGenerateSnapshot(parsed.generateSnapshots !== false);
        setSaveToDisk(parsed.autoSaveEnabled || true);
      } catch (error) {
        console.warn('Failed to parse storage config:', error);
      }
    }

    // Initialize attachment settings
    const newSettings = new Map();
    attachments.forEach(attachment => {
      newSettings.set(attachment.type, { include: true, mode: attachmentMode });
    });
    setAttachmentSettings(newSettings);
  }, [attachments, attachmentMode]);

  const updateAttachmentSetting = (type: string, updates: { include?: boolean; mode?: 'copy' | 'reference' }) => {
    setAttachmentSettings(prev => {
      const newSettings = new Map(prev);
      const current = newSettings.get(type) || { include: true };
      newSettings.set(type, { ...current, ...updates });
      return newSettings;
    });
  };

  const getStoragePreview = () => {
    if (!storageConfig.rootPath || !saveToDisk) return null;
    
    const company = job.company || 'Unknown_Company';
    const role = job.role || 'Unknown_Role';
    const date = job.applied_date || job.fetched_at_iso.split('T')[0];
    const formattedDate = date.replace(/-/g, '');
    
    return `${storageConfig.rootPath}/${company}/${role}_${formattedDate}/`;
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'resume': return <FileText className="h-4 w-4" />;
      case 'job_description': return <FileText className="h-4 w-4" />;
      case 'screenshot': return <Image className="h-4 w-4" />;
      default: return <Paperclip className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleSave = async () => {
    if (!storageConfig.rootPath && saveToDisk) {
      toast({
        title: "Storage path required",
        description: "Please configure a storage path in settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const options: JobStorageOptions = {
        saveToDisk,
        attachmentMode,
        generateSnapshot,
        attachments: Array.from(attachmentSettings.entries()).map(([type, settings]) => ({
          type,
          include: settings.include,
          mode: settings.mode,
        })),
      };

      await onSave(options);
      onClose();
    } catch (error) {
      console.error('Failed to save job:', error);
      toast({
        title: "Save failed",
        description: "Failed to save job to disk. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const previewPath = getStoragePreview();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Job to Disk</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Preview */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{job.role || 'Unknown Role'}</h3>
                  <p className="text-sm text-muted-foreground">{job.company || 'Unknown Company'}</p>
                </div>
                <Badge variant="outline">
                  {job.application_status || 'New'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Save to Disk Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Save to Disk</Label>
              <p className="text-sm text-muted-foreground">
                Create a structured folder with job details and attachments
              </p>
            </div>
            <Switch
              checked={saveToDisk}
              onCheckedChange={setSaveToDisk}
            />
          </div>

          {saveToDisk && (
            <>
              {/* Storage Path Preview */}
              {previewPath && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4" />
                      <span className="text-sm font-medium">Storage Location</span>
                    </div>
                    <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                      {previewPath}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attachment Mode */}
              <div className="space-y-3">
                <Label>Attachment Handling</Label>
                <Select
                  value={attachmentMode}
                  onValueChange={(value: 'copy' | 'reference') => setAttachmentMode(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="copy">
                      <div className="flex items-center gap-2">
                        <Copy className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Copy files</div>
                          <div className="text-xs text-muted-foreground">Create copies in job folder</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="reference">
                      <div className="flex items-center gap-2">
                        <Link className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Reference originals</div>
                          <div className="text-xs text-muted-foreground">Store paths to original files</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Attachments List */}
              {attachments.length > 0 && (
                <div className="space-y-3">
                  <Label>Attachments ({attachments.length})</Label>
                  <div className="space-y-2">
                    {attachments.map((attachment, index) => {
                      const settings = attachmentSettings.get(attachment.type) || { include: true };
                      return (
                        <Card key={index}>
                          <CardContent className="pt-3 pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getAttachmentIcon(attachment.type)}
                                <div>
                                  <div className="text-sm font-medium">{attachment.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {attachment.type.replace('_', ' ')} 
                                    {attachment.size && ` • ${formatFileSize(attachment.size)}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {attachmentMode === 'copy' && settings.include && (
                                  <Badge variant="secondary" className="text-xs">
                                    Will copy
                                  </Badge>
                                )}
                                {attachmentMode === 'reference' && settings.include && (
                                  <Badge variant="outline" className="text-xs">
                                    Will reference
                                  </Badge>
                                )}
                                <Switch
                                  checked={settings.include}
                                  onCheckedChange={(include) => 
                                    updateAttachmentSetting(attachment.type, { include })
                                  }
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Snapshot Generation */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Generate Snapshot</Label>
                  <p className="text-sm text-muted-foreground">
                    Create a PNG screenshot of the job posting
                  </p>
                </div>
                <Switch
                  checked={generateSnapshot}
                  onCheckedChange={setGenerateSnapshot}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSaveToDisk(false)}
                disabled={isLoading}
              >
                Skip Disk Save
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : saveToDisk ? 'Save to Disk' : 'Save Job'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}