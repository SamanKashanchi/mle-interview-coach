// Service worker: shows reminder notifications and opens the right page when one is tapped.
// The send-reminders edge function sends {title, body, url}.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'MLE Coach', {
      body: data.body || "Today's questions are waiting.",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.url || 'reminder',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.location.origin))
      if (win) return win.focus().then(() => win.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
