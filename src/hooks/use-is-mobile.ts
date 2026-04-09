import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768  // matches Tailwind md:
const TABLET_BREAKPOINT = 1024 // matches Tailwind lg:

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

function getIsMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getIsTablet() {
  const w = window.innerWidth
  return w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT
}

// SSR-safe: default to desktop
function getServerIsMobile() {
  return false
}

function getServerIsTablet() {
  return false
}

export function useIsMobile() {
  const isMobile = useSyncExternalStore(subscribe, getIsMobile, getServerIsMobile)
  const isTablet = useSyncExternalStore(subscribe, getIsTablet, getServerIsTablet)
  return { isMobile, isTablet }
}
