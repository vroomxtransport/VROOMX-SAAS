'use client'

import { useState, useEffect, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'vroomx-install-dismissed'

function readDismissed(): boolean {
  // Safe to call in useState lazy initializer — runs only on the client
  // after hydration. Returns false on SSR (no localStorage available).
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DISMISSED_KEY) === '1'
}

export function useInstallPrompt() {
  // Lazy initializer reads localStorage once at mount — avoids a
  // synchronous setState call inside a useEffect body.
  const [dismissed, setDismissed] = useState<boolean>(readDismissed)
  const [canInstall, setCanInstall] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // Detect iOS — Safari on iOS does not fire beforeinstallprompt. We show
  // manual "Add to Home Screen" instructions instead.
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => {
    // Skip registering the event listener if the user already dismissed
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  const promptInstall = async () => {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    if (outcome === 'dismissed') {
      dismiss()
    }
    deferredPrompt.current = null
    setCanInstall(false)
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, '1')
    setCanInstall(false)
  }

  return {
    // True when the browser has fired beforeinstallprompt and the user
    // hasn't already dismissed the banner.
    canInstall: canInstall && !dismissed,
    promptInstall,
    dismiss,
    isIOS,
  }
}
