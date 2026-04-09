'use client'

import { useState, useEffect, useCallback } from 'react'
import { subscribePush, unsubscribePush } from '@/app/actions/push-subscription'

type PushPermission = 'default' | 'granted' | 'denied'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

function getInitialSupported() {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

function getInitialPermission(): PushPermission {
  if (typeof window === 'undefined') return 'default'
  if (!('Notification' in window)) return 'default'
  return Notification.permission as PushPermission
}

export function usePushNotifications() {
  const [isSupported] = useState(getInitialSupported)
  const [permission, setPermission] = useState<PushPermission>(getInitialPermission)
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Check for existing subscription on mount
  useEffect(() => {
    if (!isSupported) return
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub)
      })
    })
  }, [isSupported])

  const registerSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        console.warn('[PUSH] VAPID public key not configured')
        return
      }

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        console.error('[PUSH] Invalid subscription data')
        return
      }

      await subscribePush({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('[PUSH] Failed to register subscription:', err)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false

    const result = await Notification.requestPermission()
    setPermission(result as PushPermission)

    if (result === 'granted') {
      await registerSubscription()
      return true
    }
    return false
  }, [isSupported, registerSubscription])

  const unregister = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await unsubscribePush({ endpoint: subscription.endpoint })
      }

      setIsSubscribed(false)
    } catch (err) {
      console.error('[PUSH] Failed to unregister:', err)
    }
  }, [])

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    unregister,
  }
}
