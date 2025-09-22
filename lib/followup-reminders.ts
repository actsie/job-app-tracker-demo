import { JobDescription } from './types';
import { notificationManager } from './notifications';

/**
 * Utility functions for managing automatic follow-up reminders
 */

export function calculateFollowupDate(appliedDate: string): Date {
  const applied = new Date(appliedDate);
  const followupDate = new Date(applied);
  followupDate.setDate(followupDate.getDate() + 7);
  // Set to 9 AM for consistent timing
  followupDate.setHours(9, 0, 0, 0);
  return followupDate;
}

export function scheduleFollowupReminder(job: JobDescription): JobDescription {
  if (!job.applied_date || !job.auto_followup_enabled) {
    return job;
  }

  // Cancel existing follow-up reminder if it exists
  if (job.followup_reminder_id) {
    notificationManager.cancelReminder(job.followup_reminder_id);
  }

  const followupDate = calculateFollowupDate(job.applied_date);
  const followupId = `followup_${job.uuid}`;
  
  // Schedule the follow-up reminder
  notificationManager.scheduleReminder(
    followupId,
    job.uuid,
    job.company || 'Unknown Company',
    job.role || 'Unknown Role',
    followupDate,
    'Follow up on your application - it\'s been 7 days since you applied'
  );

  return {
    ...job,
    followup_reminder: followupDate.toISOString(),
    followup_reminder_id: followupId,
    last_updated: new Date().toISOString()
  };
}

export function cancelFollowupReminder(job: JobDescription): JobDescription {
  if (job.followup_reminder_id) {
    notificationManager.cancelReminder(job.followup_reminder_id);
  }

  return {
    ...job,
    followup_reminder: undefined,
    followup_reminder_id: undefined,
    last_updated: new Date().toISOString()
  };
}

export function updateJobWithFollowupLogic(
  job: JobDescription,
  updates: Partial<JobDescription>
): JobDescription {
  const updatedJob = { ...job, ...updates };
  
  // Backward compatibility: Set default follow-up setting for existing applied jobs
  if (updatedJob.application_status === 'applied' && updatedJob.auto_followup_enabled === undefined) {
    updatedJob.auto_followup_enabled = true;
  }
  
  // If status changed to 'applied', auto-enable follow-up if not explicitly set
  if (updates.application_status === 'applied' && job.application_status !== 'applied') {
    // Auto-enable follow-up reminder for newly applied jobs
    if (updatedJob.auto_followup_enabled === undefined) {
      updatedJob.auto_followup_enabled = true;
    }
    
    // Set applied_date if not already set
    if (!updatedJob.applied_date) {
      updatedJob.applied_date = new Date().toISOString();
    }
  }

  // If status changed away from 'applied', cancel follow-up reminder
  if (updates.application_status && updates.application_status !== 'applied' && job.application_status === 'applied') {
    return cancelFollowupReminder(updatedJob);
  }

  // If applied_date changed and follow-up is enabled, reschedule
  if (updates.applied_date && updatedJob.auto_followup_enabled && updatedJob.application_status === 'applied') {
    return scheduleFollowupReminder(updatedJob);
  }

  // If auto_followup_enabled changed
  if (updates.auto_followup_enabled !== undefined) {
    if (updatedJob.auto_followup_enabled && updatedJob.application_status === 'applied' && updatedJob.applied_date) {
      return scheduleFollowupReminder(updatedJob);
    } else if (!updatedJob.auto_followup_enabled) {
      return cancelFollowupReminder(updatedJob);
    }
  }

  // If we have an applied job with follow-up enabled but no reminder scheduled, schedule it
  if (updatedJob.application_status === 'applied' && 
      updatedJob.auto_followup_enabled && 
      updatedJob.applied_date && 
      !updatedJob.followup_reminder_id) {
    return scheduleFollowupReminder(updatedJob);
  }

  return updatedJob;
}

export function saveJobWithFollowup(job: JobDescription): void {
  const storageKey = `job_${job.uuid}`;
  localStorage.setItem(storageKey, JSON.stringify(job));
}