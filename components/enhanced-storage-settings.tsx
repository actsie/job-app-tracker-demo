'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  Settings, 
  FolderOpen, 
  Import, 
  RefreshCw, 
  Archive,
  Undo
} from 'lucide-react';
// Define FileManagementPolicy type locally to avoid importing server-side code
interface FileManagementPolicy {
  rootDirectory: string;
  attachmentMode: 'copy' | 'reference';
  folderNaming: 'Company_Role_Date' | 'Role_Company_Date' | 'Date_Company_Role';
  conflictResolution: 'rename' | 'overwrite' | 'skip' | 'prompt';
  createBackups: boolean;
  migrationLogPath: string;
}

const getDefaultFileManagementPolicy = (): FileManagementPolicy => ({
  rootDirectory: '/Users/username/Documents/job-applications',
  attachmentMode: 'copy',
  folderNaming: 'Company_Role_Date',
  conflictResolution: 'prompt',
  createBackups: true,
  migrationLogPath: '/Users/username/Documents/migration-logs'
});
import JobPathPreview from './job-path-preview';
import ImportMigrationWizard from './import-migration-wizard';
import BulkOperationsPanel from './bulk-operations-panel';

export function EnhancedStorageSettings() {
  const [policy, setPolicy] = useState<FileManagementPolicy>(getDefaultFileManagementPolicy());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const response = await fetch('/api/file-management/config');
      if (response.ok) {
        const data = await response.json();
        setPolicy(data.config);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      toast({
        title: "Error",
        description: "Failed to load file management configuration",
        variant: "destructive"
      });
    }
  };

  const handlePolicyUpdate = async (updates: Partial<FileManagementPolicy>) => {
    const updatedPolicy = { ...policy, ...updates };
    setPolicy(updatedPolicy);

    try {
      setIsLoading(true);
      const response = await fetch('/api/file-management/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        setPolicy(data.config);
        toast({
          title: "Settings updated",
          description: data.message
        });
      } else {
        const error = await response.json();
        toast({
          title: "Update failed",
          description: error.error,
          variant: "destructive"
        });
        // Revert changes on error
        setPolicy(policy);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive"
      });
      // Revert changes on error
      setPolicy(policy);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRootPathChange = async (newPath: string) => {
    if (!newPath.trim()) {
      toast({
        title: "Invalid path",
        description: "Please enter a valid directory path",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // First, check if migration is needed
      const migrationResponse = await fetch('/api/file-management/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRootPath: newPath })
      });

      if (migrationResponse.ok) {
        const migrationData = await migrationResponse.json();
        
        if (migrationData.migrationSummary.migrationRequired) {
          // Show migration prompt
          const shouldMigrate = confirm(
            `Changing the root path will require migrating ${migrationData.migrationSummary.jobsFound} existing jobs. Continue?`
          );
          
          if (shouldMigrate) {
            // Execute migration
            const executeResponse = await fetch('/api/file-management/migrate', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                newRootPath: newPath,
                options: {
                  copyFiles: policy.attachmentMode === 'copy',
                  createBackup: true,
                  overwriteExisting: false
                }
              })
            });

            if (executeResponse.ok) {
              const executeData = await executeResponse.json();
              
              if (executeData.configUpdated) {
                await loadConfiguration();
                toast({
                  title: "Migration completed",
                  description: executeData.message
                });
              } else {
                toast({
                  title: "Migration failed",
                  description: "Root path was not updated due to migration errors",
                  variant: "destructive"
                });
              }
            }
          }
        } else {
          // No migration needed, just update the config
          await handlePolicyUpdate({ rootDirectory: newPath });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change root directory",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPath = async () => {
    if (!policy.rootDirectory.trim()) {
      toast({
        title: "No path specified",
        description: "Please enter a root directory path first",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/file-management/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: policy.rootDirectory })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Path validated",
          description: data.message
        });
      } else {
        const error = await response.json();
        toast({
          title: "Path validation failed",
          description: error.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate path",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportComplete = () => {
    // Refresh any job lists or data
    toast({
      title: "Import completed",
      description: "Jobs have been successfully imported into your structured folder system"
    });
  };

  const handleOperationComplete = () => {
    // Refresh any job lists or data
    toast({
      title: "Operation completed",
      description: "Bulk operation has been executed successfully"
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Enhanced File Management
        </CardTitle>
        <CardDescription>
          Configure advanced job storage, import existing files, and manage bulk operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Import className="h-4 w-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Root Directory Configuration</h3>
                <p className="text-sm text-gray-600">
                  Set the base directory where all job folders will be created
                </p>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={policy.rootDirectory}
                    onChange={(e) => setPolicy(prev => ({ ...prev, rootDirectory: e.target.value }))}
                    placeholder="/Users/username/Documents/JobApplications"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const path = prompt('Enter the root directory path:', policy.rootDirectory);
                      if (path) handleRootPathChange(path);
                    }}
                    disabled={isLoading}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Select
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestPath}
                    disabled={isLoading || !policy.rootDirectory.trim()}
                    size="sm"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Test Path
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={() => handleRootPathChange(policy.rootDirectory)}
                    disabled={isLoading || !policy.rootDirectory.trim()}
                    size="sm"
                  >
                    Update Root Path
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">File Management Policies</h4>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Folder Naming Convention</label>
                  <select
                    value={policy.folderNaming}
                    onChange={(e) => handlePolicyUpdate({ folderNaming: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={isLoading}
                  >
                    <option value="Company_Role_Date">Company_Role_Date</option>
                    <option value="Role_Company_Date">Role_Company_Date</option>
                    <option value="Date_Company_Role">Date_Company_Role</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Attachment Mode</label>
                  <select
                    value={policy.attachmentMode}
                    onChange={(e) => handlePolicyUpdate({ attachmentMode: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={isLoading}
                  >
                    <option value="copy">Copy files into job folders</option>
                    <option value="reference">Reference original file locations</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Conflict Resolution</label>
                  <select
                    value={policy.conflictResolution}
                    onChange={(e) => handlePolicyUpdate({ conflictResolution: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={isLoading}
                  >
                    <option value="prompt">Prompt user for each conflict</option>
                    <option value="rename">Automatically rename with suffix</option>
                    <option value="overwrite">Overwrite existing files</option>
                    <option value="skip">Skip conflicted files</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="create-backups"
                    checked={policy.createBackups}
                    onChange={(e) => handlePolicyUpdate({ createBackups: e.target.checked })}
                    disabled={isLoading}
                  />
                  <label htmlFor="create-backups" className="text-sm font-medium">
                    Create backups before operations
                  </label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <JobPathPreview 
              policy={policy}
              onPolicyUpdate={handlePolicyUpdate}
            />
          </TabsContent>

          <TabsContent value="import">
            <ImportMigrationWizard 
              onImportComplete={handleImportComplete}
            />
          </TabsContent>

          <TabsContent value="operations">
            <BulkOperationsPanel 
              selectedJobIds={selectedJobIds}
              onOperationComplete={handleOperationComplete}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default EnhancedStorageSettings;