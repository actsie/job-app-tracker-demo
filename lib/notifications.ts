interface ReminderNotification {
  id: string;
  jobUuid: string;
  company: string;
  role: string;
  scheduledTime: Date;
  message: string;
  timeoutId?: number;
  isDelivered?: boolean;
  snoozeCount?: number;
  originalScheduledTime?: Date;
}

interface NotificationSettings {
  enabled: boolean;
  defaultSnoozeInterval: number; // in minutes
  soundEnabled: boolean;
  showDesktopNotifications: boolean;
  perAppSettings?: Record<string, boolean>;
}

interface QuickAction {
  action: 'open' | 'dismiss' | 'snooze' | 'email';
  title: string;
}

interface MissedReminder {
  id: string;
  jobUuid: string;
  company: string;
  role: string;
  scheduledTime: Date;
  message: string;
}

class NotificationManager {
  private reminders: Map<string, ReminderNotification> = new Map();
  private storageKey = 'jobReminders';
  private settingsKey = 'notificationSettings';
  private missedRemindersKey = 'missedReminders';
  private deliveredRemindersKey = 'deliveredReminders';
  private settings: NotificationSettings;
  private missedReminders: MissedReminder[] = [];
  private deliveredReminderIds: Set<string> = new Set();
  private eventListeners: Map<string, Function[]> = new Map();
  private swRegistration: ServiceWorkerRegistration | null = null;
  private audioContext: AudioContext | null = null;
  private notificationSound: AudioBuffer | null = null;

  constructor() {
    this.settings = this.loadSettings();
    this.loadReminders();
    this.loadMissedReminders();
    this.loadDeliveredReminders();
    this.rescheduleActiveReminders();
    this.setupVisibilityChangeHandler();
    this.initializeServiceWorker();
    this.initializeNotificationSound();
  }

  private loadSettings(): NotificationSettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.settingsKey);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
    
    return {
      enabled: true,
      defaultSnoozeInterval: 60, // 1 hour
      soundEnabled: true,
      showDesktopNotifications: true,
      perAppSettings: {}
    };
  }

  private saveSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  private loadMissedReminders() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.missedRemindersKey);
        if (stored) {
          this.missedReminders = JSON.parse(stored).map((reminder: any) => ({
            ...reminder,
            scheduledTime: new Date(reminder.scheduledTime)
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load missed reminders:', error);
    }
  }

  private saveMissedReminders() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.missedRemindersKey, JSON.stringify(this.missedReminders));
      }
    } catch (error) {
      console.error('Failed to save missed reminders:', error);
    }
  }

  private loadDeliveredReminders() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.deliveredRemindersKey);
        if (stored) {
          this.deliveredReminderIds = new Set(JSON.parse(stored));
        }
      }
    } catch (error) {
      console.error('Failed to load delivered reminders:', error);
    }
  }

  private saveDeliveredReminders() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.deliveredRemindersKey, JSON.stringify(Array.from(this.deliveredReminderIds)));
      }
    } catch (error) {
      console.error('Failed to save delivered reminders:', error);
    }
  }

  private loadReminders() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const reminders = JSON.parse(stored);
          reminders.forEach((reminder: ReminderNotification) => {
            this.reminders.set(reminder.id, {
              ...reminder,
              scheduledTime: new Date(reminder.scheduledTime),
              originalScheduledTime: reminder.originalScheduledTime ? new Date(reminder.originalScheduledTime) : undefined
            });
          });
        }
      }
    } catch (error) {
      console.error('Failed to load reminders:', error);
    }
  }

  private saveReminders() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const remindersArray = Array.from(this.reminders.values()).map(
          ({ timeoutId, ...reminder }) => reminder
        );
        localStorage.setItem(this.storageKey, JSON.stringify(remindersArray));
      }
    } catch (error) {
      console.error('Failed to save reminders:', error);
    }
  }

  private setupVisibilityChangeHandler() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForMissedReminders();
        }
      });

      // Handle service worker messages
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });
      }

      // Handle page focus to check missed notifications
      window.addEventListener('focus', () => {
        this.checkForMissedReminders();
      });

      // Handle online/offline events
      window.addEventListener('online', () => {
        this.handleOnlineEvent();
      });
    }
  }

  private async initializeServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw-notifications.js', {
        scope: '/'
      });
      
      this.swRegistration = registration;
      console.log('Notification service worker registered successfully');
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              console.log('New service worker version available');
            }
          });
        }
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }

  private async initializeNotificationSound() {
    if (typeof window === 'undefined' || !this.settings.soundEnabled) {
      return;
    }

    try {
      // Initialize AudioContext for notification sounds
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        
        // Create a simple notification beep
        this.createNotificationSound();
      }
    } catch (error) {
      console.warn('Could not initialize notification sound:', error);
    }
  }

  private createNotificationSound() {
    if (!this.audioContext) return;

    // Create a simple beep sound
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3; // 300ms
    const numSamples = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a pleasant notification tone (two-tone beep)
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      const frequency1 = 800; // First tone
      const frequency2 = 600; // Second tone
      
      let value = 0;
      if (time < duration * 0.4) {
        value = Math.sin(2 * Math.PI * frequency1 * time);
      } else if (time < duration * 0.8) {
        value = Math.sin(2 * Math.PI * frequency2 * time);
      }
      
      // Apply envelope to avoid clicking
      const envelope = Math.sin(Math.PI * time / duration);
      data[i] = value * envelope * 0.1; // Reduce volume
    }

    this.notificationSound = buffer;
  }

  private async playNotificationSound() {
    if (!this.audioContext || !this.notificationSound || !this.settings.soundEnabled) {
      return;
    }

    try {
      // Resume audio context if suspended (required by modern browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = this.notificationSound;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  private handleServiceWorkerMessage(data: any) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'NOTIFICATION_ACTION':
        this.handleServiceWorkerAction(data);
        break;
      case 'CHECK_MISSED_NOTIFICATIONS':
        this.checkForMissedReminders();
        break;
    }
  }

  private async handleServiceWorkerAction(data: any) {
    const { action, reminder, url } = data;
    
    switch (action) {
      case 'open':
        if (url) {
          window.open(url, '_blank');
        }
        break;
      case 'email':
        if (url) {
          window.location.href = url;
        }
        break;
      case 'snooze':
        if (reminder && reminder.id) {
          // Show snooze options UI
          this.emit('showSnoozeOptions', reminder);
        }
        break;
      case 'dismiss':
        if (reminder && reminder.id) {
          this.markReminderAsDelivered(reminder.id);
        }
        break;
    }
  }

  private handleOnlineEvent() {
    // When coming back online, check for missed reminders
    this.checkForMissedReminders();
    
    // Re-register service worker if needed
    if (!this.swRegistration && 'serviceWorker' in navigator) {
      this.initializeServiceWorker();
    }
  }

  private checkForMissedReminders() {
    const now = new Date();
    const newMissedReminders: MissedReminder[] = [];
    
    this.reminders.forEach((reminder) => {
      if (reminder.scheduledTime <= now && 
          !reminder.isDelivered && 
          !this.deliveredReminderIds.has(reminder.id)) {
        newMissedReminders.push({
          id: reminder.id,
          jobUuid: reminder.jobUuid,
          company: reminder.company,
          role: reminder.role,
          scheduledTime: reminder.scheduledTime,
          message: reminder.message
        });
        
        // Mark as delivered to prevent duplicate processing
        this.markReminderAsDelivered(reminder.id);
      }
    });
    
    if (newMissedReminders.length > 0) {
      this.missedReminders.push(...newMissedReminders);
      this.saveMissedReminders();
      this.emit('missedReminders', newMissedReminders);
    }
  }

  private markReminderAsDelivered(reminderId: string) {
    this.deliveredReminderIds.add(reminderId);
    this.saveDeliveredReminders();
    
    const reminder = this.reminders.get(reminderId);
    if (reminder) {
      reminder.isDelivered = true;
      this.saveReminders();
    }
  }

  private rescheduleActiveReminders() {
    const now = new Date();
    this.reminders.forEach((reminder) => {
      if (reminder.scheduledTime > now && !reminder.isDelivered) {
        this.scheduleNotification(reminder);
      } else if (reminder.scheduledTime <= now && !reminder.isDelivered && !this.deliveredReminderIds.has(reminder.id)) {
        // This is a missed reminder
        this.missedReminders.push({
          id: reminder.id,
          jobUuid: reminder.jobUuid,
          company: reminder.company,
          role: reminder.role,
          scheduledTime: reminder.scheduledTime,
          message: reminder.message
        });
        this.markReminderAsDelivered(reminder.id);
      }
    });
    this.saveMissedReminders();
    this.saveReminders();
  }

  private scheduleNotification(reminder: ReminderNotification) {
    const now = new Date();
    const delay = reminder.scheduledTime.getTime() - now.getTime();

    if (delay <= 0) return;

    const timeoutId = typeof window !== 'undefined' ? window.setTimeout(() => {
      if (this.settings.enabled && this.shouldShowNotificationForJob(reminder.jobUuid)) {
        this.showNotification(reminder);
      }
      this.markReminderAsDelivered(reminder.id);
    }, delay) : undefined;

    if (!timeoutId) return;

    reminder.timeoutId = timeoutId;
  }

  private shouldShowNotificationForJob(jobUuid: string): boolean {
    const perAppSetting = this.settings.perAppSettings?.[jobUuid];
    return perAppSetting !== false; // Show by default unless explicitly disabled
  }

  private async showNotification(reminder: ReminderNotification) {
    const title = `Job Application Reminder`;
    const body = `${reminder.company} - ${reminder.role}: ${reminder.message}`;
    const quickActions: QuickAction[] = [
      { action: 'open', title: 'Open Application' },
      { action: 'snooze', title: 'Snooze' },
      { action: 'email', title: 'Open Email Draft' },
      { action: 'dismiss', title: 'Dismiss' }
    ];

    const options = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `job-reminder-${reminder.jobUuid}`,
      requireInteraction: true,
      silent: !this.settings.soundEnabled,
      data: {
        reminder,
        timestamp: Date.now()
      },
      actions: quickActions.map(action => ({
        action: action.action,
        title: action.title,
        icon: this.getActionIcon(action.action)
      }))
    };

    try {
      // Play notification sound if enabled
      if (this.settings.soundEnabled) {
        await this.playNotificationSound();
      }

      if (!this.settings.showDesktopNotifications || Notification.permission !== 'granted') {
        // Show in-app notification instead
        this.emit('inAppNotification', { reminder, quickActions });
        return;
      }

      // Try service worker notification first (better support for actions)
      if (this.swRegistration && 'showNotification' in this.swRegistration) {
        try {
          await this.swRegistration.showNotification(title, options);
          console.log('Notification sent via service worker');
        } catch (swError) {
          console.warn('Service worker notification failed, falling back:', swError);
          throw swError;
        }
      } else if ('Notification' in window && Notification.permission === 'granted') {
        // Fallback to basic Notification API
        const basicOptions = {
          body: options.body,
          icon: options.icon,
          badge: options.badge,
          tag: options.tag,
          requireInteraction: options.requireInteraction,
          silent: options.silent,
          data: options.data
        };
        const notification = new Notification(title, basicOptions);
        this.setupNotificationClickHandlers(notification, reminder, quickActions);
      } else {
        // Final fallback to in-app notification
        throw new Error('No notification method available');
      }
      
      // Emit event for any listeners
      this.emit('notificationShown', reminder);
      
    } catch (error) {
      console.error('Failed to show desktop notification:', error);
      // Fallback to in-app notification
      this.emit('inAppNotification', { reminder, quickActions });
    }
  }

  private getActionIcon(action: string): string {
    const iconMap: Record<string, string> = {
      open: '/icons/open.png',
      snooze: '/icons/snooze.png',
      email: '/icons/email.png',
      dismiss: '/icons/dismiss.png'
    };
    return iconMap[action] || '/favicon.ico';
  }

  private setupNotificationClickHandlers(notification: Notification, reminder: ReminderNotification, quickActions: QuickAction[]) {
    notification.onclick = () => {
      this.handleQuickAction('open', reminder);
      notification.close();
    };

    // Note: Individual action clicks would be handled by service worker
    // or through the browser's notification action system
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      
      if (!granted) {
        // If permission denied, offer in-app notifications
        this.settings.showDesktopNotifications = false;
        this.saveSettings();
      }
      
      return granted;
    }

    return false;
  }

  getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  scheduleReminder(
    id: string,
    jobUuid: string,
    company: string,
    role: string,
    scheduledTime: Date,
    message: string = 'Follow up on this application'
  ) {
    // Prevent duplicate scheduling
    if (this.deliveredReminderIds.has(id)) {
      console.log(`Reminder ${id} already delivered, skipping schedule`);
      return;
    }

    this.cancelReminder(id);

    const reminder: ReminderNotification = {
      id,
      jobUuid,
      company,
      role,
      scheduledTime,
      message,
      isDelivered: false,
      snoozeCount: 0,
      originalScheduledTime: scheduledTime
    };

    this.reminders.set(id, reminder);
    this.scheduleNotification(reminder);
    this.saveReminders();
  }

  cancelReminder(id: string) {
    const reminder = this.reminders.get(id);
    if (reminder) {
      if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
      }
      this.reminders.delete(id);
      this.saveReminders();
    }
    
    // Also remove from missed reminders
    this.missedReminders = this.missedReminders.filter(missed => missed.id !== id);
    this.saveMissedReminders();
    
    // Remove from delivered reminders to allow rescheduling
    this.deliveredReminderIds.delete(id);
    this.saveDeliveredReminders();
  }

  getUpcomingReminders(limit: number = 5): ReminderNotification[] {
    const now = new Date();
    return Array.from(this.reminders.values())
      .filter(reminder => reminder.scheduledTime > now && !reminder.isDelivered)
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
      .slice(0, limit);
  }

  getAllReminders(): ReminderNotification[] {
    return Array.from(this.reminders.values());
  }

  getRemindersByJobUuid(jobUuid: string): ReminderNotification[] {
    return Array.from(this.reminders.values()).filter(
      reminder => reminder.jobUuid === jobUuid
    );
  }

  // Settings management
  updateSettings(newSettings: Partial<NotificationSettings>) {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Handle sound setting changes
    if (oldSettings.soundEnabled !== this.settings.soundEnabled) {
      if (this.settings.soundEnabled) {
        this.initializeNotificationSound();
      } else {
        // Clear audio resources if sound is disabled
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
          this.notificationSound = null;
        }
      }
    }
    
    this.emit('settingsChanged', this.settings);
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  setPerAppNotificationSetting(jobUuid: string, enabled: boolean) {
    if (!this.settings.perAppSettings) {
      this.settings.perAppSettings = {};
    }
    this.settings.perAppSettings[jobUuid] = enabled;
    this.saveSettings();
  }

  // Snooze functionality
  snoozeReminder(reminderId: string, snoozeMinutes?: number): boolean {
    const reminder = this.reminders.get(reminderId);
    if (!reminder) return false;

    const snoozeInterval = snoozeMinutes || this.settings.defaultSnoozeInterval;
    const newScheduledTime = new Date(Date.now() + snoozeInterval * 60 * 1000);
    
    // Cancel the current timeout
    if (reminder.timeoutId) {
      clearTimeout(reminder.timeoutId);
    }
    
    // Update the reminder
    reminder.scheduledTime = newScheduledTime;
    reminder.snoozeCount = (reminder.snoozeCount || 0) + 1;
    reminder.isDelivered = false;
    
    // Reschedule
    this.scheduleNotification(reminder);
    this.saveReminders();
    
    this.emit('reminderSnoozed', { reminder, snoozeMinutes: snoozeInterval });
    return true;
  }

  // Quick actions
  async handleQuickAction(action: string, reminder: ReminderNotification) {
    try {
      switch (action) {
        case 'open':
          const openUrl = `/?job=${reminder.jobUuid}`;
          if (window.opener) {
            // If opened from another window, use the parent
            window.opener.location.href = openUrl;
            window.opener.focus();
          } else {
            window.open(openUrl, '_blank');
          }
          break;
        case 'snooze':
          // Default snooze with settings interval
          this.snoozeReminder(reminder.id);
          break;
        case 'email':
          // Trigger email draft editor opening
          this.emit('openEmailDraft', reminder);
          break;
        case 'dismiss':
          this.markReminderAsDelivered(reminder.id);
          break;
      }
      
      this.emit('quickActionExecuted', { action, reminder, success: true });
    } catch (error) {
      console.error(`Error executing quick action ${action}:`, error);
      this.emit('quickActionExecuted', { action, reminder, success: false, error });
    }
  }

  // Enhanced snooze with custom intervals
  snoozeReminderWithOptions(reminderId: string, snoozeMinutes: number): boolean {
    return this.snoozeReminder(reminderId, snoozeMinutes);
  }

  // Get available snooze options
  getSnoozeOptions(): Array<{ value: number; label: string }> {
    return [
      { value: 15, label: '15 minutes' },
      { value: 30, label: '30 minutes' },
      { value: 60, label: '1 hour' },
      { value: 120, label: '2 hours' },
      { value: 240, label: '4 hours' },
      { value: 480, label: '8 hours' },
      { value: 1440, label: '1 day' },
      { value: 2880, label: '2 days' },
      { value: 10080, label: '1 week' }
    ];
  }

  // Missed reminders management
  getMissedReminders(): MissedReminder[] {
    return [...this.missedReminders];
  }

  clearMissedReminders() {
    this.missedReminders = [];
    this.saveMissedReminders();
    this.emit('missedRemindersCleared');
  }

  dismissMissedReminder(reminderId: string) {
    this.missedReminders = this.missedReminders.filter(reminder => reminder.id !== reminderId);
    this.saveMissedReminders();
    this.emit('missedReminderDismissed', reminderId);
  }

  // Clear all pending follow-ups
  async clearAllPendingReminders() {
    // Cancel all scheduled timeouts
    this.reminders.forEach((reminder) => {
      if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
      }
    });
    
    // Cancel any active notifications
    if (this.swRegistration) {
      try {
        const notifications = await this.swRegistration.getNotifications();
        notifications.forEach(notification => {
          if (notification.tag?.startsWith('job-reminder-')) {
            notification.close();
          }
        });
      } catch (error) {
        console.warn('Could not clear active notifications:', error);
      }
    }
    
    // Clear data
    this.reminders.clear();
    this.missedReminders = [];
    this.deliveredReminderIds.clear();
    
    // Save to storage
    this.saveReminders();
    this.saveMissedReminders();
    this.saveDeliveredReminders();
    
    this.emit('allRemindersCleared');
  }

  // Get notification statistics
  getNotificationStats() {
    const now = new Date();
    const activeReminders = Array.from(this.reminders.values()).filter(
      r => r.scheduledTime > now && !r.isDelivered
    );
    
    return {
      totalReminders: this.reminders.size,
      activeReminders: activeReminders.length,
      missedReminders: this.missedReminders.length,
      deliveredReminders: this.deliveredReminderIds.size,
      snoozedReminders: activeReminders.filter(r => (r.snoozeCount || 0) > 0).length,
      nextReminder: activeReminders.length > 0 
        ? activeReminders.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())[0]
        : null
    };
  }

  // Test notification system
  async testNotification(): Promise<boolean> {
    const testReminder: ReminderNotification = {
      id: 'test-notification',
      jobUuid: 'test-uuid',
      company: 'Test Company',
      role: 'Test Role',
      scheduledTime: new Date(),
      message: 'This is a test notification to verify your settings are working correctly.',
      isDelivered: false,
      snoozeCount: 0
    };

    try {
      await this.showNotification(testReminder);
      return true;
    } catch (error) {
      console.error('Test notification failed:', error);
      return false;
    }
  }

  // Event system
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

export const notificationManager = new NotificationManager();
export type { ReminderNotification, NotificationSettings, QuickAction, MissedReminder };