'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { notificationManager, NotificationSettings, MissedReminder } from '@/lib/notifications';
import { Bell, BellOff, Clock, Trash2, AlertTriangle, CheckCircle, Volume2, VolumeX, TestTube, BarChart3 } from 'lucide-react';

export default function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    defaultSnoozeInterval: 60,
    soundEnabled: true,
    showDesktopNotifications: true,
    perAppSettings: {}
  });
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [missedReminders, setMissedReminders] = useState<MissedReminder[]>([]);
  const [showMissedReminders, setShowMissedReminders] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [notificationStats, setNotificationStats] = useState<any>(null);

  useEffect(() => {
    // Load initial settings
    const currentSettings = notificationManager.getSettings();
    setSettings(currentSettings);
    setPermissionStatus(notificationManager.getPermissionStatus());
    setMissedReminders(notificationManager.getMissedReminders());
    setNotificationStats(notificationManager.getNotificationStats());

    // Set up event listeners
    const handleSettingsChanged = (newSettings: NotificationSettings) => {
      setSettings(newSettings);
    };

    const handleMissedReminders = (newMissedReminders: MissedReminder[]) => {
      setMissedReminders(prev => [...prev, ...newMissedReminders]);
      setShowMissedReminders(true);
      setNotificationStats(notificationManager.getNotificationStats());
    };

    const handleMissedRemindersCleared = () => {
      setMissedReminders([]);
      setShowMissedReminders(false);
      setNotificationStats(notificationManager.getNotificationStats());
    };

    const handleReminderSnoozed = () => {
      setNotificationStats(notificationManager.getNotificationStats());
    };

    const handleAllRemindersCleared = () => {
      setNotificationStats(notificationManager.getNotificationStats());
    };

    notificationManager.on('settingsChanged', handleSettingsChanged);
    notificationManager.on('missedReminders', handleMissedReminders);
    notificationManager.on('missedRemindersCleared', handleMissedRemindersCleared);
    notificationManager.on('reminderSnoozed', handleReminderSnoozed);
    notificationManager.on('allRemindersCleared', handleAllRemindersCleared);

    return () => {
      notificationManager.off('settingsChanged', handleSettingsChanged);
      notificationManager.off('missedReminders', handleMissedReminders);
      notificationManager.off('missedRemindersCleared', handleMissedRemindersCleared);
      notificationManager.off('reminderSnoozed', handleReminderSnoozed);
      notificationManager.off('allRemindersCleared', handleAllRemindersCleared);
    };
  }, []);

  const handleRequestPermission = async () => {
    const granted = await notificationManager.requestPermission();
    setPermissionStatus(notificationManager.getPermissionStatus());
    if (granted) {
      updateSettings({ showDesktopNotifications: true });
    }
  };

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    notificationManager.updateSettings(updates);
  };

  const clearAllReminders = async () => {
    if (confirm('Are you sure you want to clear all pending follow-up reminders? This action cannot be undone.')) {
      await notificationManager.clearAllPendingReminders();
      setNotificationStats(notificationManager.getNotificationStats());
    }
  };

  const testNotification = async () => {
    setIsTestingNotification(true);
    try {
      const success = await notificationManager.testNotification();
      if (success) {
        alert('Test notification sent! Check for the notification or in-app alert.');
      } else {
        alert('Test notification failed. Please check your browser permissions and settings.');
      }
    } catch (error) {
      alert('Test notification failed with an error. Check the browser console for details.');
    } finally {
      setIsTestingNotification(false);
    }
  };

  const clearMissedReminders = () => {
    notificationManager.clearMissedReminders();
    setShowMissedReminders(false);
  };

  const dismissMissedReminder = (reminderId: string) => {
    notificationManager.dismissMissedReminder(reminderId);
    setMissedReminders(prev => prev.filter(r => r.id !== reminderId));
  };

  const snoozeOptions = notificationManager.getSnoozeOptions();

  const getPermissionStatusBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Granted</Badge>;
      case 'denied':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Denied</Badge>;
      case 'default':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Not Requested</Badge>;
      case 'unsupported':
        return <Badge className="bg-gray-100 text-gray-800"><BellOff className="w-3 h-3 mr-1" />Unsupported</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Notification Settings</h3>
            </div>
            {getPermissionStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Permission Status */}
          {permissionStatus === 'denied' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Browser notifications are blocked. You'll receive in-app alerts instead. 
                To enable desktop notifications, click the lock icon in your browser's address bar and allow notifications.
              </AlertDescription>
            </Alert>
          )}

          {permissionStatus === 'default' && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Enable desktop notifications for follow-up reminders</span>
                  <Button onClick={handleRequestPermission} size="sm">
                    Enable Notifications
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Global Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notifications-enabled">Enable Follow-up Notifications</Label>
                <p className="text-sm text-gray-500">Master switch for all follow-up reminders</p>
              </div>
              <Switch
                id="notifications-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => updateSettings({ enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="desktop-notifications">Show Desktop Notifications</Label>
                <p className="text-sm text-gray-500">Display notifications outside the browser</p>
              </div>
              <Switch
                id="desktop-notifications"
                checked={settings.showDesktopNotifications}
                onCheckedChange={(checked) => updateSettings({ showDesktopNotifications: checked })}
                disabled={permissionStatus !== 'granted'}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div>
                  <Label htmlFor="sound-enabled">Sound Notifications</Label>
                  <p className="text-sm text-gray-500">Play sound with notifications</p>
                </div>
                {settings.soundEnabled ? 
                  <Volume2 className="w-4 h-4 text-blue-500" /> : 
                  <VolumeX className="w-4 h-4 text-gray-400" />
                }
              </div>
              <Switch
                id="sound-enabled"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
              />
            </div>

            <div className="space-y-2">
            <Label>Default Snooze Interval</Label>
            <p className="text-sm text-gray-500">Default interval for snoozing reminders</p>
            <Select 
            value={settings.defaultSnoozeInterval.toString()} 
              onValueChange={(value) => updateSettings({ defaultSnoozeInterval: parseInt(value) })}
            >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select snooze interval" />
            </SelectTrigger>
            <SelectContent>
            {snoozeOptions.map(option => (
            <SelectItem key={option.value} value={option.value.toString()}>
              {option.label}
              </SelectItem>
              ))}
              </SelectContent>
              </Select>
          </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button 
              onClick={testNotification} 
              variant="outline" 
              size="sm"
              disabled={isTestingNotification}
              className="flex items-center space-x-2"
            >
              <TestTube className="w-4 h-4" />
              <span>{isTestingNotification ? 'Testing...' : 'Test Notification'}</span>
            </Button>
            
            <Button 
              onClick={() => setShowStats(!showStats)} 
              variant="outline" 
              size="sm"
              className="flex items-center space-x-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Statistics</span>
            </Button>
            
            <Button 
              onClick={clearAllReminders} 
              variant="destructive" 
              size="sm"
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Pending</span>
            </Button>
            
            {missedReminders.length > 0 && (
              <Button 
                onClick={() => setShowMissedReminders(!showMissedReminders)} 
                variant="outline" 
                size="sm"
                className="flex items-center space-x-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Missed Reminders ({missedReminders.length})</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics Panel */}
      {showStats && notificationStats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Notification Statistics</h3>
              <Button onClick={() => setShowStats(false)} variant="outline" size="sm">
                Hide
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Reminders</p>
                <p className="text-2xl font-bold text-blue-600">{notificationStats.totalReminders}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Active Reminders</p>
                <p className="text-2xl font-bold text-green-600">{notificationStats.activeReminders}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Missed Reminders</p>
                <p className="text-2xl font-bold text-orange-600">{notificationStats.missedReminders}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-purple-600">{notificationStats.deliveredReminders}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Snoozed</p>
                <p className="text-2xl font-bold text-yellow-600">{notificationStats.snoozedReminders}</p>
              </div>
              {notificationStats.nextReminder && (
                <div className="p-3 bg-gray-50 rounded-lg md:col-span-1">
                  <p className="text-sm text-gray-600">Next Reminder</p>
                  <p className="text-xs font-medium text-gray-800">
                    {notificationStats.nextReminder.company} - {notificationStats.nextReminder.role}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(notificationStats.nextReminder.scheduledTime).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missed Reminders Panel */}
      {showMissedReminders && missedReminders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Missed Reminders</h3>
              <Button onClick={clearMissedReminders} variant="outline" size="sm">
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missedReminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <p className="font-medium">{reminder.company} - {reminder.role}</p>
                    <p className="text-sm text-gray-600">{reminder.message}</p>
                    <p className="text-xs text-gray-500">
                      Scheduled: {reminder.scheduledTime.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => notificationManager.handleQuickAction('open', reminder as any)}
                    >
                      Open
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => notificationManager.snoozeReminder(reminder.id)}
                    >
                      Snooze
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => dismissMissedReminder(reminder.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}