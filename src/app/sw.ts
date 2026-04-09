import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry } from 'serwist'
import { Serwist } from 'serwist'

// The SW file is compiled by serwist's bundler, not tsc. The
// ServiceWorkerGlobalScope type is not available in the main tsconfig
// (which uses 'dom' lib, incompatible with 'webworker'). We declare just
// enough of the interface here so the rest of the file type-checks cleanly
// against the app tsconfig while the real runtime type is correct.
declare const self: typeof globalThis & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  skipWaiting: () => void
  clients: {
    claim: () => void
    matchAll: (options?: { type?: string }) => Promise<Array<{ url: string; focus: () => Promise<void> }>>
    openWindow: (url: string) => Promise<void>
  }
  registration: {
    showNotification: (title: string, options?: NotificationOptions) => Promise<void>
  }
}

// These types match the ServiceWorkerGlobalScope push/notification events.
// tsc checks this file against the 'dom' lib (not 'webworker'), so we define
// them manually. The serwist bundler compiles the real SW with correct types.
interface SWPushEvent {
  data: { json: () => { title: string; body: string; link?: string; tag?: string } } | null
  waitUntil: (promise: Promise<unknown>) => void
}

interface SWNotificationEvent {
  notification: { close: () => void; data?: { url?: string } }
  waitUntil: (promise: Promise<unknown>) => void
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()

// Push notification handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(self as any).addEventListener('push', (event: SWPushEvent) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/icons/icon-192.png',
      badge: '/images/icons/icon-192.png',
      data: { url: data.link || '/dashboard' },
      tag: data.tag || 'vroomx-notification',
    })
  )
})

// Notification click handler — open/focus the app
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(self as any).addEventListener('notificationclick', (event: SWNotificationEvent) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus an existing window if one is open
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url)
    })
  )
})
