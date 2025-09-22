// Service Worker for handling notification actions
// This enables proper notification action buttons on desktop

const CACHE_NAME = 'job-tracker-notifications-v1';

// Install and activate service worker
self.addEventListener('install', event => {
  console.log('Notifications service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Notifications service worker activated');
  event.waitUntil(clients.claim());
});

// Handle notification clicks and action button clicks
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  const reminder = data.reminder || {};
  
  event.waitUntil(
    (async () => {
      try {
        // Get the client (main app window)
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        
        let client = clients.find(c => c.url.includes(self.location.origin));
        
        // Handle different actions
        switch (action) {
          case 'open':
            const openUrl = `${self.location.origin}/?job=${reminder.jobUuid}`;
            if (client) {
              await client.focus();
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: 'open',
                reminder,
                url: openUrl
              });
            } else {
              await self.clients.openWindow(openUrl);
            }
            break;
            
          case 'email':
            const emailBody = encodeURIComponent(
              `Hi,\n\nI wanted to follow up on my application for the ${reminder.role} position at ${reminder.company}.\n\nThank you for your time and consideration.\n\nBest regards`
            );
            const emailSubject = encodeURIComponent(`Following up on ${reminder.role} application`);
            const mailtoUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;
            
            if (client) {
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: 'email',
                reminder,
                url: mailtoUrl
              });
            } else {
              await self.clients.openWindow(mailtoUrl);
            }
            break;
            
          case 'snooze':
            if (client) {
              await client.focus();
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: 'snooze',
                reminder
              });
            } else {
              // Open app and queue snooze action
              const appClient = await self.clients.openWindow(self.location.origin);
              // Wait for the client to load and then send message
              setTimeout(() => {
                appClient.postMessage({
                  type: 'NOTIFICATION_ACTION',
                  action: 'snooze',
                  reminder
                });
              }, 1000);
            }
            break;
            
          case 'dismiss':
            if (client) {
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: 'dismiss',
                reminder
              });
            }
            break;
            
          default:
            // Default click behavior (no action button clicked)
            const defaultUrl = `${self.location.origin}/?job=${reminder.jobUuid}`;
            if (client) {
              await client.focus();
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: 'open',
                reminder,
                url: defaultUrl
              });
            } else {
              await self.clients.openWindow(defaultUrl);
            }
        }
        
        // Log the action for analytics
        console.log(`Notification action executed: ${action || 'default'} for job ${reminder.company}`);
        
      } catch (error) {
        console.error('Error handling notification click:', error);
      }
    })()
  );
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline notification delivery
self.addEventListener('sync', event => {
  if (event.tag === 'missed-notifications') {
    event.waitUntil(handleMissedNotifications());
  }
});

async function handleMissedNotifications() {
  try {
    // Get all clients
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    // Notify all clients to check for missed notifications
    clients.forEach(client => {
      client.postMessage({
        type: 'CHECK_MISSED_NOTIFICATIONS'
      });
    });
  } catch (error) {
    console.error('Error handling missed notifications:', error);
  }
}

// Push notification handler (for future use if push notifications are implemented)
self.addEventListener('push', event => {
  console.log('Push event received:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Job Application Reminder';
      const options = {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: data.data,
        actions: [
          {
            action: 'open',
            title: 'Open Application',
            icon: '/icons/open.png'
          },
          {
            action: 'snooze',
            title: 'Snooze',
            icon: '/icons/snooze.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icons/dismiss.png'
          }
        ],
        requireInteraction: true,
        tag: `job-reminder-${data.data?.reminder?.jobUuid}`
      };
      
      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    } catch (error) {
      console.error('Error handling push event:', error);
    }
  }
});