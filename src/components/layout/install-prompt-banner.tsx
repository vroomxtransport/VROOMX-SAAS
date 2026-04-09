'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Monitor, Share, Smartphone } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/use-install-prompt'

/**
 * InstallPromptToast
 *
 * Renders nothing visually — listens for the install prompt state and
 * fires a Sonner toast when the app is installable (mobile AND desktop).
 *
 * - Desktop Chrome/Edge: "Install" button triggers the native install flow.
 * - Mobile Chrome/Edge/Android: Same native install flow, mobile-tailored copy.
 * - iOS/Safari: Shows "Add to Home Screen" instructions (no native prompt).
 * - Dismissed via toast close or explicit dismiss — suppressed via localStorage.
 */
export function InstallPromptBanner() {
  const { canInstall, promptInstall, dismiss, isIOS } = useInstallPrompt()
  const hasShown = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasShown.current) return

    const shouldShow = canInstall || isIOS
    if (!shouldShow) return

    hasShown.current = true

    const isMobile = window.innerWidth < 1024

    // Small delay so it doesn't compete with page load
    const timer = setTimeout(() => {
      if (isIOS) {
        toast('Install VroomX', {
          description: 'Tap the Share button then "Add to Home Screen" for the best experience.',
          icon: <Share className="h-5 w-5 text-brand" />,
          duration: 12000,
          action: {
            label: 'Got it',
            onClick: dismiss,
          },
          onDismiss: dismiss,
        })
      } else {
        toast('Install VroomX', {
          description: isMobile
            ? 'Add to your home screen for a native app experience — faster access, offline support.'
            : 'Install VroomX as a desktop app for instant access, push notifications, and a distraction-free window.',
          icon: isMobile
            ? <Smartphone className="h-5 w-5 text-brand" />
            : <Monitor className="h-5 w-5 text-brand" />,
          duration: 15000,
          action: {
            label: 'Install',
            onClick: () => {
              promptInstall()
            },
          },
          cancel: {
            label: 'Not now',
            onClick: dismiss,
          },
          onDismiss: dismiss,
        })
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [canInstall, isIOS, promptInstall, dismiss])

  // This component renders nothing — it's a toast trigger
  return null
}
