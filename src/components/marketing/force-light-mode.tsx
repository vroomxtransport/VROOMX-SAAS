'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

export function ForceLightMode() {
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    // Force light theme via next-themes
    setTheme('light')

    // Also force body background in case CSS variables haven't cascaded
    document.body.style.backgroundColor = '#ffffff'
    document.body.style.color = '#1f1f1f'

    return () => {
      // Restore system preference when navigating away
      setTheme('system')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [setTheme])

  return null
}
