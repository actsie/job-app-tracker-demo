'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { FolderOpen, Settings, Save, RefreshCw } from 'lucide-react';

export interface StorageConfig {
  rootPath: string;
  attachmentMode: 'copy' | 'reference';
  generateSnapshots: boolean;
  autoSaveEnabled: boolean;
  customNaming?: string;
}

interface StorageSettingsProps {
  onConfigChange?: (config: StorageConfig) => void;
  initialConfig?: Partial<StorageConfig>;
}

const DEFAULT_CONFIG: StorageConfig = {
  rootPath: '',
  attachmentMode: 'copy',
  generateSnapshots: true,
  autoSaveEnabled: false,
};

export function StorageSettings({ onConfigChange, initialConfig }: StorageSettingsProps) {
  const [config, setConfig] = useState<StorageConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('jobStorageConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...DEFAULT_CONFIG, ...parsed, ...initialConfig });
      } catch (error) {
        console.warn('Failed to parse storage config from localStorage:', error);
      }
    }
  }, [initialConfig]);

  const handleConfigChange = (updates: Partial<StorageConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
    
    // Save to localStorage
    localStorage.setItem('jobStorageConfig', JSON.stringify(newConfig));
  };

  const handleSelectFolder = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would open a file picker dialog
      // For now, we'll show an input for manual entry
      const folderPath = prompt('Enter the folder path for job applications:', config.rootPath);
      
      if (folderPath && folderPath.trim()) {
        handleConfigChange({ rootPath: folderPath.trim() });
        
        toast({
          title: "Folder updated",
          description: `Job applications will be saved to: ${folderPath}`,
        });
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
      toast({
        title: "Error",
        description: "Failed to select folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConfiguration = async () => {
    try {
      setIsLoading(true);
      
      if (!config.rootPath.trim()) {
        toast({
          title: "Configuration incomplete",
          description: "Please select a root folder path first.",
          variant: "destructive",
        });
        return;
      }

      // Test if the path is valid by attempting to create it
      const response = await fetch('/api/storage/test-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: config.rootPath }),
      });

      if (response.ok) {
        toast({
          title: "Configuration valid",
          description: "Storage path is accessible and ready to use.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Configuration error",
          description: error.message || "Storage path is not accessible.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to test configuration:', error);
      toast({
        title: "Test failed",
        description: "Unable to validate storage configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const previewFolderStructure = () => {
    if (!config.rootPath) return '';
    
    return `${config.rootPath}/Google/Software_Engineer_20241201/`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Job Storage Settings
        </CardTitle>
        <CardDescription>
          Configure how job applications and attachments are saved to disk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Root Path Configuration */}
        <div className="space-y-3">
          <Label htmlFor="root-path">Storage Root Folder</Label>
          <div className="flex gap-2">
            <Input
              id="root-path"
              value={config.rootPath}
              onChange={(e) => handleConfigChange({ rootPath: e.target.value })}
              placeholder="/Users/username/Documents/JobApplications"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectFolder}
              disabled={isLoading}
              className="shrink-0"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Select
            </Button>
          </div>
          
          {config.rootPath && (
            <div className="text-sm text-muted-foreground">
              <div className="font-medium">Preview structure:</div>
              <div className="font-mono bg-muted p-2 rounded text-xs">
                {previewFolderStructure()}
                <br />
                ├── job.json
                <br />
                ├── job.txt
                <br />
                {config.attachmentMode === 'copy' && (
                  <>
                    ├── resume.pdf
                    <br />
                    ├── jd.html
                    <br />
                  </>
                )}
                {config.generateSnapshots && '└── snapshot-2024-12-01T10-30-00-000Z.png'}
              </div>
            </div>
          )}
        </div>

        {/* Attachment Mode */}
        <div className="space-y-3">
          <Label>Attachment Handling</Label>
          <Select
            value={config.attachmentMode}
            onValueChange={(value: 'copy' | 'reference') => 
              handleConfigChange({ attachmentMode: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="copy">
                <div className="flex flex-col">
                  <span className="font-medium">Copy files</span>
                  <span className="text-xs text-muted-foreground">
                    Create copies in job folder (recommended)
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="reference">
                <div className="flex flex-col">
                  <span className="font-medium">Reference originals</span>
                  <span className="text-xs text-muted-foreground">
                    Store paths to original files
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <div className="text-sm text-muted-foreground">
            {config.attachmentMode === 'copy' ? (
              <>
                <strong>Copy mode:</strong> Files like resumes and job descriptions will be 
                copied into each job folder. This ensures data integrity but uses more storage.
              </>
            ) : (
              <>
                <strong>Reference mode:</strong> Only file paths are stored. Original files 
                must remain in their current locations.
              </>
            )}
          </div>
        </div>

        {/* Snapshot Generation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="generate-snapshots">Generate Snapshots</Label>
              <div className="text-sm text-muted-foreground">
                Automatically create PNG snapshots of job postings
              </div>
            </div>
            <Switch
              id="generate-snapshots"
              checked={config.generateSnapshots}
              onCheckedChange={(checked) => handleConfigChange({ generateSnapshots: checked })}
            />
          </div>
        </div>

        {/* Auto-save */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-save">Auto-save to Disk</Label>
              <div className="text-sm text-muted-foreground">
                Automatically save jobs to disk when added
              </div>
            </div>
            <Switch
              id="auto-save"
              checked={config.autoSaveEnabled}
              onCheckedChange={(checked) => handleConfigChange({ autoSaveEnabled: checked })}
            />
          </div>
        </div>

        {/* Test Configuration */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleTestConfiguration}
            disabled={isLoading || !config.rootPath.trim()}
            variant="outline"
            className="w-full"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Test Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}