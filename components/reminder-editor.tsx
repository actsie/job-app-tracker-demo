'use client';

import { useState, useEffect } from 'react';
import { notificationManager } from '@/lib/notifications';
import { JobDescription } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, Clock, Bell, X, Download, ExternalLink } from 'lucide-react';
import { generateJobReminderGoogleUrl } from '@/lib/google-calendar-url';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ReminderEditorProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription;
  onReminderChange?: () => void;
}

export function ReminderEditor({ isOpen, onClose, job, onReminderChange }: ReminderEditorProps) {
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMessage, setReminderMessage] = useState('Follow up on this application');
  const [hasPermission, setHasPermission] = useState(false);
  const [currentJob, setCurrentJob] = useState(job);
  const [reminderSaved, setReminderSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Update current job when prop changes
    setCurrentJob(job);
    // Reset saved state when job changes
    setReminderSaved(false);
  }, [job]);

  useEffect(() => {
    // Check notification permission status
    checkNotificationPermission();
    
    // Load existing reminder if any
    if (currentJob.next_reminder) {
      const date = new Date(currentJob.next_reminder);
      setReminderDate(date.toISOString().split('T')[0]);
      setReminderTime(date.toTimeString().slice(0, 5));
    } else {
      // Set default to 7 days from now at 9 AM
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 7);
      followUpDate.setHours(9, 0, 0, 0);
      
      setReminderDate(followUpDate.toISOString().split('T')[0]);
      setReminderTime('09:00');
    }
  }, [currentJob.next_reminder]);

  const checkNotificationPermission = async () => {
    const permitted = await notificationManager.requestPermission();
    setHasPermission(permitted);
  };

  const handleSaveReminder = () => {
    if (!reminderDate) {
      toast({
        title: "Date required",
        description: "Please select a reminder date.",
        variant: "destructive",
      });
      return;
    }

    const reminderDateTime = new Date(`${reminderDate}T${reminderTime || '09:00'}`);
    
    if (reminderDateTime <= new Date()) {
      toast({
        title: "Invalid date",
        description: "Reminder time must be in the future.",
        variant: "destructive",
      });
      return;
    }

    // Save to localStorage for the job
    const updatedJob = {
      ...currentJob,
      next_reminder: reminderDateTime.toISOString(),
      reminder_ics_downloaded: false, // Reset ICS download status when reminder changes
      last_updated: new Date().toISOString(),
    };

    const storageKey = `job_${updatedJob.uuid}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedJob));
    
    // Update local state to show calendar export buttons
    setCurrentJob(updatedJob);

    // Schedule the notification
    const reminderId = `reminder_${updatedJob.uuid}`;
    notificationManager.scheduleReminder(
      reminderId,
      updatedJob.uuid,
      updatedJob.company || 'Unknown Company',
      updatedJob.role || 'Unknown Role',
      reminderDateTime,
      reminderMessage
    );

    toast({
      title: "Reminder set",
      description: `Reminder scheduled for ${reminderDateTime.toLocaleString()}`,
    });

    // Mark reminder as saved
    setReminderSaved(true);

    onReminderChange?.();
    // Don't close - let user export to calendar
  };

  const handleDeleteReminder = () => {
    // Remove from localStorage
    const updatedJob = {
      ...currentJob,
      next_reminder: undefined,
      reminder_ics_downloaded: false, // Reset ICS download status when reminder is deleted
      last_updated: new Date().toISOString(),
    };

    const storageKey = `job_${updatedJob.uuid}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedJob));
    
    // Update local state
    setCurrentJob(updatedJob);

    // Cancel the notification
    const reminderId = `reminder_${updatedJob.uuid}`;
    notificationManager.cancelReminder(reminderId);

    toast({
      title: "Reminder deleted",
      description: "The reminder has been cancelled.",
    });

    onReminderChange?.();
    onClose();
  };

  const handleRequestPermission = async () => {
    const permitted = await notificationManager.requestPermission();
    setHasPermission(permitted);
    
    if (!permitted) {
      toast({
        title: "Permission denied",
        description: "Please enable notifications in your browser settings to receive reminders.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Notifications enabled",
        description: "You'll now receive reminder notifications.",
      });
    }
  };

  const handleExportToCalendar = () => {
    if (!reminderDate) {
      toast({
        title: "Date required",
        description: "Please select a reminder date before exporting.",
        variant: "destructive",
      });
      return;
    }

    const reminderDateTime = new Date(`${reminderDate}T${reminderTime || '09:00'}`);
    
    // Create URL with query parameters
    const params = new URLSearchParams({
      company: currentJob.company || 'Unknown Company',
      role: currentJob.role || 'Unknown Role',
      date: reminderDateTime.toISOString(),
      message: reminderMessage,
      ...(currentJob.source_url && { url: currentJob.source_url }),
      ...(currentJob.uuid && { uuid: currentJob.uuid }),
    });

    // Trigger download
    const downloadUrl = `/api/reminder/ics?${params.toString()}`;
    window.open(downloadUrl, '_blank');

    // Update job to mark ICS as downloaded
    const updatedJob = {
      ...currentJob,
      reminder_ics_downloaded: true,
      last_updated: new Date().toISOString(),
    };

    // Save to localStorage
    const storageKey = `job_${updatedJob.uuid}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedJob));
    
    // Update local state
    setCurrentJob(updatedJob);

    // Notify parent component of the change
    onReminderChange?.();

    toast({
      title: "Reminder added to your calendar",
      description: "The .ics file has been downloaded. Open it to add to your calendar app.",
    });
  };

  const handleAddToGoogleCalendar = () => {
    if (!reminderDate) {
      toast({
        title: "Date required",
        description: "Please select a reminder date before adding to calendar.",
        variant: "destructive",
      });
      return;
    }

    const reminderDateTime = new Date(`${reminderDate}T${reminderTime || '09:00'}`);
    
    // Generate Google Calendar URL
    const googleCalUrl = generateJobReminderGoogleUrl(
      currentJob.company || 'Unknown Company',
      currentJob.role || 'Unknown Role',
      reminderDateTime,
      currentJob.source_url || undefined,
      currentJob.uuid || undefined,
      reminderMessage
    );

    console.log('Generated Google Calendar URL:', googleCalUrl);

    // Open Google Calendar in new tab
    window.open(googleCalUrl, '_blank');

    // Update job to mark as exported
    const updatedJob = {
      ...currentJob,
      reminder_ics_downloaded: true,
      last_updated: new Date().toISOString(),
    };

    // Save to localStorage
    const storageKey = `job_${updatedJob.uuid}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedJob));
    
    // Update local state
    setCurrentJob(updatedJob);

    // Notify parent component of the change
    onReminderChange?.();

    toast({
      title: "Reminder added to your calendar",
      description: "Google Calendar opened in a new tab. Click 'Save' to add the event.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Set Reminder
          </DialogTitle>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{currentJob.company || 'Unknown'}</span> - {currentJob.role || 'Unknown Role'}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-visible">
          {reminderSaved && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <Bell className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-800 font-medium">
                    Reminder saved in the Job App Tracker.
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Next step: add it to your calendar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasPermission && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <Bell className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800">
                    Notifications are not enabled. Enable them to receive reminders.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRequestPermission}
                    className="mt-1 h-auto p-0 text-yellow-700 hover:text-yellow-900"
                  >
                    Enable Notifications
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reminder-date" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Date
              </Label>
              <Input
                id="reminder-date"
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full min-w-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-time" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Time
              </Label>
              <Input
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full min-w-0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-message">Message</Label>
            <Textarea
              id="reminder-message"
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              placeholder="Follow up on this application"
              rows={2}
              className="w-full resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3">
          {/* Save reminder button - shown only before saving */}
          {!reminderSaved && (
            <Button onClick={handleSaveReminder} className="w-full">
              Save Reminder
            </Button>
          )}

          {/* 2x2 Grid of buttons - shown after saving */}
          {reminderSaved && (
            <div className="grid grid-cols-2 gap-2">
              {/* Row 1: Calendar export options */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleExportToCalendar}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Add to Apple/Outlook Calendar (.ics)
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Opens your calendar app with this reminder filled in</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleAddToGoogleCalendar}
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Add to Google Calendar
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Opens Google Calendar in a new tab with this reminder filled in</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Row 2: Delete and Cancel */}
              <Button
                variant="ghost"
                onClick={handleDeleteReminder}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
              >
                <X className="h-4 w-4 mr-1" />
                Delete Reminder
              </Button>
              
              <Button variant="ghost" onClick={onClose} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {/* Cancel button - shown only before saving */}
          {!reminderSaved && (
            <div className="flex gap-2">
              {currentJob.next_reminder && (
                <Button
                  variant="ghost"
                  onClick={handleDeleteReminder}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  Delete Reminder
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}