'use client';

import { useState, useEffect } from 'react';
import { notificationManager, ReminderNotification } from '@/lib/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Clock, Calendar, X, RotateCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpcomingRemindersProps {
  className?: string;
  limit?: number;
  onReminderCancel?: () => void;
  onOpenJob?: (companyName: string, jobUuid?: string) => void;
}

export function UpcomingReminders({ 
  className, 
  limit = 5, 
  onReminderCancel,
  onOpenJob
}: UpcomingRemindersProps) {
  const [reminders, setReminders] = useState<ReminderNotification[]>([]);

  const refreshReminders = () => {
    const upcoming = notificationManager.getUpcomingReminders(limit);
    setReminders(upcoming);
  };

  useEffect(() => {
    refreshReminders();
    
    // Set up interval to refresh reminders every minute
    const interval = setInterval(refreshReminders, 60000);
    
    return () => clearInterval(interval);
  }, [limit]);

  const handleCancelReminder = (reminderId: string) => {
    notificationManager.cancelReminder(reminderId);
    refreshReminders();
    onReminderCancel?.();
  };

  const handleOpenJob = (reminder: ReminderNotification) => {
    onOpenJob?.(reminder.company, reminder.jobUuid);
  };

  const formatReminderDate = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      if (diffHours <= 1) {
        return 'Within 1 hour';
      } else {
        return `In ${diffHours} hours`;
      }
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (reminders.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4" />
          Upcoming Reminders ({reminders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {reminders.map((reminder) => {
          const isFollowupReminder = reminder.id.startsWith('followup_');
          const bgColor = isFollowupReminder ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100';
          const iconColor = isFollowupReminder ? 'text-green-600' : 'text-blue-600';
          
          return (
          <div
            key={reminder.id}
            className={`flex items-center justify-between p-2 ${bgColor} rounded-md border`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium truncate">
                {isFollowupReminder ? (
                  <div title="Auto follow-up reminder">
                    <RotateCcw className={`h-3 w-3 ${iconColor}`} />
                  </div>
                ) : (
                  <Calendar className={`h-3 w-3 ${iconColor}`} />
                )}
                <span className="truncate">{reminder.company}</span>
                <span className="text-gray-500">-</span>
                <span className="truncate">{reminder.role}</span>
                {isFollowupReminder && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    Follow-up
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                <Clock className="h-3 w-3" />
                <span>{formatReminderDate(reminder.scheduledTime)}</span>
                <span className="text-gray-400">•</span>
                <span className="truncate">{reminder.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenJob(reminder)}
                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title="Open job application"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancelReminder(reminder.id)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                title="Cancel reminder"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
        })}
      </CardContent>
    </Card>
  );
}