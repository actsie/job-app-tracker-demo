'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { 
  AlertTriangle, 
  RotateCcw, 
  FilePlus, 
  Eye,
  X
} from 'lucide-react';

interface ResumeConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobInfo: { company: string; role: string; };
  currentResume: { filename: string; date: string; };
  newResume: { filename: string; };
  onReplace: (setAsActive?: boolean) => Promise<void>;
  onKeepBoth: (setAsActive?: boolean) => Promise<void>;
  onPreview?: () => void;
  showApplyToAll?: boolean;
  onApplyToAllChange?: (checked: boolean) => void;
}

export function ResumeConflictDialog({ 
  isOpen, 
  onClose,
  jobInfo,
  currentResume,
  newResume,
  onReplace,
  onKeepBoth,
  onPreview,
  showApplyToAll = false,
  onApplyToAllChange
}: ResumeConflictDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [setNewAsActive, setSetNewAsActive] = useState(true);
  const [applyToAll, setApplyToAll] = useState(false);
  const { toast } = useToast();

  const handleReplace = async () => {
    setIsProcessing(true);
    try {
      await onReplace(true); // Always set as active when replacing
      onClose();
      toast({
        title: "Resume Replaced",
        description: `${newResume.filename} is now the active resume for this job.`,
      });
    } catch (error) {
      toast({
        title: "Replace Failed",
        description: error instanceof Error ? error.message : "Failed to replace resume",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeepBoth = async () => {
    setIsProcessing(true);
    try {
      await onKeepBoth(setNewAsActive);
      onClose();
      toast({
        title: "Resume Added",
        description: `${newResume.filename} added as ${setNewAsActive ? 'active' : 'additional'} version.`,
      });
    } catch (error) {
      toast({
        title: "Add Failed",
        description: error instanceof Error ? error.message : "Failed to add resume version",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyToAllChange = (checked: boolean) => {
    setApplyToAll(checked);
    onApplyToAllChange?.(checked);
  };

  return (
    <Dialog open={isOpen} onOpenChange={!isProcessing ? onClose : undefined}>
      <DialogContent className="max-w-2xl w-full mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            This job already has a resume
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2 text-sm">
              <div><strong>Job:</strong> {jobInfo.company} - {jobInfo.role}</div>
              <div><strong>Current active:</strong> {currentResume.filename} ({currentResume.date})</div>
              <div><strong>New resume:</strong> {newResume.filename}</div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            What would you like to do with <strong>{newResume.filename}</strong>?
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Replace Active */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4 border-red-200 hover:bg-red-50"
              onClick={handleReplace}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <RotateCcw className="h-5 w-5 text-red-600" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium text-red-700">Replace active</div>
                  <div className="text-xs text-red-600 break-words">
                    Make {newResume.filename} the active resume. (Keeps the old one in Versions.)
                  </div>
                </div>
              </div>
            </Button>

            {/* Keep Both */}
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <Button
                variant="ghost"
                className="w-full justify-start h-auto p-0 hover:bg-transparent"
                onClick={handleKeepBoth}
                disabled={isProcessing}
              >
                <div className="flex items-center gap-3 w-full">
                  <FilePlus className="h-5 w-5 text-green-600" />
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium text-green-700">Keep both</div>
                    <div className="text-xs text-green-600 break-words">
                      Add as a new version and keep current active.
                    </div>
                  </div>
                </div>
              </Button>
              
              {/* Set as active checkbox */}
              <div className="flex items-center space-x-2 mt-3 ml-8">
                <Checkbox
                  id="setAsActive"
                  checked={setNewAsActive}
                  onCheckedChange={setSetNewAsActive}
                  disabled={isProcessing}
                />
                <label 
                  htmlFor="setAsActive" 
                  className="text-xs text-green-700 cursor-pointer"
                >
                  Set new one as active
                </label>
              </div>
            </div>
          </div>

          {/* Optional extras */}
          <div className="space-y-2">
            {onPreview && (
              <Button
                variant="link"
                size="sm"
                onClick={onPreview}
                className="h-auto p-0 text-blue-600"
                disabled={isProcessing}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview both resumes
              </Button>
            )}

            {showApplyToAll && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="applyToAll"
                  checked={applyToAll}
                  onCheckedChange={handleApplyToAllChange}
                  disabled={isProcessing}
                />
                <label 
                  htmlFor="applyToAll" 
                  className="text-sm text-gray-600 cursor-pointer"
                >
                  Apply to all jobs this session
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              variant="ghost" 
              onClick={onClose}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}