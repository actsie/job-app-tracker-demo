'use client';

import { useState } from 'react';
import { JobDescription } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Clock, X } from 'lucide-react';
import { updateJobWithFollowupLogic, saveJobWithFollowup } from '@/lib/followup-reminders';

interface FollowupToggleProps {
  job: JobDescription;
  onToggle?: (updatedJob: JobDescription) => void;
  size?: 'sm' | 'lg';
}

export function FollowupToggle({ job, onToggle, size = 'sm' }: FollowupToggleProps) {
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();

  const canHaveFollowup = job.application_status === 'applied' && job.applied_date;
  const hasFollowupEnabled = job.auto_followup_enabled === true;
  const hasFollowupScheduled = Boolean(job.followup_reminder);

  const handleToggle = async () => {
    if (isToggling) return;

    setIsToggling(true);
    
    try {
      const updates = {
        auto_followup_enabled: !hasFollowupEnabled
      };

      const updatedJob = updateJobWithFollowupLogic(job, updates);
      saveJobWithFollowup(updatedJob);

      if (updatedJob.auto_followup_enabled) {
        toast({
          title: "Follow-up reminder enabled",
          description: hasFollowupScheduled 
            ? `Follow-up reminder scheduled for ${new Date(updatedJob.followup_reminder!).toLocaleDateString()}`
            : "Follow-up reminder will be scheduled when you mark as applied",
        });
      } else {
        toast({
          title: "Follow-up reminder disabled",
          description: "Auto follow-up reminder has been cancelled",
        });
      }

      onToggle?.(updatedJob);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update follow-up reminder setting",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const getButtonContent = () => {
    if (size === 'lg') {
      return (
        <div className="flex items-center gap-2">
          {hasFollowupEnabled ? <Clock className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span>{hasFollowupEnabled ? 'Auto Follow-up On' : 'Auto Follow-up Off'}</span>
          {hasFollowupScheduled && (
            <span className="text-xs text-gray-500">
              ({new Date(job.followup_reminder!).toLocaleDateString()})
            </span>
          )}
        </div>
      );
    }
    
    return hasFollowupEnabled ? <Clock className="h-3 w-3" /> : <X className="h-3 w-3" />;
  };

  const getTitle = () => {
    if (!canHaveFollowup) {
      return "Follow-up reminders are only available for applied applications";
    }
    
    if (hasFollowupEnabled) {
      return hasFollowupScheduled 
        ? `Auto follow-up enabled - scheduled for ${new Date(job.followup_reminder!).toLocaleDateString()}`
        : "Auto follow-up enabled";
    }
    
    return "Click to enable automatic 7-day follow-up reminder";
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleToggle}
      disabled={isToggling || !canHaveFollowup}
      className={`
        ${size === 'sm' ? 'p-0 h-auto' : ''}
        ${hasFollowupEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}
        ${!canHaveFollowup ? 'opacity-50 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
      `}
      title={getTitle()}
    >
      {getButtonContent()}
    </Button>
  );
}