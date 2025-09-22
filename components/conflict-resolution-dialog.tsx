'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileX, Edit3, SkipForward, RefreshCw } from 'lucide-react';
// Define types locally to avoid importing server-side code
interface ConflictInfo {
  type: 'folder_exists' | 'file_exists' | 'invalid_path';
  conflictPath: string;
  resolution?: 'rename' | 'overwrite' | 'skip';
  suggestedName?: string;
}

interface ImportableJob {
  id: string;
  originalPath: string;
  fileName: string;
  detectedJob?: any;
  proposedFolder: string;
  status: 'detected' | 'mapped' | 'conflict' | 'ready' | 'imported' | 'failed';
  conflicts?: ConflictInfo[];
  errorMessage?: string;
}

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: ImportableJob;
  onResolve: (job: ImportableJob, resolutions: { [conflictId: number]: ConflictResolution }) => void;
}

interface ConflictResolution {
  action: 'rename' | 'overwrite' | 'skip';
  newName?: string;
}

export function ConflictResolutionDialog({ 
  isOpen, 
  onClose, 
  job, 
  onResolve 
}: ConflictResolutionDialogProps) {
  const [resolutions, setResolutions] = useState<{ [conflictId: number]: ConflictResolution }>({});
  const [customNames, setCustomNames] = useState<{ [conflictId: number]: string }>({});

  const handleResolutionChange = (conflictIndex: number, action: ConflictResolution['action']) => {
    setResolutions(prev => ({
      ...prev,
      [conflictIndex]: { action }
    }));
  };

  const handleCustomNameChange = (conflictIndex: number, name: string) => {
    setCustomNames(prev => ({
      ...prev,
      [conflictIndex]: name
    }));
    
    setResolutions(prev => ({
      ...prev,
      [conflictIndex]: { action: 'rename', newName: name }
    }));
  };

  const handleResolveAll = () => {
    onResolve(job, resolutions);
    onClose();
  };

  const getConflictIcon = (conflict: ConflictInfo) => {
    switch (conflict.type) {
      case 'folder_exists':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'file_exists':
        return <FileX className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getConflictDescription = (conflict: ConflictInfo) => {
    switch (conflict.type) {
      case 'folder_exists':
        return 'A folder already exists at this location';
      case 'file_exists':
        return 'A file with this name already exists';
      case 'invalid_path':
        return 'The target path is invalid or inaccessible';
      default:
        return 'An unknown conflict has occurred';
    }
  };

  const allConflictsResolved = job.conflicts?.every((_, index) => resolutions[index]) || false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Resolve Import Conflicts
          </DialogTitle>
          <DialogDescription>
            The following conflicts were detected for "{job.detectedJob?.company} - {job.detectedJob?.role}". 
            Choose how to resolve each conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Job Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Source:</strong> {job.fileName}</div>
              <div><strong>Target:</strong> {job.proposedFolder}</div>
              <div><strong>Company:</strong> {job.detectedJob?.company || 'Unknown'}</div>
              <div><strong>Role:</strong> {job.detectedJob?.role || 'Unknown'}</div>
            </div>
          </div>

          {/* Conflicts */}
          {job.conflicts?.map((conflict, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                {getConflictIcon(conflict)}
                <span className="font-medium">
                  {conflict.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <Badge variant="outline" className="text-xs">
                  Conflict #{index + 1}
                </Badge>
              </div>

              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-1">
                  {getConflictDescription(conflict)}
                </p>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                  {conflict.conflictPath}
                </div>
              </div>

              <RadioGroup 
                value={resolutions[index]?.action || ''}
                onValueChange={(value: ConflictResolution['action']) => handleResolutionChange(index, value)}
              >
                <div className="space-y-3">
                  {/* Rename Option */}
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="rename" id={`rename-${index}`} />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`rename-${index}`} className="flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Rename and continue
                      </Label>
                      <div className="space-y-2">
                        <Input
                          placeholder={conflict.suggestedName || "Enter new name"}
                          value={customNames[index] || conflict.suggestedName || ''}
                          onChange={(e) => handleCustomNameChange(index, e.target.value)}
                          disabled={resolutions[index]?.action !== 'rename'}
                          className="text-sm"
                        />
                        <p className="text-xs text-gray-500">
                          The file/folder will be renamed to avoid the conflict
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Overwrite Option */}
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="overwrite" id={`overwrite-${index}`} />
                    <div className="flex-1">
                      <Label htmlFor={`overwrite-${index}`} className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Overwrite existing
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Replace the existing file/folder with the new one
                      </p>
                    </div>
                  </div>

                  {/* Skip Option */}
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="skip" id={`skip-${index}`} />
                    <div className="flex-1">
                      <Label htmlFor={`skip-${index}`} className="flex items-center gap-2">
                        <SkipForward className="h-4 w-4" />
                        Skip this job
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Don't import this job due to the conflict
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>
          ))}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolveAll}
              disabled={!allConflictsResolved}
            >
              Apply Resolutions ({Object.keys(resolutions).length}/{job.conflicts?.length || 0})
            </Button>
          </div>

          {/* Summary */}
          {Object.keys(resolutions).length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">Resolution Summary</h5>
              <div className="space-y-1 text-sm">
                {Object.entries(resolutions).map(([conflictIndex, resolution]) => {
                  const conflict = job.conflicts?.[parseInt(conflictIndex)];
                  if (!conflict) return null;
                  
                  return (
                    <div key={conflictIndex} className="flex items-center gap-2 text-blue-800">
                      <span className="font-mono text-xs bg-blue-200 px-1 rounded">
                        #{parseInt(conflictIndex) + 1}
                      </span>
                      <span>
                        {resolution.action === 'rename' && `Rename to: ${resolution.newName || 'unnamed'}`}
                        {resolution.action === 'overwrite' && 'Overwrite existing'}
                        {resolution.action === 'skip' && 'Skip import'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictResolutionDialog;