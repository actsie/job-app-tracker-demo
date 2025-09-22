'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Bell, Clock, Mail, ExternalLink, ChevronDown } from 'lucide-react';
import { notificationManager, ReminderNotification, QuickAction } from '@/lib/notifications';

interface InAppNotificationProps {
  reminder: ReminderNotification;
  quickActions: QuickAction[];
  onClose: () => void;
}

function InAppNotificationCard({ reminder, quickActions, onClose }: InAppNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [snoozeOptions] = useState(notificationManager.getSnoozeOptions());

  const handleAction = async (action: string) => {
    await notificationManager.handleQuickAction(action, reminder);
    if (action === 'dismiss') {
      setIsVisible(false);
      onClose();
    }
  };

  const handleSnooze = (minutes?: number) => {
    if (minutes) {
      notificationManager.snoozeReminderWithOptions(reminder.id, minutes);
      setIsVisible(false);
      onClose();
    } else {
      // Show snooze options
      setShowSnoozeOptions(!showSnoozeOptions);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'open': return <ExternalLink className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'snooze': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="fixed top-4 right-4 w-96 z-50 shadow-lg border-2 border-blue-200 bg-blue-50 animate-in slide-in-from-right-full duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">Job Application Reminder</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-900">{reminder.company}</h4>
          <p className="text-sm text-gray-600">{reminder.role}</p>
          <p className="text-sm text-gray-700 mt-2">{reminder.message}</p>
          {reminder.snoozeCount && reminder.snoozeCount > 0 && (
            <Badge variant="outline" className="mt-1">
              Snoozed {reminder.snoozeCount} time{reminder.snoozeCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              onClick={() => handleAction('open')}
              className="flex items-center space-x-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open</span>
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleAction('email')}
              className="flex items-center space-x-1"
            >
              <Mail className="w-3 h-3" />
              <span>Email</span>
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleSnooze()}
              className="flex items-center space-x-1"
            >
              <Clock className="w-3 h-3" />
              <span>Snooze</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showSnoozeOptions ? 'rotate-180' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleAction('dismiss')}
            >
              Dismiss
            </Button>
          </div>
          
          {showSnoozeOptions && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Choose snooze duration:</p>
              <div className="grid grid-cols-3 gap-2">
                {snoozeOptions.slice(0, 6).map((option) => (
                  <Button 
                    key={option.value}
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleSnooze(option.value)}
                    className="text-xs h-8"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {snoozeOptions.slice(6).map((option) => (
                  <Button 
                    key={option.value}
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleSnooze(option.value)}
                    className="text-xs h-8"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InAppNotificationManager() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    reminder: ReminderNotification;
    quickActions: QuickAction[];
  }>>([]);

  useEffect(() => {
    const handleInAppNotification = ({ reminder, quickActions }: { reminder: ReminderNotification; quickActions: QuickAction[] }) => {
      // Check if notification with same ID already exists to prevent duplicates
      setNotifications(prev => {
        const existingIndex = prev.findIndex(n => n.id === reminder.id);
        if (existingIndex >= 0) {
          // Update existing notification
          const updated = [...prev];
          updated[existingIndex] = { id: reminder.id, reminder, quickActions };
          return updated;
        } else {
          // Add new notification
          return [...prev, { id: reminder.id, reminder, quickActions }];
        }
      });

      // Auto-dismiss after 45 seconds if not interacted with
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== reminder.id));
      }, 45000);
    };

    const handleShowSnoozeOptions = (reminder: ReminderNotification) => {
      // Show snooze options for notifications triggered from service worker
      setNotifications(prev => {
        const existingIndex = prev.findIndex(n => n.reminder.id === reminder.id);
        if (existingIndex >= 0) {
          return prev; // Already showing
        }
        return [...prev, {
          id: `snooze-${reminder.id}`,
          reminder,
          quickActions: []
        }];
      });
    };

    notificationManager.on('inAppNotification', handleInAppNotification);
    notificationManager.on('showSnoozeOptions', handleShowSnoozeOptions);

    return () => {
      notificationManager.off('inAppNotification', handleInAppNotification);
      notificationManager.off('showSnoozeOptions', handleShowSnoozeOptions);
    };
  }, []);

  const closeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      {notifications.map((notification, index) => (
        <div 
          key={notification.id}
          style={{ top: `${4 + index * 120}px` }}
          className="fixed right-4 z-50"
        >
          <InAppNotificationCard
            reminder={notification.reminder}
            quickActions={notification.quickActions}
            onClose={() => closeNotification(notification.id)}
          />
        </div>
      ))}
    </>
  );
}