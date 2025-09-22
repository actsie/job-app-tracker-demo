'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ResumeConfig } from '@/lib/types';
import { Settings, Folder, Save, AlertCircle, CheckCircle } from 'lucide-react';

export function ResumeSettings() {
  const [config, setConfig] = useState<ResumeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [folderValid, setFolderValid] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    managed_folder_path: '',
    keep_original_default: true,
    naming_format: 'Company_Role_Date' as 'Company_Role_Date' | 'Company_Role_Date_Time',
    supported_file_types: ['.pdf', '.doc', '.docx', '.rtf']
  });
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/resume/config');
      if (response.ok) {
        const configData = await response.json();
        setConfig(configData);
        setFormData(configData);
        await validateFolder(configData.managed_folder_path);
      } else {
        throw new Error('Failed to load configuration');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load resume settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateFolder = async (folderPath: string): Promise<void> => {
    if (!folderPath) {
      setFolderValid(false);
      return;
    }

    try {
      const response = await fetch('/api/resume/validate-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath }),
      });

      const result = await response.json();
      setFolderValid(result.valid);
    } catch (error) {
      setFolderValid(false);
    }
  };

  const handleFolderPathChange = async (value: string) => {
    setFormData(prev => ({ ...prev, managed_folder_path: value }));
    
    // Debounce validation
    setTimeout(() => {
      validateFolder(value);
    }, 500);
  };

  const handleSave = async () => {
    if (folderValid === false) {
      toast({
        title: "Invalid Folder",
        description: "Please select a valid, writable folder path",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/resume/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const savedConfig = await response.json();
      setConfig(savedConfig);
      setFormData(savedConfig);

      toast({
        title: "Settings Saved",
        description: "Resume settings have been successfully updated",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setFormData(config);
      setFolderValid(null);
    }
  };

  const selectFolder = async () => {
    try {
      // This would typically integrate with a file picker dialog
      // For now, we'll use a simple prompt as a placeholder
      const folderPath = prompt('Enter the full path to the managed resumes folder:');
      if (folderPath) {
        handleFolderPathChange(folderPath);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select folder",
        variant: "destructive",
      });
    }
  };

  const hasChanges = config && JSON.stringify(formData) !== JSON.stringify(config);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Resume Settings
          </CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Resume Settings
        </CardTitle>
        <CardDescription>
          Configure how resumes are managed and stored
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Managed Folder Path */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Managed Folder Path</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={formData.managed_folder_path}
                onChange={(e) => handleFolderPathChange(e.target.value)}
                placeholder="/path/to/managed/resumes"
                className="pr-8"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {folderValid === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                {folderValid === false && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={selectFolder}
              className="flex items-center gap-2"
            >
              <Folder className="h-4 w-4" />
              Browse
            </Button>
          </div>
          {folderValid === false && (
            <p className="text-sm text-red-600">
              Folder does not exist or is not writable
            </p>
          )}
          <p className="text-xs text-gray-500">
            Location where resume files will be stored and managed
          </p>
        </div>

        {/* Keep Original Default */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Default Copy Behavior</label>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="keep-original"
              checked={formData.keep_original_default}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                keep_original_default: e.target.checked 
              }))}
              className="h-4 w-4"
            />
            <label htmlFor="keep-original" className="text-sm">
              Keep original files by default
            </label>
          </div>
          <p className="text-xs text-gray-500">
            When checked, original files will be kept when uploading resumes
          </p>
        </div>

        {/* Naming Format */}
        <div className="space-y-2">
          <label className="text-sm font-medium">File Naming Format</label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="format-date"
                name="naming_format"
                value="Company_Role_Date"
                checked={formData.naming_format === 'Company_Role_Date'}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  naming_format: e.target.value as 'Company_Role_Date' | 'Company_Role_Date_Time'
                }))}
                className="h-4 w-4"
              />
              <label htmlFor="format-date" className="text-sm">
                Company_Role_Date (e.g., Apple_Engineer_2024-01-15.pdf)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="format-datetime"
                name="naming_format"
                value="Company_Role_Date_Time"
                checked={formData.naming_format === 'Company_Role_Date_Time'}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  naming_format: e.target.value as 'Company_Role_Date' | 'Company_Role_Date_Time'
                }))}
                className="h-4 w-4"
              />
              <label htmlFor="format-datetime" className="text-sm">
                Company_Role_Date_Time (e.g., Apple_Engineer_2024-01-15_14-30-25.pdf)
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Choose how managed resume files should be named
          </p>
        </div>

        {/* Supported File Types */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Supported File Types</label>
          <div className="text-sm text-gray-600">
            {formData.supported_file_types.join(', ')}
          </div>
          <p className="text-xs text-gray-500">
            Currently supported resume file formats
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || folderValid === false || !hasChanges}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            Reset
          </Button>
        </div>

        {hasChanges && (
          <p className="text-sm text-amber-600">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}